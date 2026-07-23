use crate::commands::AppState;
use serde::Serialize;
use std::collections::HashSet;
use std::path::Path;

#[derive(Serialize, Clone)]
pub struct OrphanedSidecar {
    pub playlist: String,
    pub filename: String,
}

#[derive(Serialize, Clone)]
pub struct BrokenTrashEntry {
    pub id: String,
    pub filename: String,
    pub playlist: String,
}

#[derive(Serialize, Default)]
pub struct HealthReport {
    pub orphaned_sidecars: Vec<OrphanedSidecar>,
    pub broken_trash_entries: Vec<BrokenTrashEntry>,
}

// Laengste/spezifischste Endung zuerst - ".cover_cache.jpg" muss vor dem
// allgemeineren ".jpg" geprueft werden, sonst wuerde dessen Basisname noch
// die eigentlich nicht dazugehoerende ".cover_cache"-Silbe enthalten.
const SIDECAR_SUFFIXES: &[&str] = &[".cover_cache.jpg", ".jpg", ".album.txt", ".artist.txt", ".lyrics.json"];
const AUDIO_EXTS: &[&str] = &["mp3", "m4a", "mp4"];

/// Sidecar-Dateien (Cover/.jpg, Album/Interpret-Sidecars, Lyrics-Cache), zu
/// denen der eigentliche Track nicht mehr existiert - z.B. weil der Track
/// geloescht/umbenannt wurde, der Sidecar aber liegen blieb.
fn find_orphaned_sidecars_in(dir: &Path, playlist: &str) -> Vec<OrphanedSidecar> {
    let mut out = Vec::new();
    let Ok(entries) = std::fs::read_dir(dir) else {
        return out;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        let Some(suffix) = SIDECAR_SUFFIXES.iter().find(|s| name.ends_with(**s)) else {
            continue;
        };
        let base = &name[..name.len() - suffix.len()];
        if base.is_empty() {
            continue;
        }
        let has_track = AUDIO_EXTS.iter().any(|ext| dir.join(format!("{base}.{ext}")).is_file());
        if !has_track {
            out.push(OrphanedSidecar {
                playlist: playlist.to_string(),
                filename: name.to_string(),
            });
        }
    }
    out
}

fn health_check_inner(state: &AppState) -> HealthReport {
    let mut report = HealthReport::default();

    if let Ok(entries) = std::fs::read_dir(&state.music_root) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            report.orphaned_sidecars.extend(find_orphaned_sidecars_in(&path, &name));
        }
    }

    // Papierkorb-Eintrag ohne die dazugehoerige Datei im Papierkorb-Ordner -
    // "Wiederherstellen" wuerde da mit "Datei fehlt im Papierkorb" scheitern.
    for e in crate::trash::load_index(&state.trash_index_file) {
        let path = state.trash_dir.join(format!("{}.mp3", e.id));
        if !path.is_file() {
            report.broken_trash_entries.push(BrokenTrashEntry {
                id: e.id,
                filename: e.filename,
                playlist: e.playlist,
            });
        }
    }

    report
}

#[tauri::command]
pub fn health_check(state: tauri::State<AppState>) -> Result<HealthReport, String> {
    Ok(health_check_inner(&state))
}

#[derive(Serialize)]
pub struct HealthCleanupResult {
    pub removed_sidecars: usize,
    pub removed_trash_entries: usize,
}

/// Loescht alle aktuell gefundenen verwaisten Sidecars und raeumt kaputte
/// Papierkorb-Eintraege aus dem Index (die Datei ist da eh schon weg, nur
/// der Eintrag verwaist). Scannt intern nochmal frisch statt sich auf einen
/// vorherigen health_check()-Aufruf zu verlassen - zwischen Anzeigen und
/// Klick auf "Bereinigen" koennte sich sonst etwas geaendert haben.
#[tauri::command]
pub fn health_check_cleanup(state: tauri::State<AppState>) -> Result<HealthCleanupResult, String> {
    let report = health_check_inner(&state);

    let mut removed_sidecars = 0usize;
    for s in &report.orphaned_sidecars {
        let path = state.music_root.join(&s.playlist).join(&s.filename);
        if std::fs::remove_file(&path).is_ok() {
            removed_sidecars += 1;
        }
    }

    let mut removed_trash_entries = 0usize;
    if !report.broken_trash_entries.is_empty() {
        let broken_ids: HashSet<&str> = report.broken_trash_entries.iter().map(|e| e.id.as_str()).collect();
        let mut entries = crate::trash::load_index(&state.trash_index_file);
        let before = entries.len();
        entries.retain(|e| !broken_ids.contains(e.id.as_str()));
        removed_trash_entries = before - entries.len();
        crate::trash::save_index(&state.trash_index_file, &entries);
    }

    Ok(HealthCleanupResult { removed_sidecars, removed_trash_entries })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir() -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("mm_health_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn finds_sidecar_without_matching_track() {
        let dir = temp_dir();
        std::fs::write(dir.join("Orphan.jpg"), b"x").unwrap();

        let found = find_orphaned_sidecars_in(&dir, "MyPlaylist");

        assert_eq!(found.len(), 1);
        assert_eq!(found[0].filename, "Orphan.jpg");
        assert_eq!(found[0].playlist, "MyPlaylist");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn ignores_sidecar_with_matching_track() {
        let dir = temp_dir();
        std::fs::write(dir.join("Song.mp3"), b"x").unwrap();
        std::fs::write(dir.join("Song.jpg"), b"x").unwrap();
        std::fs::write(dir.join("Song.lyrics.json"), b"x").unwrap();

        let found = find_orphaned_sidecars_in(&dir, "MyPlaylist");

        assert!(found.is_empty());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn distinguishes_cover_cache_suffix_from_plain_jpg() {
        let dir = temp_dir();
        std::fs::write(dir.join("Song.m4a"), b"x").unwrap();
        // .cover_cache.jpg gehoert zu "Song" (Track existiert -> kein Waisenkind).
        std::fs::write(dir.join("Song.cover_cache.jpg"), b"x").unwrap();
        // Ein zweites, komplett unabhaengiges .jpg ohne Track dazu.
        std::fs::write(dir.join("Leftover.jpg"), b"x").unwrap();

        let found = find_orphaned_sidecars_in(&dir, "MyPlaylist");

        assert_eq!(found.len(), 1);
        assert_eq!(found[0].filename, "Leftover.jpg");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn ignores_non_sidecar_files() {
        let dir = temp_dir();
        std::fs::write(dir.join("random.txt"), b"x").unwrap();

        let found = find_orphaned_sidecars_in(&dir, "MyPlaylist");

        assert!(found.is_empty());
        std::fs::remove_dir_all(&dir).ok();
    }
}
