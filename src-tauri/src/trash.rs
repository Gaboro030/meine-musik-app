use crate::commands::AppState;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Serialize, Deserialize, Clone)]
pub struct TrashEntry {
    pub id: String,
    pub filename: String,
    pub playlist: String,
    pub trashed_at: f64,
}

static TRASH_LOCK: Mutex<()> = Mutex::new(());

pub(crate) fn load_index(file: &Path) -> Vec<TrashEntry> {
    std::fs::read_to_string(file)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}
pub(crate) fn save_index(file: &Path, entries: &[TrashEntry]) {
    if let Ok(s) = serde_json::to_string_pretty(entries) {
        let _ = std::fs::write(file, s);
    }
}

/// Moves a track out of its playlist folder into the trash dir (renamed to
/// <uuid>.mp3 so trashed files from different playlists can never collide)
/// and records enough metadata in trash_index.json to restore it later.
/// Called from commands::remove_track_from_playlist, not exposed directly
/// as a command. Returns the generated trash id so the caller can offer an
/// immediate "Rueckgaengig" undo without the user having to dig through the
/// Papierkorb view.
pub fn move_to_trash(
    state: &AppState,
    playlist: &str,
    filename: &str,
    src_path: &Path,
) -> Result<String, String> {
    let _lock = TRASH_LOCK.lock().unwrap();
    std::fs::create_dir_all(&state.trash_dir).map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let dest = state.trash_dir.join(format!("{id}.mp3"));
    std::fs::rename(src_path, &dest).map_err(|e| e.to_string())?;
    // Verwaisten Cover-Cache-Sidecar mit aufraeumen - sonst wuerde ein
    // spaeter neu hinzugefuegter Track mit demselben Dateinamen (gleiche
    // Playlist) faelschlich das alte, alte Cover serviert bekommen
    // (compressed_cover in commands.rs liest den Cache rein dateinamen-
    // basiert, ohne den Inhalt zu kennen).
    let _ = std::fs::remove_file(src_path.with_extension("cover_cache.jpg"));

    let mut entries = load_index(&state.trash_index_file);
    let trashed_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0);
    entries.push(TrashEntry {
        id: id.clone(),
        filename: filename.to_string(),
        playlist: playlist.to_string(),
        trashed_at,
    });
    save_index(&state.trash_index_file, &entries);
    Ok(id)
}

#[tauri::command]
pub fn list_trash(state: tauri::State<AppState>) -> Result<Vec<TrashEntry>, String> {
    let _lock = TRASH_LOCK.lock().unwrap();
    Ok(load_index(&state.trash_index_file))
}

#[tauri::command]
pub fn restore_trash(state: tauri::State<AppState>, trash_id: String) -> Result<(), String> {
    let _lock = TRASH_LOCK.lock().unwrap();
    let mut entries = load_index(&state.trash_index_file);
    let idx = entries
        .iter()
        .position(|e| e.id == trash_id)
        .ok_or_else(|| "Eintrag nicht gefunden.".to_string())?;
    let entry = entries[idx].clone();

    let src = state.trash_dir.join(format!("{}.mp3", entry.id));
    if !src.is_file() {
        return Err("Datei fehlt im Papierkorb.".into());
    }

    let clean_playlist = crate::commands::safe_filename(&entry.playlist);
    let playlist_dir = state.music_root.join(&clean_playlist);
    std::fs::create_dir_all(&playlist_dir).map_err(|e| e.to_string())?;

    let stem = Path::new(&entry.filename)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| entry.filename.clone());
    let mut dest = playlist_dir.join(&entry.filename);
    let mut n = 2;
    while dest.exists() {
        dest = playlist_dir.join(format!("{stem} ({n}).mp3"));
        n += 1;
    }

    std::fs::rename(&src, &dest).map_err(|e| e.to_string())?;
    entries.remove(idx);
    save_index(&state.trash_index_file, &entries);
    Ok(())
}

#[tauri::command]
pub fn delete_trash_forever(state: tauri::State<AppState>, trash_id: String) -> Result<(), String> {
    let _lock = TRASH_LOCK.lock().unwrap();
    let mut entries = load_index(&state.trash_index_file);
    let idx = entries
        .iter()
        .position(|e| e.id == trash_id)
        .ok_or_else(|| "Eintrag nicht gefunden.".to_string())?;
    let entry = entries[idx].clone();
    let path = state.trash_dir.join(format!("{}.mp3", entry.id));
    if path.is_file() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    entries.remove(idx);
    save_index(&state.trash_index_file, &entries);
    Ok(())
}
