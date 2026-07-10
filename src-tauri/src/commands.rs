use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use id3::TagLike;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::http::{header, Response, StatusCode};
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};

pub struct AppState {
    pub music_root: PathBuf,
    pub trash_dir: PathBuf,
    pub trash_index_file: PathBuf,
}

/// music_root/<playlist>/*.mp3 on disk IS the library - no separate JSON
/// index to fall out of sync with reality, same model the old Flask
/// backend used (scan_library() walked LIBRARY_DIR fresh on every call).
static LIBRARY_LOCK: Mutex<()> = Mutex::new(());

#[derive(Serialize, Clone, Default)]
pub struct TrackMeta {
    pub file: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: Option<f64>,
    pub cover: Option<String>,
    // player.js is the verbatim Flask frontend and reads these two straight
    // off each track object: stream_url feeds <audio>.src, added drives the
    // Home screen's "Zuletzt hinzugefügt" sort.
    pub stream_url: String,
    pub added: f64,
}

/// Platform-correct URL for the custom "stream" protocol registered in
/// lib.rs. Tauri serves custom protocols as `<scheme>://localhost/` on
/// macOS/Linux but as `http://<scheme>.localhost/` on Windows and Android
/// (WebView2/Android WebView don't allow arbitrary schemes in http
/// contexts) - hardcoding one form breaks playback on the other platforms.
fn stream_url_for(playlist: &str, file: &str) -> String {
    let enc =
        |s: &str| percent_encoding::utf8_percent_encode(s, percent_encoding::NON_ALPHANUMERIC).to_string();
    if cfg!(any(windows, target_os = "android")) {
        format!("http://stream.localhost/{}/{}", enc(playlist), enc(file))
    } else {
        format!("stream://localhost/{}/{}", enc(playlist), enc(file))
    }
}

#[derive(Serialize, Clone, Default)]
pub struct PlaylistOut {
    pub name: String,
    pub tracks: Vec<TrackMeta>,
    pub cover: Option<String>,
}

/// Path Traversal guard used by every filesystem command: canonicalize the
/// candidate's PARENT dir (the file itself may not exist yet, e.g. a new
/// download target) and verify it is still inside `root` afterward. A
/// "../../" anywhere in `rel` canonicalizes outside `root` and is rejected
/// here, before any read/write ever touches disk - mirrors the
/// realpath()+commonpath() check the previous Flask backend used.
pub(crate) fn safe_join(root: &Path, rel: &str) -> Result<PathBuf, String> {
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

/// Turn an arbitrary playlist/track name into a filesystem-safe path
/// component - mirrors the old Flask safe_filename(): strips path
/// separators and other characters that could otherwise be combined with
/// safe_join()'s checks in surprising ways, caps length.
pub(crate) fn safe_filename(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| if r#"\/:*?"<>|"#.contains(c) { '_' } else { c })
        .collect();
    let trimmed = cleaned.trim();
    let capped: String = trimmed.chars().take(180).collect();
    if capped.is_empty() {
        "track".to_string()
    } else {
        capped
    }
}

fn read_track_meta(path: &Path) -> TrackMeta {
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let fallback_title = path
        .file_stem()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| file_name.clone());

    let mut meta = TrackMeta {
        file: file_name,
        title: fallback_title,
        ..Default::default()
    };

    // Best-effort: a track with no/corrupt ID3 tags still shows up with its
    // filename as the title, same as the old Flask _read_track_tags().
    if let Ok(tag) = id3::Tag::read_from_path(path) {
        if let Some(title) = tag.title() {
            meta.title = title.to_string();
        }
        if let Some(artist) = tag.artist() {
            meta.artist = artist.to_string();
        }
        if let Some(album) = tag.album() {
            meta.album = album.to_string();
        }
        if let Some(pic) = tag.pictures().next() {
            let encoded = BASE64.encode(&pic.data);
            meta.cover = Some(format!("data:{};base64,{}", pic.mime_type, encoded));
        }
    }
    // id3 only reads tags, not audio structure - mp3-duration walks the
    // actual MP3 frames for the real playing time (what mutagen's
    // audio.info.length did in the Flask backend).
    meta.duration = mp3_duration::from_path(path).ok().map(|d| d.as_secs_f64());
    meta.added = std::fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0);
    meta
}

fn scan_playlist_dir(dir: &Path, name: &str) -> Option<PlaylistOut> {
    if !dir.is_dir() {
        return None;
    }
    let mut tracks: Vec<TrackMeta> = std::fs::read_dir(dir)
        .ok()?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.extension()
                .and_then(|e| e.to_str())
                .map(|e| e.eq_ignore_ascii_case("mp3"))
                .unwrap_or(false)
        })
        .map(|p| {
            let mut meta = read_track_meta(&p);
            meta.stream_url = stream_url_for(name, &meta.file);
            meta
        })
        .collect();
    tracks.sort_by(|a, b| a.file.to_lowercase().cmp(&b.file.to_lowercase()));
    if tracks.is_empty() {
        return None;
    }
    let cover = tracks.iter().find_map(|t| t.cover.clone());
    Some(PlaylistOut {
        name: name.to_string(),
        tracks,
        cover,
    })
}

pub(crate) fn list_playlists_inner(root: &Path) -> Vec<PlaylistOut> {
    if !root.is_dir() {
        return vec![];
    }
    let mut out = Vec::new();
    let Ok(entries) = std::fs::read_dir(root) else { return vec![]; };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if let Some(pl) = scan_playlist_dir(&path, &name) {
            out.push(pl);
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    out
}

#[tauri::command]
pub fn list_playlists(state: tauri::State<AppState>) -> Result<Vec<PlaylistOut>, String> {
    let _lock = LIBRARY_LOCK.lock().unwrap();
    Ok(list_playlists_inner(&state.music_root))
}

#[tauri::command]
pub fn create_playlist(state: tauri::State<AppState>, name: String) -> Result<(), String> {
    let clean = safe_filename(&name);
    let _lock = LIBRARY_LOCK.lock().unwrap();
    let dir = safe_join(&state.music_root, &clean)?;
    std::fs::create_dir_all(dir.parent().unwrap_or(&state.music_root).join(&clean))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn rename_playlist(
    state: tauri::State<AppState>,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    let new_clean = safe_filename(&new_name);
    if new_clean.is_empty() {
        return Err("Neuer Name fehlt.".into());
    }
    let _lock = LIBRARY_LOCK.lock().unwrap();
    let old_dir = safe_join(&state.music_root, &old_name)?;
    let new_dir = safe_join(&state.music_root, &new_clean)?;
    if !old_dir.is_dir() {
        return Err("Playlist nicht gefunden.".into());
    }
    if new_dir.exists() {
        return Err("Es gibt schon eine Playlist mit diesem Namen.".into());
    }
    std::fs::rename(&old_dir, &new_dir).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_playlist(state: tauri::State<AppState>, name: String) -> Result<(), String> {
    let _lock = LIBRARY_LOCK.lock().unwrap();
    let dir = safe_join(&state.music_root, &name)?;
    if !dir.is_dir() {
        return Err("Playlist nicht gefunden.".into());
    }
    std::fs::remove_dir_all(&dir).map_err(|e| e.to_string())
}

/// Moves the track to the trash instead of unlinking it outright - same
/// "soft delete, undoable" behavior the old Flask backend had (Papierkorb
/// tab lists these, restore/delete-forever are separate commands in
/// trash.rs).
#[tauri::command]
pub fn remove_track_from_playlist(
    state: tauri::State<AppState>,
    playlist_name: String,
    filename: String,
) -> Result<(), String> {
    let _lock = LIBRARY_LOCK.lock().unwrap();
    let playlist_dir = safe_join(&state.music_root, &playlist_name)?
        .parent()
        .unwrap()
        .join(safe_filename(&playlist_name));
    let path = safe_join(&playlist_dir, &filename)?;
    if !path.is_file() {
        return Err("Datei nicht gefunden.".into());
    }
    crate::trash::move_to_trash(&state, &playlist_name, &filename, &path)?;
    if std::fs::read_dir(&playlist_dir)
        .map(|mut d| d.next().is_none())
        .unwrap_or(false)
    {
        let _ = std::fs::remove_dir(&playlist_dir);
    }
    Ok(())
}

/// Add one track to a (new or existing) playlist. Two modes, same as the
/// old Flask /api/playlists/add-track route:
/// - already local (source_playlist + filename): copies the file, no
///   re-download needed.
/// - not yet downloaded (video_id + title): caller downloads first via
///   download_track(), then calls this to also register it - kept as two
///   separate commands here since Tauri commands are simple RPCs, easier
///   to reason about than one command branching on optional fields.
#[tauri::command]
pub fn add_track_to_playlist(
    state: tauri::State<AppState>,
    source_playlist: String,
    filename: String,
    target_playlist: String,
) -> Result<(), String> {
    let target_clean = safe_filename(&target_playlist);
    if target_clean.is_empty() {
        return Err("Ziel-Playlist fehlt.".into());
    }
    let _lock = LIBRARY_LOCK.lock().unwrap();

    let source_dir = safe_join(&state.music_root, &safe_filename(&source_playlist))?;
    let src_path = safe_join(&source_dir, &filename)?;
    if !src_path.is_file() {
        return Err("Titel nicht gefunden.".into());
    }

    let target_dir = safe_join(&state.music_root, &target_clean)?;
    std::fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

    let base = safe_filename(
        &src_path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default(),
    );
    let mut dest = target_dir.join(format!("{base}.mp3"));
    let mut n = 2;
    while dest.exists() {
        if dest.canonicalize().ok() == src_path.canonicalize().ok() {
            return Err("Titel ist schon in dieser Playlist.".into());
        }
        dest = target_dir.join(format!("{base} ({n}).mp3"));
        n += 1;
    }
    std::fs::copy(&src_path, &dest).map_err(|e| e.to_string())?;
    Ok(())
}

/// Writes raw bytes (from a browser <input type=file> drag/drop, read
/// client-side via File.arrayBuffer()) straight into a playlist folder -
/// the "add local MP3s" flow, since there's no separate Downloader page in
/// this rewrite yet.
#[tauri::command]
pub fn upload_track(
    state: tauri::State<AppState>,
    playlist_name: String,
    filename: String,
    data: Vec<u8>,
) -> Result<(), String> {
    if !filename.to_lowercase().ends_with(".mp3") {
        return Err("Nur MP3-Dateien werden unterstuetzt.".into());
    }
    let _lock = LIBRARY_LOCK.lock().unwrap();
    let clean_playlist = safe_filename(&playlist_name);
    let dir = state.music_root.join(&clean_playlist);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let base = safe_filename(
        &Path::new(&filename)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default(),
    );
    let mut dest = safe_join(&state.music_root, &format!("{clean_playlist}/{base}.mp3"))?;
    let mut n = 2;
    while dest.exists() {
        dest = safe_join(
            &state.music_root,
            &format!("{clean_playlist}/{base} ({n}).mp3"),
        )?;
        n += 1;
    }
    std::fs::write(&dest, data).map_err(|e| e.to_string())
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
// Desktop only - see README, yt-dlp has no official Android/ARM builds.
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

    let clean_playlist = safe_filename(&playlist_name);
    let dest_dir = state.music_root.join(&clean_playlist);
    std::fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
    let safe_title = safe_filename(&title);
    let out_path = dest_dir.join(format!("{safe_title}.%(ext)s"));

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

/// Same download as above, but streams live percentage back to the
/// frontend as Tauri events (`dl-progress-<task_id>`) instead of just
/// resolving at the end - the downloader UI's per-track/batch progress
/// bars are wired to this. There's no server here to hold an SSE
/// connection open like the old Flask /api/download-progress route did,
/// so Tauri's own event bus does the same job: this parses yt-dlp's own
/// `--newline` progress output (e.g. "[download]  45.2% of ...") line by
/// line as it downloads and re-emits each percentage.
///
/// `uploader`/`duration`/`thumbnail`/`prefer_audio` are accepted for UI
/// parity with the old Flask endpoint (which used them to look up a
/// cleaner "- Topic" / YT Music catalog match) but aren't used for any
/// matching here - there's no ytmusicapi equivalent in Rust, so this
/// always just downloads the given video_id directly.
#[tauri::command]
pub async fn download_track_progress(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    task_id: String,
    video_id: String,
    title: String,
    _uploader: String,
    _duration: Option<f64>,
    _thumbnail: Option<String>,
    bitrate: String,
    format: String,
    quality: String,
    _prefer_audio: bool,
    playlist_name: String,
) -> Result<(), String> {
    use tauri::Emitter;
    use tauri_plugin_shell::process::CommandEvent;
    use tauri_plugin_shell::ShellExt;

    if !video_id.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-')
        || video_id.len() < 6
        || video_id.len() > 20
    {
        return Err("Ungueltige Video-ID.".into());
    }

    let clean_playlist = safe_filename(&playlist_name);
    let dest_dir = state.music_root.join(&clean_playlist);
    std::fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
    let safe_title = safe_filename(&title);
    let out_template = dest_dir.join(format!("{safe_title}.%(ext)s"));

    let mut args: Vec<String> = vec!["--newline".into(), "-o".into(), out_template.to_string_lossy().to_string()];
    if format == "mp4" {
        let cap = if quality != "best" { format!("[height<=?{quality}]") } else { String::new() };
        args.push("-f".into());
        args.push(format!("bv*{cap}+ba/b{cap}"));
        args.push("--merge-output-format".into());
        args.push("mp4".into());
    } else {
        args.push("-f".into());
        args.push("bestaudio/best".into());
        args.push("-x".into());
        args.push("--audio-format".into());
        args.push("mp3".into());
        args.push("--audio-quality".into());
        args.push(format!("{bitrate}K"));
    }
    args.push(format!("https://www.youtube.com/watch?v={video_id}"));

    let shell = app.shell();
    let (mut rx, _child) = shell
        .sidecar("yt-dlp")
        .map_err(|e| e.to_string())?
        .args(args)
        .spawn()
        .map_err(|e| e.to_string())?;

    let progress_re = regex::Regex::new(r"([\d.]+)%").unwrap();
    let event_name = format!("dl-progress-{task_id}");
    let mut last_err: Option<String> = None;

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(bytes) | CommandEvent::Stderr(bytes) => {
                let line = String::from_utf8_lossy(&bytes);
                if let Some(caps) = progress_re.captures(&line) {
                    if let Ok(pct) = caps[1].parse::<f64>() {
                        let phase = if line.contains("ExtractAudio") || line.contains("Merger") || line.contains("VideoConvertor") {
                            "converting"
                        } else {
                            "downloading"
                        };
                        let _ = app.emit(&event_name, serde_json::json!({ "percent": pct, "phase": phase }));
                    }
                }
            }
            CommandEvent::Error(e) => last_err = Some(e),
            CommandEvent::Terminated(status) => {
                if status.code != Some(0) {
                    last_err.get_or_insert_with(|| format!("yt-dlp beendet mit Code {:?}", status.code));
                }
            }
            _ => {}
        }
    }
    if let Some(e) = last_err {
        return Err(e);
    }

    let ext = if format == "mp4" { "mp4" } else { "mp3" };
    let out_path = dest_dir.join(format!("{safe_title}.{ext}"));
    if !out_path.is_file() {
        return Err("Download fehlgeschlagen (Datei nicht gefunden).".into());
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
    // ACAO is required: on Windows/Android the webview page lives on
    // http://tauri.localhost while streams come from http://stream.localhost
    // - cross-origin. player.js pipes the <audio> element through a Web
    // Audio graph (equalizer/fade via createMediaElementSource), and
    // cross-origin media WITHOUT CORS approval gets tainted there, which
    // plays back as pure silence. The <audio> tag carries
    // crossorigin="anonymous" to match.
    let mut builder = Response::builder()
        .status(if is_partial { StatusCode::PARTIAL_CONTENT } else { StatusCode::OK })
        .header(header::CONTENT_TYPE, mime.as_ref())
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
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
