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
/// Deliberately also catches "(Music Video)"/"[MV]" WITHOUT the word
/// "official" in front - plenty of uploads are titled that way, and the
/// original official-only pattern silently let those rank as if they were
/// plain audio, defeating "Original-Studio-Audio bevorzugen" for exactly
/// the uploads it exists to avoid.
fn official_video_re() -> &'static Regex {
    static CELL: OnceLock<Regex> = OnceLock::new();
    CELL.get_or_init(|| {
        Regex::new(r"(?i)\b(?:official\s*)?music\s*video\b|\bofficial\s*video\b|[\[(]\s*mv\s*[\])]|\bvideo\s*version\b")
            .unwrap()
    })
}

/// Detects live-performance uploads ("(Live)", "Live at Wembley", "MTV
/// Unplugged", ...) - user-requested: avoid these in favor of the normal
/// studio version whenever one is available. Deliberately specific (not a
/// bare `\blive\b`, which would also match a legitimately titled song like
/// "Live and Let Die") so it only catches actual live-performance framing.
fn live_re() -> &'static Regex {
    static CELL: OnceLock<Regex> = OnceLock::new();
    CELL.get_or_init(|| {
        Regex::new(
            r"(?i)\(live\)|\[live\]|-\s*live\b|\blive\s+at\b|\blive\s+in\b|\blive\s+from\b|\blive\s+performance\b|\blive\s+session\b|\blive\s+version\b|\bunplugged\b",
        )
        .unwrap()
    })
}

/// Lower is preferred. "- Topic" channels are YouTube Music's own
/// auto-generated audio-only uploads (no video track at all) - the closest
/// thing to a Spotify studio master. Live performances are pushed to the
/// very back (worse than an "Official Video", which at least has the
/// studio mix); everything else (plain uploads, "Official Audio") sits in
/// between.
pub(crate) fn audio_preference_score(title: &str, uploader: &str) -> i32 {
    if uploader.to_lowercase().trim_end().ends_with("- topic") {
        0
    } else if live_re().is_match(title) {
        3
    } else if official_video_re().is_match(title) {
        2
    } else {
        1
    }
}

/* ===== Welche FASSUNG ist es? ============================================
   Bisher entschied allein der Upload-Typ, welches Suchergebnis gewinnt.
   Das ging regelmaessig daneben, und zwar aus drei Gruenden:

   1. Ein "- Topic"-Upload bekam Platz 1, auch wenn es ein ganz ANDERER
      Song war. Der Titel selbst ging in die Wertung ueberhaupt nicht ein.
   2. Die Spieldauer war bekannt (Spotify liefert sie zu jedem Titel mit),
      wurde aber nirgends benutzt. Genau sie unterscheidet aber die
      Studiofassung von Extended Mix, Snippet, Stundenschleife oder einer
      voellig anderen Aufnahme.
   3. Die Sperrliste kannte weder "acoustic" noch "remix", "extended",
      "demo" oder "radio edit" - die kamen also ganz normal durch.

   Die Marker unten werden SYMMETRISCH geprueft: ein Kandidat darf einen
   Marker nur tragen, wenn der gesuchte Titel ihn auch traegt. Sucht man
   "Blinding Lights", fliegt "Blinding Lights (Acoustic)" raus; sucht man
   ausdruecklich "Someone Like You (Acoustic)", ist genau diese Fassung
   gewollt und gewinnt. Das loest zugleich das Problem mit Songs, die so
   ein Wort echt im Namen haben ("Cover Me", "Live and Let Die"): steht es
   auf beiden Seiten, ist es kein Unterschied. */
const VERSION_MARKERS: &[(&str, &str)] = &[
    ("akustisch", r"(?i)\bacoustic\b|\bakustisch\b|\bunplugged\b"),
    (
        "live",
        r"(?i)\(live\)|\[live\]|-\s*live\b|\blive\s+(?:at|in|from|session|performance|version)\b",
    ),
    (
        "remix",
        r"(?i)\bremix\b|\bbootleg\b|\bmashup\b|\brework\b|\bvip\s*mix\b|\bflip\b",
    ),
    (
        "tempo",
        r"(?i)\bsped[\s-]?up\b|\bspeed\s*up\b|\bslowed\b|\bnightcore\b|\bdaycore\b",
    ),
    (
        "effekt",
        r"(?i)\breverb\b|\b8d\s*audio\b|\bbass\s*boost(?:ed)?\b",
    ),
    ("karaoke", r"(?i)\bkaraoke\b|\binstrumental\b|\bplayback\b"),
    (
        "nachgespielt",
        r"(?i)\bcover\b|\btribute\b|made popular by|in the style of",
    ),
    ("roh", r"(?i)\bdemo\b|\bsnippet\b|\bteaser\b|\bpreview\b"),
    (
        "laenge",
        r"(?i)\bextended\b|\b\d+\s*(?:hour|hours|stunde|stunden)\b|\bloop(?:ed)?\b",
    ),
    ("kurzfassung", r"(?i)\bradio\s*edit\b|\bshort\s*version\b"),
];

fn marker_regexes() -> &'static Vec<(&'static str, Regex)> {
    static CELL: OnceLock<Vec<(&'static str, Regex)>> = OnceLock::new();
    CELL.get_or_init(|| {
        VERSION_MARKERS
            .iter()
            .map(|(name, pat)| (*name, Regex::new(pat).unwrap()))
            .collect()
    })
}

fn version_markers(text: &str) -> HashSet<&'static str> {
    marker_regexes()
        .iter()
        .filter(|(_, re)| re.is_match(text))
        .map(|(name, _)| *name)
        .collect()
}

/// Der Kandidat darf keinen Marker tragen, den der gesuchte Titel nicht
/// auch hat. Umgekehrt ist es erlaubt (der gesuchte Titel heisst
/// "... (Acoustic)", das Suchergebnis schreibt es nur nicht dazu) - das
/// faellt dann ueber die Punktzahl weiter unten hinten runter, statt den
/// Kandidaten ganz auszuschliessen.
fn markers_ok(wanted: &str, candidate: &str) -> bool {
    let w = version_markers(wanted);
    version_markers(candidate).iter().all(|m| w.contains(m))
}

fn tokens(text: &str) -> Vec<String> {
    normalize_title(text)
        .split_whitespace()
        .map(|s| s.to_string())
        .collect()
}

/// 0 = jedes Wort des gesuchten Titels kommt im Kandidaten vor, 3 = kaum
/// Ueberschneidung (dann ist es schlicht ein anderer Song).
fn title_penalty(wanted: &str, candidate: &str) -> u32 {
    let w = tokens(wanted);
    if w.is_empty() {
        return 1;
    }
    let c = tokens(candidate);
    let hits = w.iter().filter(|t| c.contains(t)).count();
    let ratio = hits as f64 / w.len() as f64;
    if ratio >= 1.0 {
        0
    } else if ratio >= 0.75 {
        1
    } else if ratio >= 0.5 {
        2
    } else {
        3
    }
}

/// Spotify liefert oft mehrere Interpreten ("A, B") - einer reicht.
fn artist_penalty(wanted_artist: &str, cand_title: &str, cand_uploader: &str) -> u32 {
    if wanted_artist.trim().is_empty() {
        return 0;
    }
    let hay = tokens(&format!("{cand_title} {cand_uploader}"));
    let found = tokens(wanted_artist)
        .into_iter()
        .filter(|t| t.chars().count() >= 3)
        .any(|t| hay.contains(&t));
    if found {
        0
    } else {
        1
    }
}

/// 0 = praktisch gleich lang, 4 = so weit daneben, dass es eine andere
/// Aufnahme sein muss. 3 heisst "eine der beiden Dauern ist unbekannt" -
/// weder Bonus noch Strafe, aber schlechter als eine bestaetigte.
fn duration_bucket(wanted: Option<f64>, candidate: Option<f64>) -> u32 {
    match (wanted, candidate) {
        (Some(w), Some(c)) if w > 0.0 && c > 0.0 => {
            let diff = (w - c).abs();
            if diff <= 3.0 {
                0
            } else if diff <= 8.0 {
                1
            } else if diff <= 20.0 {
                2
            } else {
                4
            }
        }
        _ => 3,
    }
}

/// Reine Herkunft des Uploads, ohne Ruecksicht auf den Titel.
fn lyric_video_re() -> &'static Regex {
    static CELL: OnceLock<Regex> = OnceLock::new();
    CELL.get_or_init(|| Regex::new(r"(?i)\blyrics?\b|\blyric\s*video\b|\bvisualizer\b").unwrap())
}

fn upload_kind(title: &str, uploader: &str) -> u32 {
    if uploader.to_lowercase().trim_end().ends_with("- topic") {
        0
    } else if official_video_re().is_match(title) {
        3
    } else if lyric_video_re().is_match(title) {
        2
    } else {
        1
    }
}

/// Gesamtwertung, kleiner ist besser. `None` = kommt gar nicht in Frage.
///
/// Die Gewichte sagen die Rangfolge der Kriterien: erst muss es der
/// richtige SONG sein, dann der richtige Interpret, dann die richtige
/// LAENGE (also dieselbe Aufnahme) - und erst danach zaehlt, ob die Quelle
/// ein reiner Ton-Upload oder ein Musikvideo ist. Vorher war genau diese
/// Reihenfolge auf den Kopf gestellt: die Quelle war das einzige Kriterium.
pub(crate) fn candidate_rank(
    wanted_title: &str,
    wanted_artist: &str,
    wanted_duration: Option<f64>,
    cand: &OnlineTrack,
) -> Option<u32> {
    let cand_text = format!("{} {}", cand.title, cand.artist);
    if !markers_ok(wanted_title, &cand_text) {
        return None;
    }
    let tp = title_penalty(wanted_title, &cand.title);
    if tp >= 3 {
        return None;
    }
    let db = duration_bucket(wanted_duration, cand.duration);
    if db >= 4 {
        return None;
    }
    let ap = artist_penalty(wanted_artist, &cand.title, &cand.artist);
    Some(tp * 10_000 + ap * 3_000 + db * 500 + upload_kind(&cand.title, &cand.artist) * 10)
}

/// Searches for the best audio-preferring match for a title/uploader: a
/// plain query PLUS a second, "- Topic"-boosted query (YouTube Music's
/// auto-generated audio-only channels are named exactly that, so nudging
/// the search text toward it noticeably improves how often one actually
/// surfaces - a bare title+artist search often buries it under a pile of
/// near-identical official videos/lyric videos/reaction uploads). Results
/// from both queries are pooled and deduped before ranking, which also
/// just means more total candidates than either query alone would give -
/// "Original-Studio-Audio bevorzugen" failing was as often "never even
/// saw a Topic upload in the results" as it was a ranking problem.
async fn best_audio_candidates(
    app: &tauri::AppHandle,
    title: &str,
    uploader: &str,
) -> Vec<OnlineTrack> {
    let plain_query = format!("{title} {uploader}");
    let topic_query = format!("{title} {uploader} Topic");
    let (plain, topic) = tokio::join!(
        yt_search(app, &plain_query, 10),
        yt_search(app, &topic_query, 6),
    );
    let mut seen = HashSet::new();
    plain
        .unwrap_or_default()
        .into_iter()
        .chain(topic.unwrap_or_default())
        .filter(|r| seen.insert(r.video_id.clone()))
        .filter(|r| !is_bad_variant(&format!("{} {}", r.title, r.artist)))
        .collect()
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
    let mut candidates = best_audio_candidates(app, title, uploader).await;
    candidates.retain(|r| r.video_id != original_id);
    // Ueber dieselbe Wertung wie ueberall sonst: ein Tausch lohnt nur,
    // wenn der Ersatz auch wirklich derselbe Song in derselben Fassung ist
    // - vorher reichte "ist ein Topic-Upload", egal was drauf stand.
    let best = pick_best(title, uploader, None, candidates)?;
    if audio_preference_score(&best.title, &best.artist) < own_score {
        Some(best.video_id)
    } else {
        None
    }
}

/// Fresh best-match search (no existing pick to compare against) - used
/// when resolving an external playlist (Spotify) to a downloadable video
/// per track. Same pooled plain+Topic search and ranking as
/// find_audio_alternative, just without an "original" to exclude/beat.
pub(crate) async fn best_audio_match(
    app: &tauri::AppHandle,
    title: &str,
    uploader: &str,
    duration: Option<f64>,
) -> Option<OnlineTrack> {
    let candidates = best_audio_candidates(app, title, uploader).await;
    pick_best(title, uploader, duration, candidates)
}

/// Waehlt aus den Suchergebnissen. Zwei Durchgaenge, und der zweite ist
/// wichtig: waere nur der strenge Durchgang da, wuerde ein Titel, den die
/// Suche nur schlecht trifft (ungewoehnliche Schreibweise, fehlende
/// Dauer-Angabe, Sonderzeichen), gar nicht mehr gefunden - vorher kam
/// wenigstens IRGENDETWAS. Also: erst streng auswaehlen, und nur wenn dabei
/// nichts uebrig bleibt, auf die alte, nachsichtige Rangfolge zurueckfallen.
pub(crate) fn pick_best(
    title: &str,
    uploader: &str,
    duration: Option<f64>,
    candidates: Vec<OnlineTrack>,
) -> Option<OnlineTrack> {
    let mut streng: Vec<(u32, OnlineTrack)> = candidates
        .iter()
        .filter_map(|c| candidate_rank(title, uploader, duration, c).map(|s| (s, c.clone())))
        .collect();
    if !streng.is_empty() {
        streng.sort_by_key(|(s, _)| *s);
        return streng.into_iter().next().map(|(_, c)| c);
    }
    let mut locker = candidates;
    locker.sort_by_key(|r| audio_preference_score(&r.title, &r.artist));
    locker.into_iter().next()
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
    // Android: kein yt-dlp-Binary - Suche läuft nativ über Innertube.
    if cfg!(target_os = "android") {
        return crate::innertube::search(query, limit as usize).await;
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn audio_preference_score_ranks_topic_channel_best() {
        assert_eq!(audio_preference_score("Blinding Lights", "The Weeknd - Topic"), 0);
    }

    // ---- Auswahl der richtigen Fassung ---------------------------------

    fn kandidat(title: &str, artist: &str, dauer: Option<f64>) -> OnlineTrack {
        OnlineTrack {
            video_id: format!("id-{title}"),
            title: title.to_string(),
            artist: artist.to_string(),
            duration: dauer,
            cover: None,
            url: String::new(),
        }
    }

    #[test]
    fn akustik_und_remix_fliegen_raus_wenn_die_normale_fassung_gesucht_ist() {
        for (t, a) in [
            ("Blinding Lights (Acoustic)", "The Weeknd"),
            ("Blinding Lights - Acoustic Version", "The Weeknd"),
            ("Blinding Lights (Chris Remix)", "The Weeknd"),
            ("Blinding Lights (Extended Mix)", "The Weeknd"),
            ("Blinding Lights (Demo)", "The Weeknd"),
            ("Blinding Lights (Radio Edit)", "The Weeknd"),
            ("Blinding Lights (Live at Wembley)", "The Weeknd"),
            ("Blinding Lights [1 Hour Loop]", "Loops"),
        ] {
            assert!(
                candidate_rank("Blinding Lights", "The Weeknd", None, &kandidat(t, a, None)).is_none(),
                "{t} haette rausfallen muessen"
            );
        }
    }

    #[test]
    fn ausdruecklich_gesuchte_fassung_bleibt_erlaubt() {
        // Steht der Marker auf BEIDEN Seiten, ist es kein Unterschied.
        let r = candidate_rank(
            "Someone Like You (Acoustic)",
            "Adele",
            None,
            &kandidat("Someone Like You (Acoustic)", "Adele - Topic", None),
        );
        assert!(r.is_some());
    }

    #[test]
    fn song_mit_markerwort_im_echten_namen_faellt_nicht_raus() {
        // "Live and Let Die" / "Cover Me" duerfen nicht als Live- bzw.
        // Cover-Fassung missverstanden werden.
        assert!(candidate_rank("Live and Let Die", "Wings", None, &kandidat("Live and Let Die", "Wings - Topic", None)).is_some());
        assert!(candidate_rank("Cover Me", "Bruce Springsteen", None, &kandidat("Cover Me", "Bruce Springsteen - Topic", None)).is_some());
    }

    #[test]
    fn falsche_laenge_fliegt_raus_richtige_gewinnt() {
        let gesucht_dauer = Some(200.0);
        // 6 Minuten statt 3:20 - andere Aufnahme.
        assert!(candidate_rank("Blinding Lights", "The Weeknd", gesucht_dauer, &kandidat("Blinding Lights", "The Weeknd - Topic", Some(360.0))).is_none());
        let passend = candidate_rank("Blinding Lights", "The Weeknd", gesucht_dauer, &kandidat("Blinding Lights", "The Weeknd - Topic", Some(201.0))).unwrap();
        let knapp_daneben = candidate_rank("Blinding Lights", "The Weeknd", gesucht_dauer, &kandidat("Blinding Lights", "The Weeknd - Topic", Some(212.0))).unwrap();
        assert!(passend < knapp_daneben);
    }

    #[test]
    fn richtiger_song_schlaegt_bessere_quelle_beim_falschen_song() {
        // Genau der Fall, der vorher schiefging: der Topic-Upload eines
        // ANDEREN Songs stand vor der richtigen Studiofassung.
        let kandidaten = vec![
            kandidat("Save Your Tears", "The Weeknd - Topic", Some(215.0)),
            kandidat("The Weeknd - Blinding Lights (Official Audio)", "The Weeknd", Some(200.0)),
        ];
        let treffer = pick_best("Blinding Lights", "The Weeknd", Some(200.0), kandidaten).unwrap();
        assert!(treffer.title.contains("Blinding Lights"));
    }

    #[test]
    fn bei_gleichem_song_gewinnt_der_reine_ton_upload_vor_dem_musikvideo() {
        let kandidaten = vec![
            kandidat("Blinding Lights (Official Video)", "The Weeknd", Some(200.0)),
            kandidat("Blinding Lights", "The Weeknd - Topic", Some(200.0)),
        ];
        let treffer = pick_best("Blinding Lights", "The Weeknd", Some(200.0), kandidaten).unwrap();
        assert_eq!(treffer.artist, "The Weeknd - Topic");
    }

    #[test]
    fn faellt_auf_die_alte_rangfolge_zurueck_wenn_streng_nichts_uebrig_bleibt() {
        // Alles unpassend (falsche Laenge) - lieber irgendein Treffer als
        // ein Titel, den man gar nicht mehr herunterladen kann.
        let kandidaten = vec![kandidat("Blinding Lights", "The Weeknd - Topic", Some(999.0))];
        assert!(pick_best("Blinding Lights", "The Weeknd", Some(200.0), kandidaten).is_some());
    }

    #[test]
    fn voellig_anderer_song_wird_abgelehnt() {
        assert!(candidate_rank("Blinding Lights", "The Weeknd", None, &kandidat("Bohemian Rhapsody", "Queen - Topic", None)).is_none());
    }

    #[test]
    fn audio_preference_score_ranks_plain_upload_above_video() {
        let plain = audio_preference_score("Blinding Lights", "The Weeknd");
        let video = audio_preference_score("Blinding Lights (Official Video)", "The Weeknd");
        assert!(plain < video);
    }

    #[test]
    fn audio_preference_score_catches_music_video_without_official() {
        // Die Luecke, die den Bug ausmachte: viele Uploads heissen einfach
        // "(Music Video)" ohne "Official" davor - die alte Regex sah das
        // nicht als Video-Hinweis und liess es wie normales Audio ranken.
        let plain = audio_preference_score("Blinding Lights", "The Weeknd");
        let music_video = audio_preference_score("Blinding Lights (Music Video)", "The Weeknd");
        assert!(music_video > plain);
    }

    #[test]
    fn audio_preference_score_catches_bracketed_mv() {
        let plain = audio_preference_score("Blinding Lights", "The Weeknd");
        let mv = audio_preference_score("Blinding Lights [MV]", "The Weeknd");
        assert!(mv > plain);
    }

    #[test]
    fn audio_preference_score_ranks_live_worst() {
        let video = audio_preference_score("Blinding Lights (Official Video)", "The Weeknd");
        let live = audio_preference_score("Blinding Lights (Live at Wembley)", "The Weeknd");
        assert!(live > video);
    }

    #[test]
    fn audio_preference_score_does_not_flag_song_with_video_in_its_real_title() {
        // "Video Games" (Lana Del Rey) ist ein echter Songtitel - darf nicht
        // als Video-Upload fehlinterpretiert werden.
        assert_eq!(audio_preference_score("Video Games", "Lana Del Rey - Topic"), 0);
    }
}
