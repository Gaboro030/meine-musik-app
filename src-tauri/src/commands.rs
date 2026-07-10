use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::http::{header, Response, StatusCode};
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};

pub struct AppState {
    pub music_root: PathBuf,
    pub playlists_file: PathBuf,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Playlist {
    pub name: String,
    pub tracks: Vec<String>,
}

type PlaylistMap = HashMap<String, Playlist>;
static PLAYLIST_LOCK: Mutex<()> = Mutex::new(());

fn load_playlists(file: &Path) -> PlaylistMap {
    std::fs::read_to_string(file)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_playlists(file: &Path, map: &PlaylistMap) {
    if let Ok(s) = serde_json::to_string_pretty(map) {
        let _ = std::fs::write(file, s);
    }
}

/// Path Traversal guard used by every filesystem command: canonicalize the
/// candidate's PARENT dir (the file itself may not exist yet, e.g. a new
/// download target) and verify it is still inside `root` afterward. A
/// "../../" anywhere in `rel` canonicalizes outside `root` and is rejected
/// here, before any read/write ever touches disk - mirrors the
/// realpath()+commonpath() check the previous Flask backend used.
fn safe_join(root: &Path, rel: &str) -> Result<PathBuf, String> {
    if rel.is_empty() {
        return Err("Leerer Pfad".into());
    }
    let candidate = root.join(rel);
    let parent = candidate.parent().unwrap_or(root);
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;

    let canon_root = root
        .canonicalize()
        .map_err(|e| format!("Musik-Ordner nicht lesbar: {e}"))?;
    let canon_parent = parent
        .canonicalize()
        .map_err(|_| "Ungueltiger Pfad".to_string())?;

    if !canon_parent.starts_with(&canon_root) {
        return Err("Ungueltiger Pfad (Path Traversal geblockt)".into());
    }
    Ok(canon_parent.join(candidate.file_name().ok_or("Ungueltiger Dateiname")?))
}

#[tauri::command]
pub fn list_playlists(state: tauri::State<AppState>) -> Result<Vec<Playlist>, String> {
    let _lock = PLAYLIST_LOCK.lock().unwrap();
    Ok(load_playlists(&state.playlists_file).into_values().collect())
}

#[tauri::command]
pub fn add_track_to_playlist(
    state: tauri::State<AppState>,
    playlist_name: String,
    filename: String,
) -> Result<(), String> {
    // Confirms both playlist_name and filename resolve inside music_root
    // before the JSON index is ever touched.
    safe_join(&state.music_root, &format!("{playlist_name}/{filename}"))?;
    let _lock = PLAYLIST_LOCK.lock().unwrap();
    let mut map = load_playlists(&state.playlists_file);
    let entry = map.entry(playlist_name.clone()).or_insert_with(|| Playlist {
        name: playlist_name,
        tracks: vec![],
    });
    if !entry.tracks.contains(&filename) {
        entry.tracks.push(filename);
    } else {
        return Err("Titel ist schon in dieser Playlist.".into());
    }
    save_playlists(&state.playlists_file, &map);
    Ok(())
}

#[tauri::command]
pub fn remove_track_from_playlist(
    state: tauri::State<AppState>,
    playlist_name: String,
    filename: String,
) -> Result<(), String> {
    let _lock = PLAYLIST_LOCK.lock().unwrap();
    let mut map = load_playlists(&state.playlists_file);
    if let Some(pl) = map.get_mut(&playlist_name) {
        pl.tracks.retain(|f| f != &filename);
    }
    save_playlists(&state.playlists_file, &map);
    Ok(())
}

#[tauri::command]
pub fn create_playlist(state: tauri::State<AppState>, name: String) -> Result<(), String> {
    let clean = name.trim();
    if clean.is_empty() {
        return Err("Name fehlt.".into());
    }
    let _lock = PLAYLIST_LOCK.lock().unwrap();
    let mut map = load_playlists(&state.playlists_file);
    map.entry(clean.to_string()).or_insert_with(|| Playlist {
        name: clean.to_string(),
        tracks: vec![],
    });
    save_playlists(&state.playlists_file, &map);
    Ok(())
}

// --- SSRF guard: thumbnail fetch ------------------------------------------
// Same allowlist the Flask backend used (_is_safe_thumbnail_url /
// _ALLOWED_THUMBNAIL_HOST_SUFFIXES) - only real YouTube/Google/Spotify CDN
// hosts may be fetched. Anything else (internal IPs, cloud metadata
// endpoints, arbitrary attacker hosts) is rejected before reqwest ever
// makes the request.
const ALLOWED_THUMBNAIL_SUFFIXES: &[&str] = &[
    "ytimg.com",
    "googleusercontent.com",
    "ggpht.com",
    "scdn.co",
];

fn is_safe_thumbnail_url(raw: &str) -> bool {
    let Ok(parsed) = url::Url::parse(raw) else {
        return false;
    };
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return false;
    }
    let Some(host) = parsed.host_str() else {
        return false;
    };
    let host = host.to_lowercase();
    ALLOWED_THUMBNAIL_SUFFIXES
        .iter()
        .any(|suf| host == *suf || host.ends_with(&format!(".{suf}")))
}

#[tauri::command]
pub async fn fetch_thumbnail(url: String) -> Result<Vec<u8>, String> {
    if !is_safe_thumbnail_url(&url) {
        return Err("Thumbnail-Host nicht erlaubt (SSRF-Schutz).".into());
    }
    let resp = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Thumbnail-Download fehlgeschlagen: {}", resp.status()));
    }
    resp.bytes()
        .await
        .map(|b| b.to_vec())
        .map_err(|e| e.to_string())
}

// --- YouTube download: shell out to yt-dlp --------------------------------
// No mature Rust equivalent of yt-dlp/ytmusicapi exists - re-implementing a
// YouTube extractor in Rust is its own multi-year project. The pragmatic,
// still-fully-native-app choice is to bundle the yt-dlp + ffmpeg binaries
// as Tauri sidecars and drive them from Rust via tauri-plugin-shell, same
// division of labor the old Flask backend had (Python called out to the
// yt-dlp *library*, this calls the yt-dlp *binary* - same underlying tool).
#[tauri::command]
pub async fn download_track(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    video_id: String,
    playlist_name: String,
    title: String,
) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;

    if !video_id.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-')
        || video_id.len() < 6
        || video_id.len() > 20
    {
        return Err("Ungueltige Video-ID.".into());
    }

    let dest_dir = safe_join(&state.music_root, &playlist_name)?
        .parent()
        .unwrap()
        .to_path_buf();
    std::fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
    let out_path = dest_dir.join(format!("{title}.%(ext)s"));

    let shell = app.shell();
    let output = shell
        .sidecar("yt-dlp")
        .map_err(|e| e.to_string())?
        .args([
            "-f", "bestaudio",
            "-x", "--audio-format", "mp3",
            "-o", out_path.to_string_lossy().as_ref(),
            &format!("https://www.youtube.com/watch?v={video_id}"),
        ])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(())
}

// --- Local streaming with byte-range support ------------------------------
// Registered as the "stream://" custom protocol in main.rs. Handles
// `Range: bytes=start-end` for scrubbing and returns 206 Partial Content,
// same contract the old Flask send_file(..., conditional=True) had.
pub async fn stream_file(
    root: &Path,
    rel_path: &str,
    range_header: Option<String>,
) -> Response<Vec<u8>> {
    let decoded = percent_encoding::percent_decode_str(rel_path)
        .decode_utf8_lossy()
        .to_string();

    let path = match safe_join(root, &decoded) {
        Ok(p) => p,
        Err(e) => return error_response(StatusCode::FORBIDDEN, &e),
    };

    let mut file = match File::open(&path).await {
        Ok(f) => f,
        Err(_) => return error_response(StatusCode::NOT_FOUND, "Datei nicht gefunden."),
    };
    let len = match file.metadata().await {
        Ok(m) => m.len(),
        Err(e) => return error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    };

    let mime = mime_guess::from_path(&path).first_or_octet_stream();

    let (start, end) = match range_header.as_deref().and_then(parse_range) {
        Some((s, e)) => (s, e.min(len.saturating_sub(1))),
        None => (0, len.saturating_sub(1)),
    };
    if start >= len || start > end {
        return Response::builder()
            .status(StatusCode::RANGE_NOT_SATISFIABLE)
            .header(header::CONTENT_RANGE, format!("bytes */{len}"))
            .body(Vec::new())
            .unwrap();
    }

    let chunk_len = (end - start + 1) as usize;
    let mut buf = vec![0u8; chunk_len];
    if file.seek(SeekFrom::Start(start)).await.is_err()
        || file.read_exact(&mut buf).await.is_err()
    {
        return error_response(StatusCode::INTERNAL_SERVER_ERROR, "Lesefehler.");
    }

    let is_partial = range_header.is_some();
    let mut builder = Response::builder()
        .status(if is_partial { StatusCode::PARTIAL_CONTENT } else { StatusCode::OK })
        .header(header::CONTENT_TYPE, mime.as_ref())
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CONTENT_LENGTH, chunk_len.to_string());
    if is_partial {
        builder = builder.header(header::CONTENT_RANGE, format!("bytes {start}-{end}/{len}"));
    }
    builder.body(buf).unwrap()
}

fn parse_range(header: &str) -> Option<(u64, u64)> {
    let spec = header.strip_prefix("bytes=")?;
    let (start_s, end_s) = spec.split_once('-')?;
    let start: u64 = start_s.parse().ok()?;
    let end: u64 = if end_s.is_empty() {
        u64::MAX
    } else {
        end_s.parse().ok()?
    };
    Some((start, end))
}

fn error_response(status: StatusCode, msg: &str) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "text/plain")
        .body(msg.as_bytes().to_vec())
        .unwrap()
}
