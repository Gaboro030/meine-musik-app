use crate::discovery::{audio_preference_score, is_bad_variant, yt_search};
use regex::Regex;
use serde::Serialize;
use std::sync::OnceLock;
use tauri_plugin_shell::ShellExt;

#[derive(Serialize, Clone)]
pub struct PlaylistTrack {
    pub id: String,
    pub title: String,
    pub uploader: String,
    pub duration: Option<f64>,
    pub thumbnail: Option<String>,
    pub url: String,
}

#[derive(Serialize, Clone)]
pub struct PlaylistExtract {
    pub title: String,
    pub count: usize,
    pub entries: Vec<PlaylistTrack>,
    pub unmatched: Option<usize>,
}

/// Resolves a Spotify, YouTube, or YouTube Music link to a downloadable
/// track list. Spotify links go through the Spotify Web API + a YouTube
/// search match per track (no ytmusicapi in Rust - see README); YouTube
/// and YouTube Music links are handled directly by yt-dlp, which already
/// understands both domains natively.
#[tauri::command]
pub async fn resolve_playlist(app: tauri::AppHandle, url: String) -> Result<PlaylistExtract, String> {
    let url = url.trim();
    if url.is_empty() {
        return Err("Bitte eine Playlist- oder Video-URL angeben.".into());
    }
    let result = if is_spotify_url(url) {
        extract_spotify(&app, url).await?
    } else {
        extract_youtube(&app, url).await?
    };
    if result.entries.is_empty() {
        return Err("Keine Titel gefunden.".into());
    }
    Ok(result)
}

fn spotify_url_re() -> &'static Regex {
    static CELL: OnceLock<Regex> = OnceLock::new();
    CELL.get_or_init(|| {
        Regex::new(r"open\.spotify\.com/(?:intl-[a-zA-Z-]+/)?(playlist|track|album)/([A-Za-z0-9]+)|spotify:(playlist|track|album):([A-Za-z0-9]+)").unwrap()
    })
}
fn is_spotify_url(url: &str) -> bool {
    spotify_url_re().is_match(url)
}

/// YouTube / YouTube Music: yt-dlp's --flat-playlist understands both
/// domains and a lone video URL natively (a single video just comes back
/// as one JSON entry, no special-casing needed).
async fn extract_youtube(app: &tauri::AppHandle, url: &str) -> Result<PlaylistExtract, String> {
    // Android: kein yt-dlp-Binary - Playlist-Auflösung nativ über Innertube.
    if cfg!(target_os = "android") {
        return crate::innertube::extract(url).await;
    }
    let shell = app.shell();
    let output = shell
        .sidecar("yt-dlp")
        .map_err(|e| e.to_string())?
        .args(["--flat-playlist", "--dump-json", "--no-warnings", url])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(friendly_ytdlp_error(&String::from_utf8_lossy(&output.stderr)));
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let mut entries = Vec::new();
    let mut playlist_title: Option<String> = None;
    for line in text.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let Ok(v) = serde_json::from_str::<serde_json::Value>(line) else { continue };
        if playlist_title.is_none() {
            playlist_title = v
                .get("playlist_title")
                .and_then(|x| x.as_str())
                .map(|s| s.to_string());
        }
        let Some(id) = v.get("id").and_then(|x| x.as_str()) else { continue };
        let title = v.get("title").and_then(|x| x.as_str()).unwrap_or("Unknown title").to_string();
        let uploader = v
            .get("uploader")
            .or_else(|| v.get("channel"))
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        let duration = v.get("duration").and_then(|x| x.as_f64());
        let thumbnail = v
            .get("thumbnail")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string())
            .or_else(|| {
                v.get("thumbnails")
                    .and_then(|t| t.as_array())
                    .and_then(|a| a.last())
                    .and_then(|t| t.get("url"))
                    .and_then(|u| u.as_str())
                    .map(|s| s.to_string())
            });
        entries.push(PlaylistTrack {
            url: format!("https://www.youtube.com/watch?v={id}"),
            id: id.to_string(),
            title,
            uploader,
            duration,
            thumbnail,
        });
    }

    Ok(PlaylistExtract {
        title: playlist_title.unwrap_or_else(|| "Playlist".to_string()),
        count: entries.len(),
        entries,
        unmatched: None,
    })
}

fn friendly_ytdlp_error(stderr: &str) -> String {
    if stderr.contains("Sign in to confirm") || stderr.contains("not a bot") {
        return "YouTube blockiert die Anfrage (Bot-Schutz). Später erneut versuchen.".into();
    }
    if stderr.contains("Unsupported URL") {
        return "Dieser Link wird nicht erkannt.".into();
    }
    stderr.lines().last().unwrap_or("Playlist konnte nicht geladen werden.").to_string()
}

// --- Spotify ---------------------------------------------------------------
// Spotify never serves raw audio - only used as a metadata source (title/
// artist/album/cover/duration) via the public Client Credentials Web API,
// then each track is matched against YouTube search (yt_search) to find an
// actually downloadable video id.

async fn spotify_token(client: &reqwest::Client) -> Result<String, String> {
    let client_id = std::env::var("SPOTIFY_CLIENT_ID").map_err(|_| {
        "Spotify-Zugangsdaten fehlen. Kostenlosen Client anlegen unter developer.spotify.com/dashboard \
         und SPOTIFY_CLIENT_ID sowie SPOTIFY_CLIENT_SECRET als Umgebungsvariablen setzen, bevor die App gestartet wird."
            .to_string()
    })?;
    let client_secret = std::env::var("SPOTIFY_CLIENT_SECRET").map_err(|_| {
        "SPOTIFY_CLIENT_SECRET fehlt (siehe SPOTIFY_CLIENT_ID-Hinweis).".to_string()
    })?;

    use base64::{engine::general_purpose::STANDARD, Engine};
    let auth = STANDARD.encode(format!("{client_id}:{client_secret}"));
    let resp = client
        .post("https://accounts.spotify.com/api/token")
        .header("Authorization", format!("Basic {auth}"))
        .form(&[("grant_type", "client_credentials")])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err("Spotify-Anmeldung fehlgeschlagen (Zugangsdaten prüfen).".into());
    }
    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    data.get("access_token")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Spotify-Antwort ohne Token.".to_string())
}

struct SpotifyTrackInfo {
    title: String,
    artist: String,
    duration: Option<f64>,
}

fn parse_spotify_track(t: &serde_json::Value) -> SpotifyTrackInfo {
    let title = t.get("name").and_then(|x| x.as_str()).unwrap_or("Unknown title").to_string();
    let artist = t
        .get("artists")
        .and_then(|a| a.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
                .collect::<Vec<_>>()
                .join(", ")
        })
        .unwrap_or_default();
    let duration = t
        .get("duration_ms")
        .and_then(|x| x.as_f64())
        .map(|ms| ms / 1000.0);
    SpotifyTrackInfo { title, artist, duration }
}

async fn extract_spotify(app: &tauri::AppHandle, url: &str) -> Result<PlaylistExtract, String> {
    let caps = spotify_url_re().captures(url).ok_or_else(|| "Ungueltiger Spotify-Link.".to_string())?;
    let (kind, id) = if let Some(k) = caps.get(1) {
        (k.as_str(), caps.get(2).unwrap().as_str())
    } else {
        (caps.get(3).unwrap().as_str(), caps.get(4).unwrap().as_str())
    };

    let client = reqwest::Client::new();
    let token = spotify_token(&client).await?;
    let auth_header = format!("Bearer {token}");

    let mut spotify_tracks: Vec<SpotifyTrackInfo> = Vec::new();
    let mut playlist_title = "Spotify Playlist".to_string();

    match kind {
        "track" => {
            let resp = client
                .get(format!("https://api.spotify.com/v1/tracks/{id}"))
                .header("Authorization", &auth_header)
                .send()
                .await
                .map_err(|e| e.to_string())?;
            let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            playlist_title = data.get("name").and_then(|x| x.as_str()).unwrap_or(&playlist_title).to_string();
            spotify_tracks.push(parse_spotify_track(&data));
        }
        "album" => {
            let resp = client
                .get(format!("https://api.spotify.com/v1/albums/{id}"))
                .header("Authorization", &auth_header)
                .send()
                .await
                .map_err(|e| e.to_string())?;
            let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            playlist_title = data.get("name").and_then(|x| x.as_str()).unwrap_or(&playlist_title).to_string();
            if let Some(items) = data.get("tracks").and_then(|t| t.get("items")).and_then(|i| i.as_array()) {
                for t in items {
                    spotify_tracks.push(parse_spotify_track(t));
                }
            }
        }
        _ => {
            // playlist, with pagination via Spotify's own "next" links
            let mut next_url = Some(format!("https://api.spotify.com/v1/playlists/{id}"));
            let mut first = true;
            while let Some(u) = next_url.take() {
                let resp = client.get(&u).header("Authorization", &auth_header).send().await.map_err(|e| e.to_string())?;
                let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
                if first {
                    playlist_title = data.get("name").and_then(|x| x.as_str()).unwrap_or(&playlist_title).to_string();
                    first = false;
                }
                let tracks_page = if data.get("tracks").is_some() { data.get("tracks").unwrap().clone() } else { data.clone() };
                if let Some(items) = tracks_page.get("items").and_then(|i| i.as_array()) {
                    for item in items {
                        if let Some(t) = item.get("track") {
                            if !t.is_null() {
                                spotify_tracks.push(parse_spotify_track(t));
                            }
                        }
                    }
                }
                next_url = tracks_page.get("next").and_then(|x| x.as_str()).map(|s| s.to_string());
            }
        }
    }

    let mut entries = Vec::new();
    let mut unmatched = 0usize;
    for t in &spotify_tracks {
        let query = format!("{} {}", t.artist, t.title);
        let mut candidates: Vec<_> = yt_search(app, &query, 5)
            .await
            .unwrap_or_default()
            .into_iter()
            .filter(|r| !is_bad_variant(&format!("{} {}", r.title, r.artist)))
            .collect();
        // Prefer "- Topic" / plain-audio uploads over "Official Video" rips
        // (matches the studio master more closely, same as Spotify).
        candidates.sort_by_key(|r| audio_preference_score(&r.title, &r.artist));
        let best = candidates.into_iter().next();
        match best {
            Some(r) => entries.push(PlaylistTrack {
                id: r.video_id.clone(),
                title: t.title.clone(),
                uploader: t.artist.clone(),
                duration: t.duration,
                thumbnail: r.cover,
                url: r.url,
            }),
            None => unmatched += 1,
        }
    }

    Ok(PlaylistExtract {
        title: playlist_title,
        count: entries.len(),
        entries,
        unmatched: if unmatched > 0 { Some(unmatched) } else { None },
    })
}
