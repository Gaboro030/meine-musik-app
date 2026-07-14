use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct LyricsResult {
    pub title: String,
    pub artist: String,
    pub lyrics: String,
    pub synced: Option<String>,
    pub found: bool,
}

const LRCLIB_GET: &str = "https://lrclib.net/api/get";
const LRCLIB_SEARCH: &str = "https://lrclib.net/api/search";

fn str_field(v: &serde_json::Value, key: &str) -> Option<String> {
    v.get(key)
        .and_then(|x| x.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
}

async fn lrclib_get(
    client: &reqwest::Client,
    title: &str,
    artist: &str,
    duration: Option<f64>,
) -> (Option<String>, Option<String>) {
    let mut params = vec![
        ("track_name".to_string(), title.to_string()),
        ("artist_name".to_string(), artist.to_string()),
    ];
    if let Some(d) = duration {
        params.push(("duration".to_string(), (d as i64).to_string()));
    }
    let Ok(resp) = client.get(LRCLIB_GET).query(&params).send().await else {
        return (None, None);
    };
    if !resp.status().is_success() {
        return (None, None);
    }
    let Ok(data) = resp.json::<serde_json::Value>().await else {
        return (None, None);
    };
    (str_field(&data, "syncedLyrics"), str_field(&data, "plainLyrics"))
}

async fn lrclib_search(
    client: &reqwest::Client,
    title: &str,
    artist: &str,
) -> (Option<String>, Option<String>) {
    let q = format!("{artist} {title}");
    let Ok(resp) = client.get(LRCLIB_SEARCH).query(&[("q", q)]).send().await else {
        return (None, None);
    };
    if !resp.status().is_success() {
        return (None, None);
    }
    let Ok(items) = resp.json::<Vec<serde_json::Value>>().await else {
        return (None, None);
    };
    match items.first() {
        Some(item) => (str_field(item, "syncedLyrics"), str_field(item, "plainLyrics")),
        None => (None, None),
    }
}

async fn lyrics_ovh(client: &reqwest::Client, title: &str, artist: &str) -> Option<String> {
    let enc = |s: &str| percent_encoding::utf8_percent_encode(s, percent_encoding::NON_ALPHANUMERIC).to_string();
    let url = format!("https://api.lyrics.ovh/v1/{}/{}", enc(artist), enc(title));
    let resp = client.get(&url).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let data: serde_json::Value = resp.json().await.ok()?;
    str_field(&data, "lyrics")
}

/// Best-effort lyrics lookup, mirroring the old Flask /api/lyrics: lrclib
/// first (time-synced LRC, used for karaoke-style highlighting), falling
/// back to lrclib's fuzzy search, then lyrics.ovh's plain text as a last
/// resort. Both are free/keyless, fixed hosts - no SSRF concern since
/// title/artist only ever end up as query params or URL-encoded path
/// segments, never as a raw URL passed through.
#[tauri::command]
pub async fn fetch_lyrics(
    title: String,
    artist: String,
    duration: Option<f64>,
) -> Result<LyricsResult, String> {
    if title.trim().is_empty() {
        return Err("Titel fehlt.".into());
    }
    let client = reqwest::Client::builder()
        .user_agent("meine-musik/0.1 (+https://github.com/Gaboro030/meine-musik-app)")
        .build()
        .map_err(|e| e.to_string())?;

    let (mut synced, mut plain) = lrclib_get(&client, &title, &artist, duration).await;
    if synced.is_none() && plain.is_none() {
        let (s2, p2) = lrclib_search(&client, &title, &artist).await;
        synced = s2;
        plain = p2;
    }
    if plain.is_none() {
        plain = lyrics_ovh(&client, &title, &artist).await;
    }

    if synced.is_some() || plain.is_some() {
        Ok(LyricsResult {
            title,
            artist,
            lyrics: plain.unwrap_or_default(),
            synced,
            found: true,
        })
    } else {
        Ok(LyricsResult {
            lyrics: format!("{title}\n\nKeine Lyrics gefunden."),
            title,
            artist,
            synced: None,
            found: false,
        })
    }
}

/// `<file>.lyrics.json` next to the track itself - same sidecar convention
/// innertube.rs already uses for cover art (.jpg) and artist (.artist.txt)
/// on Android downloads. Ties the cache to the actual file on disk instead
/// of a browser-storage key, so it survives reinstalls and travels with
/// the track if it's ever moved via Handy-Sync.
fn lyrics_sidecar_path(music_root: &std::path::Path, playlist: &str, file: &str) -> Option<std::path::PathBuf> {
    if file.is_empty() {
        return None;
    }
    let rel = format!("{}/{}", crate::commands::safe_filename(playlist), file);
    crate::commands::safe_join(music_root, &rel)
        .ok()
        .map(|p| p.with_extension("lyrics.json"))
}

/// Same lookup as fetch_lyrics, but file-cached: a track whose lyrics were
/// ever looked up before (on THIS device or prefetched right after a
/// download) resolves straight from disk with zero network requests.
/// `playlist`/`file` are optional (empty when playing a not-yet-downloaded
/// guest-queue entry) - lookups still work then, just without caching.
#[tauri::command]
pub async fn get_lyrics_cached(
    state: tauri::State<'_, crate::commands::AppState>,
    playlist: String,
    file: String,
    title: String,
    artist: String,
    duration: Option<f64>,
) -> Result<LyricsResult, String> {
    let sidecar = lyrics_sidecar_path(&state.music_root, &playlist, &file);
    if let Some(path) = &sidecar {
        if let Ok(text) = std::fs::read_to_string(path) {
            if let Ok(cached) = serde_json::from_str::<LyricsResult>(&text) {
                return Ok(cached);
            }
        }
    }
    let result = fetch_lyrics(title, artist, duration).await?;
    if let Some(path) = &sidecar {
        if let Ok(json) = serde_json::to_string(&result) {
            let _ = std::fs::write(path, json);
        }
    }
    Ok(result)
}
