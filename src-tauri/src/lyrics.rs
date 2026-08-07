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
        .map(entpluralisiert)
        .collect()
}

/// Haengt ein einzelnes "s" hinten dran, wird es fuer den Vergleich
/// abgeschnitten. Klingt kleinlich, ist aber genau der Unterschied
/// zwischen "Kanye West" und dem, was manche YouTube-Titel daraus machen
/// ("Kanye Wests"): der Wortmengen-Vergleich sah darin zwei voellig
/// verschiedene Woerter, die Uebereinstimmung fiel unter die Schwelle,
/// und der richtige Songtext wurde verworfen.
///
/// Nur ab vier Zeichen und nicht bei "ss": sonst wuerden aus "is"/"as"
/// unbrauchbare Reste und aus "Bass" ein "Bas".
fn entpluralisiert(w: &str) -> String {
    if w.len() >= 4 && w.ends_with('s') && !w.ends_with("ss") {
        w[..w.len() - 1].to_string()
    } else {
        w.to_string()
    }
}

/// Wirft mehrfach genannte Interpreten raus. "Kanye Wests, Kanye Wests"
/// wird zu "Kanye Wests" - so etwas entsteht, wenn beim Import Titel- und
/// Kanalname zusammengeschrieben werden, und macht jede Suche kaputt:
/// gesucht wird dann nach einem Kuenstler, den es so nicht gibt.
fn entdoppelter_interpret(artist: &str) -> String {
    static TRENNER: OnceLock<Regex> = OnceLock::new();
    // Der Punkt gehoert HINTER die Wortgrenze: bei "feat." sitzt die
    // Grenze zwischen "t" und ".", ein \bfeat\.?\b haette den Punkt also
    // stehen lassen ("Eminem, . Rihanna"). \bfeat\b\.? frisst ihn mit,
    // ohne dass "feature" mitgerissen wird - dort gibt es zwischen "t" und
    // "u" gar keine Wortgrenze.
    let trenner =
        TRENNER.get_or_init(|| Regex::new(r"(?i)\s*(?:,|&|\bfeat\b\.?|\bft\b\.?|\bund\b|\band\b|\bx\b)\s*").unwrap());
    let mut gesehen: Vec<String> = Vec::new();
    let mut teile: Vec<&str> = Vec::new();
    for teil in trenner.split(artist) {
        let sauber = teil.trim();
        if sauber.is_empty() {
            continue;
        }
        // Vergleich ueber dieselbe Normalisierung wie beim Abgleich mit
        // lrclib, damit "Kanye West" und "kanye  west" als dasselbe gelten.
        let schluessel: Vec<String> = {
            let mut v: Vec<String> = normalize_for_compare(sauber).into_iter().collect();
            v.sort();
            v
        };
        let key = schluessel.join(" ");
        if key.is_empty() || gesehen.contains(&key) {
            continue;
        }
        gesehen.push(key);
        teile.push(sauber);
    }
    if teile.is_empty() {
        return artist.trim().to_string();
    }
    teile.join(", ")
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

/// Fassungs-Merkmale eines Titels ("Live", "Remix", "Sped Up", "Slowed",
/// "Acoustic", "Instrumental", "Cover", "Karaoke").
///
/// Warum das noetig ist: clean_query_text wirft ALLE Klammern weg, damit die
/// Suchanfrage nicht am YouTube-Rauschen scheitert - dadurch sah aber
/// "Blinding Lights" und "Blinding Lights (Sped Up)" fuer similarity_ok
/// identisch aus. Genau so landet auf einer beschleunigten oder Live-Fassung
/// der Text der Studio-Fassung: gleicher Wortlaut, aber voellig andere
/// Zeitstempel - der Text laeuft dann sichtbar aus dem Takt. Diese Merkmale
/// werden deshalb VOR dem Wegwerfen der Klammern gelesen und muessen auf
/// beiden Seiten uebereinstimmen.
fn version_markers(text: &str) -> HashSet<&'static str> {
    let lower = text.to_lowercase();
    let mut out = HashSet::new();
    // Reihenfolge egal, aber "sped up"/"speed up" vor "up" pruefen waere
    // sinnlos - es wird auf ganze Begriffe geprueft, nicht auf Teilwoerter.
    for (needle, marker) in [
        ("sped up", "speed"),
        ("speed up", "speed"),
        ("spedup", "speed"),
        ("nightcore", "speed"),
        ("slowed", "slowed"),
        ("reverb", "slowed"),
        ("live", "live"),
        ("remix", "remix"),
        ("acoustic", "acoustic"),
        ("akustik", "acoustic"),
        ("unplugged", "acoustic"),
        ("instrumental", "instrumental"),
        ("karaoke", "instrumental"),
        ("cover", "cover"),
    ] {
        if lower.contains(needle) {
            out.insert(marker);
        }
    }
    out
}

fn candidate_ok(requested_title: &str, requested_artist: &str, got_title: &str, got_artist: &str) -> bool {
    if version_markers(requested_title) != version_markers(got_title) {
        return false;
    }
    similarity_ok(requested_title, got_title) && similarity_ok(requested_artist, got_artist)
}

/// Passt die Laufzeit? lrclib liefert zu jedem Treffer die Dauer der
/// Aufnahme mit. Zwei Fassungen desselben Songs unterscheiden sich fast
/// immer deutlich in der Laenge (beschleunigt, Live, Radio-Edit) - und
/// genau bei denen sind die Zeitstempel der anderen Fassung unbrauchbar.
/// Ohne bekannte Dauer (Gast-Warteschlange o.ae.) blockt das nichts.
const DURATION_TOLERANCE_SECONDS: f64 = 4.0;

fn duration_ok(requested: Option<f64>, candidate: Option<f64>) -> bool {
    match (requested, candidate) {
        (Some(a), Some(b)) if a > 0.0 && b > 0.0 => (a - b).abs() <= DURATION_TOLERANCE_SECONDS,
        _ => true,
    }
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
///
/// `q` kommt vorformatiert rein (statt hier aus title+artist gebaut) - der
/// Aufrufer entscheidet, ob der Interpret mit in die Suchanfrage soll (siehe
/// fetch_lyrics: bei uns kommen Titel/Interpret roh von YouTube, der
/// "Interpret" ist da haeufig eher der Kanalname als der echte Kuenstler -
/// eine reine Titel-Suche findet dann oft etwas, das die Interpret-Suche nie
/// gefunden haette).
/// `duration` (falls bekannt) entscheidet zusaetzlich mit: unter den
/// passenden Kandidaten gewinnt der mit der aehnlichsten Laufzeit, und wer
/// weiter als DURATION_TOLERANCE_SECONDS daneben liegt, faellt ganz raus.
/// Vorher wurde einfach der erste akzeptable genommen - bei einem Song, den
/// es in mehreren Fassungen gibt, war das oft die falsche.
///
/// Kandidaten MIT Zeitstempeln werden bevorzugt: ein unsynchronisierter
/// Treffer waere zwar auch "richtig", nimmt aber dem Karaoke-Modus die
/// Grundlage, obwohl ein paar Plaetze weiter unten vielleicht derselbe Song
/// mit Zeitstempeln steht.
async fn lrclib_search(
    client: &reqwest::Client,
    q: String,
    title: &str,
    artist: &str,
    duration: Option<f64>,
) -> Option<LrcHit> {
    let resp = client.get(LRCLIB_SEARCH).query(&[("q", q)]).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let items: Vec<serde_json::Value> = resp.json().await.ok()?;
    let mut best: Option<(f64, bool, LrcHit)> = None;
    for item in items.iter().take(20) {
        let track_name = str_field(item, "trackName").unwrap_or_default();
        let artist_name = str_field(item, "artistName").unwrap_or_default();
        if !candidate_ok(title, artist, &track_name, &artist_name) {
            continue;
        }
        let cand_duration = item.get("duration").and_then(|d| d.as_f64());
        if !duration_ok(duration, cand_duration) {
            continue;
        }
        let synced = str_field(item, "syncedLyrics");
        let plain = str_field(item, "plainLyrics");
        if synced.is_none() && plain.is_none() {
            continue;
        }
        let has_synced = synced.is_some();
        let delta = match (duration, cand_duration) {
            (Some(a), Some(b)) => (a - b).abs(),
            _ => f64::MAX,
        };
        let hit = LrcHit { synced, plain, track_name, artist_name };
        let better = match &best {
            None => true,
            // Zeitstempel schlagen alles; erst danach entscheidet die Laufzeit.
            Some((best_delta, best_synced, _)) => {
                (has_synced && !*best_synced) || (has_synced == *best_synced && delta < *best_delta)
            }
        };
        if better {
            // Ein Treffer mit Zeitstempeln UND punktgenauer Laufzeit ist so
            // gut wie es wird - dann muss der Rest nicht mehr angesehen werden.
            let perfect = has_synced && delta <= 1.0;
            best = Some((delta, has_synced, hit));
            if perfect {
                break;
            }
        }
    }
    best.map(|(_, _, hit)| hit)
}

/// Macht aus einem LRC-Text ("[01:23.45] Zeile") einfachen Text. Gebraucht
/// fuer den allerletzten Ausweg unten: die Zeitstempel einer ANDEREN Fassung
/// waeren sichtbar falsch, der Wortlaut ist aber immer noch nuetzlich.
fn strip_lrc_timestamps(lrc: &str) -> String {
    static TS: OnceLock<Regex> = OnceLock::new();
    let ts = TS.get_or_init(|| Regex::new(r"\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]").unwrap());
    lrc.lines()
        .map(|l| ts.replace_all(l, "").trim().to_string())
        .collect::<Vec<_>>()
        .join("\n")
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
    // Mehrfach genannte Interpreten raus, BEVOR irgendeine Quelle gefragt
    // wird: mit "Kanye Wests, Kanye Wests" sucht man nach einem Kuenstler,
    // den es nicht gibt - alle drei Quellen liefern dann nichts Passendes,
    // und uebrig bleibt der schlechteste Ausweg (fremder Text ohne
    // Zeitstempel). Genau das war "der dumme Songtext".
    let artist = entdoppelter_interpret(&artist);
    let client = reqwest::Client::builder()
        .user_agent("meine-musik/0.1 (+https://github.com/Gaboro030/meine-musik-app)")
        .build()
        .map_err(|e| e.to_string())?;

    // Alle drei Quellen gleichzeitig anfragen statt nacheinander (get ->
    // search -> ovh) - die Wartezeit ist dann die der langsamsten Quelle,
    // nicht die Summe aller drei. Kostet ein paar unnoetige Requests wenn
    // die erste Quelle schon einen Treffer liefert, spart dafuer im
    // Normalfall spuerbar Zeit bis die Lyrics im Overlay stehen.
    let search_q = format!("{} {}", clean_query_text(&artist), clean_query_text(&title));
    let (get_hit, search_hit, ovh_hit) = tokio::join!(
        lrclib_get(&client, &title, &artist, duration),
        lrclib_search(&client, search_q, &title, &artist, duration),
        lyrics_ovh(&client, &title, &artist),
    );

    let get_hit = get_hit.filter(|h| candidate_ok(&title, &artist, &h.track_name, &h.artist_name));
    // Ein Treffer OHNE Zeitstempel aus der Exakt-Abfrage soll einen Treffer
    // MIT Zeitstempeln aus der Suche nicht verdraengen - sonst verliert der
    // Karaoke-Modus seine Grundlage, obwohl die passenden Zeiten da waeren.
    let hit = match (get_hit, search_hit) {
        (Some(g), Some(s)) if g.synced.is_none() && s.synced.is_some() => Some(s),
        (Some(g), _) => Some(g),
        (None, s) => s,
    };

    let (mut synced, mut plain) = match hit {
        Some(h) => (h.synced, h.plain),
        None => (None, None),
    };
    if plain.is_none() && synced.is_none() {
        plain = ovh_hit;
    }

    // Letzter Ausweg, nur wenn ALLE drei obigen Quellen leer ausgingen: bei
    // uns kommen Titel/Interpret roh von YouTube, der "Interpret" ist da
    // haeufig eher der Kanalname (z.B. "Rolitas 30 Seconds.") als der
    // tatsaechliche Kuenstler - jede der drei Quellen oben haette dann nie
    // treffen koennen, egal wie gut ihr Ranking ist. Eine reine Titel-Suche
    // (Interpret als leerer String an candidate_ok - similarity_ok laesst
    // einen leeren "requested"-Wert alles durch) findet oft trotzdem den
    // richtigen Song. Bewusst NUR als letzter Ausweg, nicht parallel zu den
    // anderen: die Interpret-Pruefung bleibt fuer den Normalfall so streng
    // wie bisher (siehe candidate_ok/similarity_ok-Tests), das hier weicht
    // sie nur auf, wenn wir sonst "keine Lyrics gefunden" zeigen wuerden.
    if synced.is_none() && plain.is_none() {
        let title_only_q = clean_query_text(&title);
        if let Some(h) = lrclib_search(&client, title_only_q, &title, "", duration).await {
            synced = h.synced;
            plain = h.plain;
        }
    }

    // Allerletzter Ausweg, wenn selbst das nichts brachte UND eine Dauer
    // bekannt war: dieselbe Titel-Suche ohne Laufzeit-Filter. Besser der
    // Text einer anderen Fassung als gar keiner - aber nur der reine Text,
    // die Zeitstempel der falschen Fassung wuerden sichtbar aus dem Takt
    // laufen und sind schlimmer als gar keine.
    if synced.is_none() && plain.is_none() && duration.is_some() {
        let title_only_q = clean_query_text(&title);
        if let Some(h) = lrclib_search(&client, title_only_q, &title, "", None).await {
            plain = h.plain.or_else(|| h.synced.as_deref().map(strip_lrc_timestamps));
        }
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
    fn doppelt_genannter_interpret_wird_zusammengefasst() {
        // Genau der Fall aus der Bibliothek: der Interpret stand zweimal
        // da, damit fand keine Quelle etwas und uebrig blieb ein fremder
        // Text ohne Zeitstempel.
        assert_eq!(entdoppelter_interpret("Kanye Wests, Kanye Wests"), "Kanye Wests");
        assert_eq!(entdoppelter_interpret("Eminem & Eminem"), "Eminem");
        assert_eq!(entdoppelter_interpret("Drake feat. Drake"), "Drake");
    }

    #[test]
    fn echte_zweitinterpreten_bleiben_erhalten() {
        // Die Gegenprobe: hier waere Wegwerfen falsch.
        assert_eq!(
            entdoppelter_interpret("Kanye West, Jamie Foxx"),
            "Kanye West, Jamie Foxx"
        );
        assert_eq!(entdoppelter_interpret("Eminem feat. Rihanna"), "Eminem, Rihanna");
    }

    #[test]
    fn interpret_ohne_doppelung_bleibt_unveraendert() {
        assert_eq!(entdoppelter_interpret("Kanye West"), "Kanye West");
        assert_eq!(entdoppelter_interpret(""), "");
    }

    #[test]
    fn angehaengtes_s_verhindert_den_treffer_nicht_mehr() {
        // "Kanye Wests" vs. "Kanye West": ohne Entpluralisierung lag die
        // Wortmengen-Ueberlappung bei 1/3 und damit unter der Schwelle -
        // der richtige Songtext wurde deshalb verworfen.
        assert!(similarity_ok("Kanye Wests", "Kanye West"));
        assert!(similarity_ok("The Beatles", "The Beatle"));
    }

    #[test]
    fn entpluralisieren_frisst_keine_kurzen_woerter_und_kein_doppel_s() {
        assert_eq!(entpluralisiert("wests"), "west");
        assert_eq!(entpluralisiert("bass"), "bass"); // nicht "bas"
        assert_eq!(entpluralisiert("is"), "is"); // zu kurz
        assert_eq!(entpluralisiert("west"), "west");
    }

    #[test]
    fn verschiedene_kuenstler_gelten_weiter_als_verschieden() {
        // Die Entpluralisierung darf die Trennschaerfe nicht aufweichen.
        assert!(!similarity_ok("Kanye West", "Taylor Swift"));
    }

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

    #[test]
    fn version_markers_are_recognised() {
        assert!(version_markers("Song (Sped Up)").contains("speed"));
        assert!(version_markers("Song - Nightcore").contains("speed"));
        assert!(version_markers("Song (slowed + reverb)").contains("slowed"));
        assert!(version_markers("Song (Live at Wembley)").contains("live"));
        assert!(version_markers("Song (Tiësto Remix)").contains("remix"));
        assert!(version_markers("Song (Acoustic)").contains("acoustic"));
        assert!(version_markers("Song").is_empty());
    }

    #[test]
    fn candidate_ok_rejects_a_different_version_of_the_same_song() {
        // Der eigentliche Fehler: clean_query_text wirft die Klammer weg,
        // danach sahen beide Titel identisch aus - die Studio-Zeitstempel
        // landeten auf der beschleunigten Fassung und liefen aus dem Takt.
        assert!(!candidate_ok("Blinding Lights (Sped Up)", "The Weeknd", "Blinding Lights", "The Weeknd"));
        assert!(!candidate_ok("Blinding Lights", "The Weeknd", "Blinding Lights (Live)", "The Weeknd"));
        assert!(!candidate_ok("Song", "A", "Song (Remix)", "A"));
        // Gleiche Fassung auf beiden Seiten bleibt erlaubt.
        assert!(candidate_ok("Song (Live)", "A", "Song - Live", "A"));
        // Reines Rauschen ist KEIN Fassungsmerkmal und darf weiter durch.
        assert!(candidate_ok("Song (Official Video)", "A", "Song", "A"));
        assert!(candidate_ok("Song", "A", "Song (Remastered)", "A"));
    }

    #[test]
    fn duration_ok_filters_only_when_both_sides_are_known() {
        assert!(duration_ok(Some(200.0), Some(202.0)));
        assert!(!duration_ok(Some(200.0), Some(160.0))); // beschleunigte Fassung
        assert!(duration_ok(None, Some(160.0)));
        assert!(duration_ok(Some(200.0), None));
        assert!(duration_ok(Some(0.0), Some(160.0))); // 0 = unbekannt
    }

    #[test]
    fn strip_lrc_timestamps_keeps_only_the_words() {
        let lrc = "[00:12.34] Erste Zeile\n[01:02.5]Zweite Zeile";
        assert_eq!(strip_lrc_timestamps(lrc), "Erste Zeile\nZweite Zeile");
    }
}
