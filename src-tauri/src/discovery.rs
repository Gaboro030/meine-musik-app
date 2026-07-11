use crate::commands::{list_playlists_inner, AppState};
use rand::seq::SliceRandom;
use regex::Regex;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;
use tauri_plugin_shell::ShellExt;

#[derive(Serialize, Clone)]
pub struct OnlineTrack {
    pub video_id: String,
    pub title: String,
    pub artist: String,
    pub duration: Option<f64>,
    pub cover: Option<String>,
    pub url: String,
}

/// Search results that are technically a title/artist match but aren't the
/// normal studio version - karaoke, slowed/sped-up, nightcore, covers etc.
/// Mirrors the old Flask _BAD_VARIANT_RE.
fn bad_variant_re() -> &'static Regex {
    static CELL: OnceLock<Regex> = OnceLock::new();
    CELL.get_or_init(|| {
        Regex::new(
            r"(?i)\bkaraoke\b|\bslowed\b|slow(?:ed)?\s*\+?\s*reverb|sped[- ]?up|speed\s*up|\bnightcore\b|8d\s*audio|\breverb\b|\btribute\b|made popular by|in the style of|cover\s*version|\binstrumental\b",
        )
        .unwrap()
    })
}
pub(crate) fn is_bad_variant(text: &str) -> bool {
    bad_variant_re().is_match(text)
}

/// Detects "Official Video"/"Music Video" uploads - these often carry
/// intro dialogue, applause or a different mix than the plain studio
/// release. Used to prefer a "Topic"/plain-audio upload when one exists.
fn official_video_re() -> &'static Regex {
    static CELL: OnceLock<Regex> = OnceLock::new();
    CELL.get_or_init(|| Regex::new(r"(?i)\bofficial\s*(music\s*)?video\b|\bmv\b").unwrap())
}

/// Lower is preferred. "- Topic" channels are YouTube Music's own
/// auto-generated audio-only uploads (no video track at all) - the closest
/// thing to a Spotify studio master. Explicit "Official Video"/"MV" titles
/// are pushed to the back; everything else (plain uploads, "Official
/// Audio") sits in between.
pub(crate) fn audio_preference_score(title: &str, uploader: &str) -> i32 {
    if uploader.to_lowercase().trim_end().ends_with("- topic") {
        0
    } else if official_video_re().is_match(title) {
        2
    } else {
        1
    }
}

/// When the user wants clean studio audio instead of a music-video rip,
/// search for a Topic-channel/plain-audio upload of the same song and swap
/// to that video id. Returns None (keep the original) if nothing better
/// turns up - not finding one isn't an error, the official video is a fine
/// fallback.
pub(crate) async fn find_audio_alternative(
    app: &tauri::AppHandle,
    title: &str,
    uploader: &str,
    original_id: &str,
) -> Option<String> {
    let own_score = audio_preference_score(title, uploader);
    if own_score == 0 {
        return None;
    }
    let query = format!("{title} {uploader}");
    let results = yt_search(app, &query, 6).await.ok()?;
    let mut candidates: Vec<_> = results
        .into_iter()
        .filter(|r| r.video_id != original_id && !is_bad_variant(&format!("{} {}", r.title, r.artist)))
        .collect();
    candidates.sort_by_key(|r| audio_preference_score(&r.title, &r.artist));
    let best = candidates.into_iter().next()?;
    if audio_preference_score(&best.title, &best.artist) < own_score {
        Some(best.video_id)
    } else {
        None
    }
}

/// Lowercases a track title and strips bracketed/video-only noise words,
/// for fuzzy "already own this" matching. Mirrors _normalize_title.
fn normalize_title(text: &str) -> String {
    static NOISE: OnceLock<Regex> = OnceLock::new();
    static BRACKETS: OnceLock<Regex> = OnceLock::new();
    static NONWORD: OnceLock<Regex> = OnceLock::new();
    static WS: OnceLock<Regex> = OnceLock::new();

    let noise = NOISE.get_or_init(|| {
        Regex::new(r"(?i)\((?:official\s*)?(?:music\s*)?video\)|\((?:official\s*)?audio\)|\blyrics?\b|\blyric\s*video\b|\bvisualizer\b|\bofficial\s*video\b|\bhd\b|\b4k\b|\bremaster(?:ed)?\b").unwrap()
    });
    let brackets = BRACKETS.get_or_init(|| Regex::new(r"[\[\(].*?[\]\)]").unwrap());
    let nonword = NONWORD.get_or_init(|| Regex::new(r"[^\w\s]").unwrap());
    let ws = WS.get_or_init(|| Regex::new(r"\s+").unwrap());

    let step1 = noise.replace_all(text, " ");
    let step2 = brackets.replace_all(&step1, " ");
    let step3 = nonword.replace_all(&step2, " ");
    ws.replace_all(step3.trim(), " ").to_lowercase()
}

/// Shells out to yt-dlp's own search (`ytsearchN:query`) - no ytmusicapi
/// equivalent exists in Rust, but yt-dlp already knows how to search
/// YouTube and dump flat JSON metadata per result, which is enough for
/// title/uploader/duration/thumbnail/id. Desktop only, same sidecar
/// limitation as download_track (see README).
pub(crate) async fn yt_search(app: &tauri::AppHandle, query: &str, limit: u32) -> Result<Vec<OnlineTrack>, String> {
    crate::commands::require_ytdlp()?;
    let shell = app.shell();
    let output = shell
        .sidecar("yt-dlp")
        .map_err(|e| e.to_string())?
        .args([
            "--dump-json",
            "--flat-playlist",
            "--no-warnings",
            &format!("ytsearch{limit}:{query}"),
        ])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let mut out = Vec::new();
    for line in text.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let Ok(v) = serde_json::from_str::<serde_json::Value>(line) else { continue };
        let Some(id) = v.get("id").and_then(|x| x.as_str()) else { continue };
        let title = v.get("title").and_then(|x| x.as_str()).unwrap_or("Unknown title").to_string();
        let uploader = v
            .get("uploader")
            .or_else(|| v.get("channel"))
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        let duration = v.get("duration").and_then(|x| x.as_f64());
        let cover = v
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
        out.push(OnlineTrack {
            video_id: id.to_string(),
            title,
            artist: uploader,
            duration,
            cover,
            url: format!("https://www.youtube.com/watch?v={id}"),
        });
    }
    Ok(out)
}

fn top_artists(tracks: &[crate::commands::TrackMeta], max: usize) -> Vec<String> {
    let mut counts: HashMap<String, u32> = HashMap::new();
    for t in tracks {
        for single in t.artist.split(',') {
            let s = single.trim();
            if !s.is_empty() {
                *counts.entry(s.to_string()).or_insert(0) += 1;
            }
        }
    }
    let mut pairs: Vec<(&String, &u32)> = counts.iter().collect();
    pairs.sort_by(|a, b| b.1.cmp(a.1));
    pairs.into_iter().take(max).map(|(a, _)| a.clone()).collect()
}

async fn gather(
    app: &tauri::AppHandle,
    queries: &[String],
    have_titles: &HashSet<String>,
    exclude_ids: &HashSet<String>,
    count: usize,
) -> Vec<OnlineTrack> {
    let mut seen = exclude_ids.clone();
    let mut candidates = Vec::new();
    for q in queries {
        let Ok(results) = yt_search(app, q, 15).await else { continue };
        for r in results {
            if seen.contains(&r.video_id) {
                continue;
            }
            if is_bad_variant(&format!("{} {}", r.title, r.artist)) {
                continue;
            }
            if have_titles.contains(&normalize_title(&r.title)) {
                continue;
            }
            seen.insert(r.video_id.clone());
            candidates.push(r);
        }
    }
    candidates.shuffle(&mut rand::thread_rng());
    candidates.truncate(count);
    candidates
}

/// Home screen "Andere Songs entdecken" - seeded from every artist across
/// the whole library. Mirrors recommend_discover().
#[tauri::command]
pub async fn discover_tracks(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    exclude_ids: Vec<String>,
) -> Result<Vec<OnlineTrack>, String> {
    let playlists = list_playlists_inner(&state.music_root);
    let all_tracks: Vec<crate::commands::TrackMeta> =
        playlists.into_iter().flat_map(|p| p.tracks).collect();
    if all_tracks.is_empty() {
        return Ok(vec![]);
    }
    let have_titles: HashSet<String> = all_tracks.iter().map(|t| normalize_title(&t.title)).collect();
    let queries = top_artists(&all_tracks, 3);
    if queries.is_empty() {
        return Ok(vec![]);
    }
    let exclude: HashSet<String> = exclude_ids.into_iter().collect();
    Ok(gather(&app, &queries, &have_titles, &exclude, 12).await)
}

const GENERIC_PLAYLIST_NAMES: &[&str] = &[
    "meins", "mine", "my music", "meine musik", "playlist", "playlists", "favoriten",
    "favorites", "favorite", "mix", "musik", "music", "songs", "downloads", "download",
    "einzeltitel", "unbenannt", "untitled", "neu", "new", "test",
];

/// Per-playlist "Empfohlene Songs" - seeded from the playlist's own top
/// artists, plus its name (if it looks like an actual genre/era descriptor
/// rather than a generic folder name). Mirrors recommend_for_playlist().
#[tauri::command]
pub async fn recommend_for_playlist(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    playlist_name: String,
    exclude_ids: Vec<String>,
) -> Result<Vec<OnlineTrack>, String> {
    let playlists = list_playlists_inner(&state.music_root);
    let Some(pl) = playlists.into_iter().find(|p| p.name == playlist_name) else {
        return Ok(vec![]);
    };
    let have_titles: HashSet<String> = pl.tracks.iter().map(|t| normalize_title(&t.title)).collect();
    let mut queries = top_artists(&pl.tracks, 3);

    let lower_name = playlist_name.trim().to_lowercase();
    if lower_name.len() > 3 && !GENERIC_PLAYLIST_NAMES.contains(&lower_name.as_str()) {
        queries.push(playlist_name);
    }
    if queries.is_empty() {
        return Ok(vec![]);
    }
    let exclude: HashSet<String> = exclude_ids.into_iter().collect();
    Ok(gather(&app, &queries, &have_titles, &exclude, 8).await)
}

#[derive(Serialize, Clone)]
pub struct DiscoverRow {
    pub title: String,
    pub recommendations: Vec<OnlineTrack>,
}

/// Per-artist "Mehr von <Artist>" shelves for the Home screen - one row per
/// top library artist, 8 picks each. Mirrors the Flask
/// /api/library/discover-rows endpoint (recommend_discover_rows).
#[tauri::command]
pub async fn discover_rows(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    exclude_ids: Vec<String>,
) -> Result<Vec<DiscoverRow>, String> {
    let playlists = list_playlists_inner(&state.music_root);
    let all_tracks: Vec<crate::commands::TrackMeta> =
        playlists.into_iter().flat_map(|p| p.tracks).collect();
    if all_tracks.is_empty() {
        return Ok(vec![]);
    }
    let have_titles: HashSet<String> =
        all_tracks.iter().map(|t| normalize_title(&t.title)).collect();
    let artists = top_artists(&all_tracks, 4);

    let mut used: HashSet<String> = exclude_ids.into_iter().collect();
    let mut rows = Vec::new();
    for artist in artists {
        let picks = gather(&app, &[artist.clone()], &have_titles, &used, 10).await;
        for p in &picks {
            used.insert(p.video_id.clone());
        }
        if !picks.is_empty() {
            rows.push(DiscoverRow {
                title: format!("Mehr von {artist}"),
                recommendations: picks,
            });
        }
    }
    Ok(rows)
}

/// Online part of the search bar - hits yt-dlp directly, so it can find
/// any song, not just what's already downloaded.
#[tauri::command]
pub async fn search_online(app: tauri::AppHandle, query: String) -> Result<Vec<OnlineTrack>, String> {
    if query.trim().chars().count() < 2 {
        return Ok(vec![]);
    }
    let results = yt_search(&app, &query, 24).await?;
    Ok(results
        .into_iter()
        .filter(|r| !is_bad_variant(&format!("{} {}", r.title, r.artist)))
        .collect())
}
