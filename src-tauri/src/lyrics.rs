use serde::Serialize;

#[derive(Serialize, Clone)]
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
