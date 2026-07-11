//! Native YouTube extraction over the Innertube API (what the official
//! Android app itself uses, and what NewPipe builds on) - no yt-dlp, no
//! ffmpeg, pure reqwest. This is the Android download path: yt-dlp ships
//! no Android/ARM binary, so search/playlist/download all go through here
//! on that platform. The ANDROID client profile is used deliberately -
//! its stream URLs come back directly playable, with no signature
//! deciphering step.
//!
//! Trade-off vs. the desktop yt-dlp path: no MP3 conversion (no ffmpeg on
//! the phone), so audio downloads land as `.m4a` (AAC), which Android's
//! WebView plays natively; video picks YouTube's pre-muxed MP4s (360p/720p).

use serde_json::{json, Value};
use std::path::Path;

const YT_API: &str = "https://www.youtube.com/youtubei/v1";
const ANDROID_KEY: &str = "AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w";
const CLIENT_VERSION: &str = "19.44.38";
const UA: &str = "com.google.android.youtube/19.44.38 (Linux; U; Android 14) gzip";

fn context() -> Value {
    json!({
        "client": {
            "clientName": "ANDROID",
            "clientVersion": CLIENT_VERSION,
            "androidSdkVersion": 34,
            "userAgent": UA,
            "hl": "de",
            "gl": "DE",
        }
    })
}

fn http() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(UA)
        .build()
        .unwrap_or_default()
}

async fn call(client: &reqwest::Client, endpoint: &str, mut body: Value) -> Result<Value, String> {
    body["context"] = context();
    let resp = client
        .post(format!("{YT_API}/{endpoint}?key={ANDROID_KEY}&prettyPrint=false"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("YouTube nicht erreichbar: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("YouTube-API-Fehler: {}", resp.status()));
    }
    resp.json().await.map_err(|e| e.to_string())
}

/// Innertube responses are deeply nested and their exact wrapper structure
/// shifts between client versions - instead of hardcoding paths, walk the
/// whole tree and collect every object stored under one of the wanted
/// renderer keys. Robust against layout reshuffles.
fn collect_renderers<'a>(v: &'a Value, keys: &[&str], out: &mut Vec<&'a Value>) {
    match v {
        Value::Object(map) => {
            for (k, val) in map {
                if keys.contains(&k.as_str()) {
                    out.push(val);
                }
                collect_renderers(val, keys, out);
            }
        }
        Value::Array(arr) => {
            for val in arr {
                collect_renderers(val, keys, out);
            }
        }
        _ => {}
    }
}

/// Text fields come as {"runs":[{"text":..}, ...]} or {"simpleText":..}.
fn text_of(v: &Value) -> Option<String> {
    if let Some(s) = v.get("simpleText").and_then(|x| x.as_str()) {
        return Some(s.to_string());
    }
    let runs = v.get("runs")?.as_array()?;
    let joined: String = runs
        .iter()
        .filter_map(|r| r.get("text").and_then(|t| t.as_str()))
        .collect();
    if joined.is_empty() { None } else { Some(joined) }
}

fn best_thumbnail(v: &Value) -> Option<String> {
    v.get("thumbnail")
        .and_then(|t| t.get("thumbnails"))
        .and_then(|t| t.as_array())
        .and_then(|a| a.last())
        .and_then(|t| t.get("url"))
        .and_then(|u| u.as_str())
        .map(|s| s.to_string())
}

/// "3:45" / "1:02:03" -> seconds
fn parse_length_text(s: &str) -> Option<f64> {
    let parts: Vec<u64> = s.split(':').map(|p| p.trim().parse().ok()).collect::<Option<_>>()?;
    let secs = parts.iter().fold(0u64, |acc, p| acc * 60 + p);
    Some(secs as f64)
}

fn renderer_to_track(r: &Value) -> Option<crate::discovery::OnlineTrack> {
    let id = r.get("videoId").and_then(|x| x.as_str())?;
    let title = r.get("title").and_then(text_of)
        .or_else(|| r.get("headline").and_then(text_of))?;
    let artist = ["ownerText", "shortBylineText", "longBylineText"]
        .iter()
        .find_map(|k| r.get(*k).and_then(text_of))
        .unwrap_or_default();
    let duration = r
        .get("lengthSeconds")
        .and_then(|x| x.as_str())
        .and_then(|s| s.parse::<f64>().ok())
        .or_else(|| r.get("lengthText").and_then(text_of).and_then(|s| parse_length_text(&s)));
    Some(crate::discovery::OnlineTrack {
        video_id: id.to_string(),
        title,
        artist,
        duration,
        cover: best_thumbnail(r).or_else(|| Some(format!("https://i.ytimg.com/vi/{id}/mqdefault.jpg"))),
        url: format!("https://www.youtube.com/watch?v={id}"),
    })
}

const VIDEO_RENDERER_KEYS: &[&str] = &[
    "videoRenderer",
    "compactVideoRenderer",
    "videoWithContextRenderer",
    "playlistVideoRenderer",
    "playlistPanelVideoRenderer",
];

pub async fn search(query: &str, limit: usize) -> Result<Vec<crate::discovery::OnlineTrack>, String> {
    let client = http();
    let data = call(&client, "search", json!({ "query": query })).await?;
    let mut nodes = Vec::new();
    collect_renderers(&data, VIDEO_RENDERER_KEYS, &mut nodes);
    let mut out = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for n in nodes {
        if let Some(t) = renderer_to_track(n) {
            if seen.insert(t.video_id.clone()) {
                out.push(t);
                if out.len() >= limit {
                    break;
                }
            }
        }
    }
    Ok(out)
}

fn parse_yt_url(url: &str) -> (Option<String>, Option<String>) {
    use regex::Regex;
    use std::sync::OnceLock;
    static LIST_RE: OnceLock<Regex> = OnceLock::new();
    static VID_RE: OnceLock<Regex> = OnceLock::new();
    let list_re = LIST_RE.get_or_init(|| Regex::new(r"[?&]list=([A-Za-z0-9_-]+)").unwrap());
    let vid_re = VID_RE.get_or_init(|| {
        Regex::new(r"(?:[?&]v=|youtu\.be/|/shorts/)([A-Za-z0-9_-]{6,})").unwrap()
    });
    (
        list_re.captures(url).map(|c| c[1].to_string()),
        vid_re.captures(url).map(|c| c[1].to_string()),
    )
}

/// YouTube/YT-Music playlist or single-video URL -> track list, same shape
/// the yt-dlp desktop path produces.
pub async fn extract(url: &str) -> Result<crate::playlist::PlaylistExtract, String> {
    let (list_id, video_id) = parse_yt_url(url);
    let client = http();

    if let Some(list_id) = list_id {
        let data = call(&client, "browse", json!({ "browseId": format!("VL{list_id}") })).await?;
        let mut nodes = Vec::new();
        collect_renderers(&data, VIDEO_RENDERER_KEYS, &mut nodes);
        let mut entries = Vec::new();
        let mut seen = std::collections::HashSet::new();
        for n in nodes {
            if let Some(t) = renderer_to_track(n) {
                if seen.insert(t.video_id.clone()) {
                    entries.push(crate::playlist::PlaylistTrack {
                        id: t.video_id,
                        title: t.title,
                        uploader: t.artist,
                        duration: t.duration,
                        thumbnail: t.cover,
                        url: t.url,
                    });
                }
            }
        }
        let title = data
            .pointer("/metadata/playlistMetadataRenderer/title")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string())
            .or_else(|| data.pointer("/header/playlistHeaderRenderer/title").and_then(text_of))
            .unwrap_or_else(|| "YouTube Playlist".to_string());
        return Ok(crate::playlist::PlaylistExtract {
            title,
            count: entries.len(),
            entries,
            unmatched: None,
        });
    }

    if let Some(video_id) = video_id {
        let data = call(&client, "player", json!({
            "videoId": video_id, "contentCheckOk": true, "racyCheckOk": true,
        }))
        .await?;
        let vd = &data["videoDetails"];
        let title = vd.get("title").and_then(|x| x.as_str()).unwrap_or("Unknown title").to_string();
        let uploader = vd.get("author").and_then(|x| x.as_str()).unwrap_or("").to_string();
        let duration = vd
            .get("lengthSeconds")
            .and_then(|x| x.as_str())
            .and_then(|s| s.parse::<f64>().ok());
        let thumbnail = best_thumbnail(vd)
            .or_else(|| Some(format!("https://i.ytimg.com/vi/{video_id}/mqdefault.jpg")));
        return Ok(crate::playlist::PlaylistExtract {
            title: title.clone(),
            count: 1,
            entries: vec![crate::playlist::PlaylistTrack {
                url: format!("https://www.youtube.com/watch?v={video_id}"),
                id: video_id,
                title,
                uploader,
                duration,
                thumbnail,
            }],
            unmatched: None,
        });
    }

    Err("Dieser Link wird nicht erkannt.".into())
}

struct StreamPick {
    url: String,
    ext: &'static str,
    thumbnail: Option<String>,
}

/// /player with the ANDROID client returns directly usable stream URLs.
/// Audio: highest-bitrate AAC (audio/mp4 -> .m4a). Video: YouTube's
/// pre-muxed progressive MP4s (audio already included, no merging needed).
async fn pick_stream(client: &reqwest::Client, video_id: &str, want_video: bool) -> Result<StreamPick, String> {
    let data = call(client, "player", json!({
        "videoId": video_id, "contentCheckOk": true, "racyCheckOk": true,
    }))
    .await?;

    let status = data.pointer("/playabilityStatus/status").and_then(|x| x.as_str()).unwrap_or("");
    if status != "OK" {
        let reason = data
            .pointer("/playabilityStatus/reason")
            .and_then(|x| x.as_str())
            .unwrap_or("Video nicht abspielbar.");
        return Err(reason.to_string());
    }
    let thumbnail = best_thumbnail(&data["videoDetails"]);

    if want_video {
        let formats = data.pointer("/streamingData/formats").and_then(|x| x.as_array());
        let best = formats
            .into_iter()
            .flatten()
            .filter(|f| f.get("url").is_some())
            .max_by_key(|f| f.get("height").and_then(|h| h.as_i64()).unwrap_or(0));
        let f = best.ok_or("Kein Video-Stream gefunden.")?;
        return Ok(StreamPick {
            url: f["url"].as_str().unwrap().to_string(),
            ext: "mp4",
            thumbnail,
        });
    }

    let adaptive = data
        .pointer("/streamingData/adaptiveFormats")
        .and_then(|x| x.as_array());
    let best_audio = adaptive
        .into_iter()
        .flatten()
        .filter(|f| {
            f.get("url").is_some()
                && f.get("mimeType")
                    .and_then(|m| m.as_str())
                    .map(|m| m.starts_with("audio/mp4"))
                    .unwrap_or(false)
        })
        .max_by_key(|f| f.get("bitrate").and_then(|b| b.as_i64()).unwrap_or(0));
    let f = best_audio.ok_or("Kein Audio-Stream gefunden.")?;
    Ok(StreamPick {
        url: f["url"].as_str().unwrap().to_string(),
        ext: "m4a",
        thumbnail,
    })
}

/// Download with the same progress events the yt-dlp desktop path emits
/// (`dl-progress-<task_id>` with percent), so the downloader UI needs no
/// platform-specific handling. Also stores the video thumbnail as a
/// `<name>.jpg` sidecar - m4a has no ID3 frame to embed cover art into,
/// read_track_meta() picks the sidecar up for the library view instead.
pub async fn download_progress(
    app: &tauri::AppHandle,
    music_root: &Path,
    task_id: &str,
    video_id: &str,
    title: &str,
    format: &str,
    playlist_name: &str,
) -> Result<(), String> {
    use futures_util::StreamExt;
    use tauri::Emitter;
    use tokio::io::AsyncWriteExt;

    let client = http();
    let pick = pick_stream(&client, video_id, format == "mp4").await?;

    let dir = music_root.join(crate::commands::safe_filename(playlist_name));
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let stem = crate::commands::safe_filename(title);
    let path = dir.join(format!("{stem}.{}", pick.ext));

    let resp = client
        .get(&pick.url)
        .send()
        .await
        .map_err(|e| format!("Download-Start fehlgeschlagen: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("Download fehlgeschlagen: {}", resp.status()));
    }
    let total = resp.content_length();
    let mut file = tokio::fs::File::create(&path).await.map_err(|e| e.to_string())?;
    let mut stream = resp.bytes_stream();
    let event = format!("dl-progress-{task_id}");
    let mut done: u64 = 0;
    let mut last_pct: i64 = -1;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| {
            let _ = std::fs::remove_file(&path);
            format!("Verbindung abgebrochen: {e}")
        })?;
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        done += chunk.len() as u64;
        if let Some(total) = total {
            let pct = (done as f64 / total as f64 * 100.0) as i64;
            if pct != last_pct {
                last_pct = pct;
                let _ = app.emit(&event, serde_json::json!({ "percent": pct, "phase": "downloading" }));
            }
        }
    }
    file.flush().await.map_err(|e| e.to_string())?;

    // Best effort - a missing cover is cosmetic, never a failed download.
    if pick.ext == "m4a" {
        if let Some(tn) = pick.thumbnail {
            if let Ok(resp) = client.get(&tn).send().await {
                if let Ok(bytes) = resp.bytes().await {
                    let _ = std::fs::write(dir.join(format!("{stem}.jpg")), &bytes);
                }
            }
        }
    }
    Ok(())
}
