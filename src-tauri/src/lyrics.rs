use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::OnceLock;

use regex::Regex;

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

/// Strips YouTube-Rip-Rauschen ("(Official Video)", "(Lyrics)", "HD",
/// "Remastered", jede Klammer) aus Titel/Interpret, BEVOR damit bei lrclib
/// angefragt wird - unsere Bibliothekstitel sind roh von YouTube und genau
/// dieses Rauschen liess den Exakt-Match (lrclib_get) haeufig fehlschlagen,
/// wodurch der Code auf die ungeprueft erste Volltextsuche auswich (siehe
/// similarity_ok weiter unten - die Wurzel des "komplett anderes Lied"-
/// Bugs). Behaelt Gross-/Kleinschreibung und normale Satzzeichen, damit die
/// Anfrage noch wie natuerlicher Text aussieht.
fn clean_query_text(text: &str) -> String {
    static NOISE: OnceLock<Regex> = OnceLock::new();
    static BRACKETS: OnceLock<Regex> = OnceLock::new();
    let noise = NOISE.get_or_init(|| {
        Regex::new(r"(?i)\((?:official\s*)?(?:music\s*)?video\)|\((?:official\s*)?audio\)|\blyrics?\b|\blyric\s*video\b|\bvisualizer\b|\bofficial\s*video\b|\bhd\b|\b4k\b|\bremaster(?:ed)?\b").unwrap()
    });
    let brackets = BRACKETS.get_or_init(|| Regex::new(r"[\[\(].*?[\]\)]").unwrap());
    let step1 = noise.replace_all(text, " ");
    let step2 = brackets.replace_all(&step1, " ");
    step2.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Lowercase + alles auf Wort-Tokens reduziert - fuer den Aehnlichkeits-
/// Vergleich zwischen angefragtem und von lrclib zurueckgegebenem Titel/
/// Interpret, nicht fuer die Anfrage selbst (siehe clean_query_text).
fn normalize_for_compare(text: &str) -> HashSet<String> {
    static NONWORD: OnceLock<Regex> = OnceLock::new();
    let nonword = NONWORD.get_or_init(|| Regex::new(r"[^\w\s]").unwrap());
    let cleaned = clean_query_text(text);
    nonword
        .replace_all(&cleaned, " ")
        .to_lowercase()
        .split_whitespace()
        .filter(|w| w.len() > 1) // "a"/"i"/"&" etc. sind zu generisch, um als Uebereinstimmung zu zaehlen
        .map(|w| w.to_string())
        .collect()
}

/// Ist `candidate` (Titel ODER Interpret aus der lrclib-Antwort) plausibel
/// dasselbe wie `requested`? Wortmengen-Ueberlappung (Jaccard) statt exakter
/// Gleichheit - toleriert Reihenfolge-/Feat.-Unterschiede, verwirft aber
/// zuverlaessig ein komplett anderes Lied. Leeres `requested` (kein
/// Interpret bekannt) blockt nichts.
fn similarity_ok(requested: &str, candidate: &str) -> bool {
    let a = normalize_for_compare(requested);
    if a.is_empty() {
        return true;
    }
    let b = normalize_for_compare(candidate);
    if b.is_empty() {
        return false;
    }
    if a == b {
        return true;
    }
    let inter = a.intersection(&b).count();
    let union = a.union(&b).count();
    union > 0 && (inter as f64 / union as f64) >= 0.5
}

fn candidate_ok(requested_title: &str, requested_artist: &str, got_title: &str, got_artist: &str) -> bool {
    similarity_ok(requested_title, got_title) && similarity_ok(requested_artist, got_artist)
}

struct LrcHit {
    synced: Option<String>,
    plain: Option<String>,
    track_name: String,
    artist_name: String,
}

async fn lrclib_get(
    client: &reqwest::Client,
    title: &str,
    artist: &str,
    duration: Option<f64>,
) -> Option<LrcHit> {
    let clean_title = clean_query_text(title);
    let clean_artist = clean_query_text(artist);
    let mut params = vec![
        ("track_name".to_string(), clean_title),
        ("artist_name".to_string(), clean_artist),
    ];
    if let Some(d) = duration {
        params.push(("duration".to_string(), (d as i64).to_string()));
    }
    let resp = client.get(LRCLIB_GET).query(&params).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let data: serde_json::Value = resp.json().await.ok()?;
    let synced = str_field(&data, "syncedLyrics");
    let plain = str_field(&data, "plainLyrics");
    if synced.is_none() && plain.is_none() {
        return None;
    }
    Some(LrcHit {
        synced,
        plain,
        track_name: str_field(&data, "trackName").unwrap_or_default(),
        artist_name: str_field(&data, "artistName").unwrap_or_default(),
    })
}

/// Volltextsuche statt Exakt-Match - prueft mehrere Kandidaten (nicht mehr
/// blind items[0]) und nimmt den ERSTEN, der wirklich zu Titel+Interpret
/// passt. Genau das war die Ursache des "komplett anderes Lied"-Bugs: die
/// alte Version vertraute lrclib's Ranking bedingungslos.
async fn lrclib_search(client: &reqwest::Client, title: &str, artist: &str) -> Option<LrcHit> {
    let q = format!("{} {}", clean_query_text(artist), clean_query_text(title));
    let resp = client.get(LRCLIB_SEARCH).query(&[("q", q)]).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let items: Vec<serde_json::Value> = resp.json().await.ok()?;
    for item in items.iter().take(8) {
        let track_name = str_field(item, "trackName").unwrap_or_default();
        let artist_name = str_field(item, "artistName").unwrap_or_default();
        if !candidate_ok(title, artist, &track_name, &artist_name) {
            continue;
        }
        let synced = str_field(item, "syncedLyrics");
        let plain = str_field(item, "plainLyrics");
        if synced.is_none() && plain.is_none() {
            continue;
        }
        return Some(LrcHit { synced, plain, track_name, artist_name });
    }
    None
}

async fn lyrics_ovh(client: &reqwest::Client, title: &str, artist: &str) -> Option<String> {
    let enc = |s: &str| percent_encoding::utf8_percent_encode(s, percent_encoding::NON_ALPHANUMERIC).to_string();
    let clean_title = clean_query_text(title);
    let clean_artist = clean_query_text(artist);
    let url = format!("https://api.lyrics.ovh/v1/{}/{}", enc(&clean_artist), enc(&clean_title));
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
///
/// Jeder Kandidat wird gegen Titel+Interpret der Anfrage geprueft
/// (candidate_ok) - lieber "keine Lyrics gefunden" als ein falscher Song
/// (siehe similarity_ok).
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

    // Alle drei Quellen gleichzeitig anfragen statt nacheinander (get ->
    // search -> ovh) - die Wartezeit ist dann die der langsamsten Quelle,
    // nicht die Summe aller drei. Kostet ein paar unnoetige Requests wenn
    // die erste Quelle schon einen Treffer liefert, spart dafuer im
    // Normalfall spuerbar Zeit bis die Lyrics im Overlay stehen.
    let (get_hit, search_hit, ovh_hit) = tokio::join!(
        lrclib_get(&client, &title, &artist, duration),
        lrclib_search(&client, &title, &artist),
        lyrics_ovh(&client, &title, &artist),
    );

    let get_hit = get_hit.filter(|h| candidate_ok(&title, &artist, &h.track_name, &h.artist_name));
    let hit = get_hit.or(search_hit);

    let (synced, mut plain) = match hit {
        Some(h) => (h.synced, h.plain),
        None => (None, None),
    };
    if plain.is_none() && synced.is_none() {
        plain = ovh_hit;
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
///
/// A "nicht gefunden" Ergebnis wird NICHT auf die Platte geschrieben - sonst
/// bleibt ein Song, bei dem lrclib mal kurz down war oder der Titel eine
/// ungluecklich formatierte Variante hatte, fuer immer auf "keine Lyrics"
/// haengen, obwohl ein spaeterer Versuch klappen wuerde. Stattdessen wird
/// bei jedem `found:false` einfach beim naechsten Abspielen automatisch neu
/// versucht. `force=true` (Retry-Button im Lyrics-Overlay) ignoriert einen
/// vorhandenen Cache-Treffer zusaetzlich und fragt garantiert frisch an.
#[tauri::command]
pub async fn get_lyrics_cached(
    state: tauri::State<'_, crate::commands::AppState>,
    playlist: String,
    file: String,
    title: String,
    artist: String,
    duration: Option<f64>,
    force: Option<bool>,
) -> Result<LyricsResult, String> {
    let sidecar = lyrics_sidecar_path(&state.music_root, &playlist, &file);
    if !force.unwrap_or(false) {
        if let Some(path) = &sidecar {
            if let Ok(text) = std::fs::read_to_string(path) {
                if let Ok(cached) = serde_json::from_str::<LyricsResult>(&text) {
                    return Ok(cached);
                }
            }
        }
    }
    let result = fetch_lyrics(title, artist, duration).await?;
    if result.found {
        if let Some(path) = &sidecar {
            if let Ok(json) = serde_json::to_string(&result) {
                let _ = std::fs::write(path, json);
            }
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clean_query_text_strips_youtube_noise_and_brackets() {
        assert_eq!(
            clean_query_text("Never Gonna Give You Up (Official Video) [HD]"),
            "Never Gonna Give You Up"
        );
    }

    #[test]
    fn clean_query_text_strips_lyrics_marker() {
        let cleaned = clean_query_text("Some Song Lyrics");
        assert!(!cleaned.to_lowercase().contains("lyrics"));
    }

    #[test]
    fn normalize_for_compare_ignores_case_and_short_tokens() {
        let a = normalize_for_compare("The Weeknd");
        let b = normalize_for_compare("the weeknd");
        assert_eq!(a, b);
        // "a"/"i"-style 1-Buchstaben-Woerter sind zu generisch, um mitzuzaehlen.
        assert!(!normalize_for_compare("a i song").contains("a"));
    }

    #[test]
    fn similarity_ok_accepts_close_match_despite_remaster_suffix() {
        assert!(similarity_ok("Blinding Lights", "Blinding Lights (Remastered)"));
    }

    #[test]
    fn similarity_ok_rejects_a_completely_different_song() {
        assert!(!similarity_ok("Blinding Lights", "Shape of You"));
    }

    #[test]
    fn similarity_ok_empty_requested_accepts_anything() {
        // Kein bekannter Interpret in der Bibliothek soll den Match nicht blocken.
        assert!(similarity_ok("", "Irgendein Interpret"));
    }

    #[test]
    fn similarity_ok_rejects_when_candidate_is_empty_but_requested_is_not() {
        assert!(!similarity_ok("Blinding Lights", ""));
    }

    #[test]
    fn candidate_ok_requires_both_title_and_artist_to_match() {
        assert!(candidate_ok("Blinding Lights", "The Weeknd", "Blinding Lights", "The Weeknd"));
        assert!(!candidate_ok("Blinding Lights", "The Weeknd", "Blinding Lights", "Dua Lipa"));
        assert!(!candidate_ok("Blinding Lights", "The Weeknd", "Shape of You", "The Weeknd"));
    }
}
