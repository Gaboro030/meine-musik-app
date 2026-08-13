//! YouTube-(Music-)Playlists lesen und schreiben - Etappe 3 des Abgleichs.
//!
//! YouTube Music hat keine eigene Schnittstelle; die Playlists dort SIND
//! YouTube-Playlists und laufen ueber die YouTube Data API v3.
//!
//! Der grosse Unterschied zu Spotify ist das Kontingent. Google rechnet
//! nicht in Anfragen, sondern in "Einheiten", und ein Konto hat davon
//! 10.000 pro Tag:
//!
//! | Aufruf                | Einheiten |
//! |-----------------------|-----------|
//! | playlists.list        |         1 |
//! | playlistItems.list    |         1 |
//! | videos.list           |         1 |
//! | playlists.insert      |        50 |
//! | playlistItems.insert  |        50 |
//! | playlistItems.delete  |        50 |
//! | **search.list**       |   **100** |
//!
//! Einen Titel zu suchen und einzutragen kostet also rund 150 Einheiten -
//! macht etwa 65 Songs pro Tag. Das ist keine Kleinigkeit, die man erst
//! bemerkt, wenn nichts mehr geht: deshalb zaehlt dieses Modul selbst mit
//! und sagt vorher Bescheid, statt den Nutzer in ein wortkarges 403 des
//! Anbieters laufen zu lassen.
//!
//! Der Zaehler wird um Mitternacht pazifischer Zeit zurueckgesetzt - so
//! macht es Google, und ein eigener Zaehler, der zu einem anderen
//! Zeitpunkt springt, waere schlimmer als keiner.

use crate::cloudauth::{gueltiges_token, Dienst};
use serde::{Deserialize, Serialize};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const API: &str = "https://www.googleapis.com/youtube/v3";
const TAGESKONTINGENT: u32 = 10_000;

/// Kosten der benutzten Aufrufe, laut Googles eigener Aufstellung.
const KOSTEN_LIST: u32 = 1;
const KOSTEN_SUCHE: u32 = 100;
const KOSTEN_SCHREIBEN: u32 = 50;

#[derive(Serialize, Clone)]
pub struct YtPlaylist {
    pub id: String,
    pub name: String,
    pub anzahl: u32,
}

#[derive(Serialize, Clone)]
pub struct YtTrack {
    pub video_id: String,
    /// Kennung des Eintrags IN der Playlist. Zum Entfernen braucht man
    /// diese, nicht die Video-Kennung - dasselbe Video kann mehrfach in
    /// derselben Playlist stehen.
    pub item_id: String,
    pub title: String,
    pub artist: String,
    pub duration_s: u64,
}

/* --- Kontingent ----------------------------------------------------------- */

#[derive(Serialize, Deserialize, Default)]
struct Kontingent {
    /// Tag in pazifischer Zeit als YYYY-MM-DD, damit der Zaehler zum
    /// selben Zeitpunkt springt wie Googles eigener.
    tag: String,
    verbraucht: u32,
}

/// Tagesdatum in pazifischer Zeit. Bewusst ohne Zeitzonen-Bibliothek: der
/// Unterschied zu UTC ist -8 Stunden (Winter) bzw. -7 (Sommer). Genau
/// genug fuer einen Zaehler, dessen einzige Aufgabe es ist, einmal am Tag
/// zu springen - eine Stunde Ungenauigkeit an zwei Tagen im Jahr aendert
/// daran nichts.
fn pazifischer_tag() -> String {
    let sekunden = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let verschoben = sekunden.saturating_sub(8 * 3600);
    let tage = verschoben / 86_400;
    // Tage seit 1970 in ein Datum - der uebliche Weg ohne Bibliothek.
    let (mut jahr, mut rest) = (1970i64, tage as i64);
    loop {
        let laenge = if schaltjahr(jahr) { 366 } else { 365 };
        if rest < laenge {
            break;
        }
        rest -= laenge;
        jahr += 1;
    }
    let monatslaengen = [
        31,
        if schaltjahr(jahr) { 29 } else { 28 },
        31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
    ];
    let mut monat = 1;
    for laenge in monatslaengen {
        if rest < laenge {
            break;
        }
        rest -= laenge;
        monat += 1;
    }
    format!("{jahr:04}-{monat:02}-{:02}", rest + 1)
}

fn schaltjahr(j: i64) -> bool {
    (j % 4 == 0 && j % 100 != 0) || j % 400 == 0
}

fn kontingent_pfad(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    use tauri::Manager;
    let state = app.try_state::<crate::commands::AppState>()?;
    Some(state.data_dir.join("youtube_kontingent.json"))
}

fn kontingent_lesen(app: &tauri::AppHandle) -> Kontingent {
    let heute = pazifischer_tag();
    let gelesen: Kontingent = kontingent_pfad(app)
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default();
    if gelesen.tag == heute {
        gelesen
    } else {
        Kontingent { tag: heute, verbraucht: 0 }
    }
}

fn kontingent_buchen(app: &tauri::AppHandle, einheiten: u32) {
    let mut k = kontingent_lesen(app);
    k.verbraucht = k.verbraucht.saturating_add(einheiten);
    if let Some(pfad) = kontingent_pfad(app) {
        if let Some(eltern) = pfad.parent() {
            let _ = std::fs::create_dir_all(eltern);
        }
        if let Ok(json) = serde_json::to_string(&k) {
            let _ = std::fs::write(pfad, json);
        }
    }
}

fn kontingent_pruefen(app: &tauri::AppHandle, braucht: u32) -> Result<(), String> {
    let k = kontingent_lesen(app);
    if k.verbraucht + braucht > TAGESKONTINGENT {
        return Err(format!(
            "Googles Tageskontingent ist aufgebraucht ({} von {} Einheiten). \
             Es wird um Mitternacht pazifischer Zeit zurueckgesetzt - das ist \
             morgens um 9 Uhr deutscher Zeit.",
            k.verbraucht, TAGESKONTINGENT
        ));
    }
    Ok(())
}

/// Wie viel ist heute noch drin? Das Frontend zeigt das an, bevor jemand
/// einen Abgleich mit 300 Titeln startet.
#[tauri::command]
pub fn youtube_kontingent(app: tauri::AppHandle) -> serde_json::Value {
    let k = kontingent_lesen(&app);
    let uebrig = TAGESKONTINGENT.saturating_sub(k.verbraucht);
    serde_json::json!({
        "verbraucht": k.verbraucht,
        "gesamt": TAGESKONTINGENT,
        "uebrig": uebrig,
        // Was der Nutzer eigentlich wissen will: wie viele Songs noch.
        "songs_uebrig": uebrig / (KOSTEN_SUCHE + KOSTEN_LIST + KOSTEN_SCHREIBEN),
    })
}

/* --- Anfragen ------------------------------------------------------------- */

async fn anfrage(
    app: &tauri::AppHandle,
    client_id: &str,
    methode: reqwest::Method,
    url: &str,
    koerper: Option<serde_json::Value>,
    kosten: u32,
) -> Result<serde_json::Value, String> {
    kontingent_pruefen(app, kosten)?;
    let token = gueltiges_token(app, Dienst::Google, client_id).await?;
    let client = reqwest::Client::new();
    let mut req = client
        .request(methode, url)
        .bearer_auth(&token)
        .timeout(Duration::from_secs(30));
    if let Some(k) = &koerper {
        req = req.json(k);
    }
    let resp = req.send().await.map_err(|e| format!("YouTube nicht erreichbar: {e}"))?;
    let status = resp.status();
    // Auch abgelehnte Anfragen kosten - buchen, bevor entschieden wird.
    kontingent_buchen(app, kosten);

    if status == reqwest::StatusCode::NO_CONTENT {
        return Ok(serde_json::Value::Null);
    }
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        let grund = serde_json::from_str::<serde_json::Value>(&text)
            .ok()
            .and_then(|v| {
                v.pointer("/error/message")
                    .and_then(|m| m.as_str())
                    .map(|s| s.to_string())
            })
            .unwrap_or_else(|| text.chars().take(200).collect());
        // Der haeufigste Fall verdient eine Erklaerung statt einer
        // Fehlernummer.
        if grund.contains("quota") {
            return Err(
                "Googles Tageskontingent ist aufgebraucht. Es wird um Mitternacht \
                 pazifischer Zeit zurueckgesetzt (morgens um 9 Uhr deutscher Zeit)."
                    .into(),
            );
        }
        return Err(format!("YouTube hat abgelehnt ({status}): {grund}"));
    }
    if text.trim().is_empty() {
        return Ok(serde_json::Value::Null);
    }
    serde_json::from_str(&text).map_err(|e| format!("Antwort nicht lesbar: {e}"))
}

async fn alle_seiten(
    app: &tauri::AppHandle,
    client_id: &str,
    basis_url: &str,
    kosten_pro_seite: u32,
) -> Result<Vec<serde_json::Value>, String> {
    let mut out = Vec::new();
    let mut token: Option<String> = None;
    for _ in 0..100 {
        let url = match &token {
            Some(t) => format!("{basis_url}&pageToken={t}"),
            None => basis_url.to_string(),
        };
        let seite = anfrage(app, client_id, reqwest::Method::GET, &url, None, kosten_pro_seite).await?;
        if let Some(items) = seite.get("items").and_then(|v| v.as_array()) {
            out.extend(items.iter().cloned());
        }
        match seite.get("nextPageToken").and_then(|v| v.as_str()) {
            Some(t) if !t.is_empty() => token = Some(t.to_string()),
            _ => break,
        }
    }
    Ok(out)
}

/* --- Dauer ---------------------------------------------------------------- */

/// Wandelt Googles Dauer-Angabe ("PT4M13S", "PT1H2M", "P1DT3H") in
/// Sekunden. Eigene kleine Zerlegung statt einer Bibliothek: es geht um
/// genau dieses eine Format, und Fehler daran faenden sich sonst erst im
/// fertigen Abgleich wieder.
fn iso_dauer_in_sekunden(text: &str) -> u64 {
    let mut sekunden: u64 = 0;
    let mut zahl: u64 = 0;
    let mut in_zeit = false;
    for c in text.chars() {
        match c {
            'P' => {}
            'T' => in_zeit = true,
            '0'..='9' => zahl = zahl * 10 + (c as u64 - '0' as u64),
            'D' => {
                sekunden += zahl * 86_400;
                zahl = 0;
            }
            // M steht vor dem T fuer Monate, danach fuer Minuten.
            'H' => {
                sekunden += zahl * 3_600;
                zahl = 0;
            }
            'M' if in_zeit => {
                sekunden += zahl * 60;
                zahl = 0;
            }
            'S' => {
                sekunden += zahl;
                zahl = 0;
            }
            _ => zahl = 0,
        }
    }
    sekunden
}

/* --- Lesen ---------------------------------------------------------------- */

#[tauri::command]
pub async fn youtube_playlists(
    app: tauri::AppHandle,
    client_id: String,
) -> Result<Vec<YtPlaylist>, String> {
    let url = format!("{API}/playlists?part=snippet,contentDetails&mine=true&maxResults=50");
    let items = alle_seiten(&app, &client_id, &url, KOSTEN_LIST).await?;
    Ok(items
        .iter()
        .filter_map(|p| {
            Some(YtPlaylist {
                id: p.get("id")?.as_str()?.to_string(),
                name: p
                    .pointer("/snippet/title")
                    .and_then(|v| v.as_str())
                    .unwrap_or("(ohne Namen)")
                    .to_string(),
                anzahl: p
                    .pointer("/contentDetails/itemCount")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0) as u32,
            })
        })
        .collect())
}

#[tauri::command]
pub async fn youtube_playlist_tracks(
    app: tauri::AppHandle,
    client_id: String,
    playlist_id: String,
) -> Result<Vec<YtTrack>, String> {
    let url = format!(
        "{API}/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId={playlist_id}"
    );
    let items = alle_seiten(&app, &client_id, &url, KOSTEN_LIST).await?;
    Ok(items
        .iter()
        .filter_map(|p| {
            let video_id = p
                .pointer("/contentDetails/videoId")
                .and_then(|v| v.as_str())?
                .to_string();
            let titel = p
                .pointer("/snippet/title")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            // Geloeschte und private Videos bleiben als Platzhalter in der
            // Playlist stehen. Die mitzuzaehlen wuerde beim Abgleich
            // dauernd "fehlt bei dir" melden.
            if titel == "Deleted video" || titel == "Private video" {
                return None;
            }
            Some(YtTrack {
                video_id,
                item_id: p.get("id").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
                title: titel,
                artist: p
                    .pointer("/snippet/videoOwnerChannelTitle")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                // Die Dauer steht in playlistItems nicht drin; sie wird
                // bei Bedarf ueber youtube_dauern nachgeholt.
                duration_s: 0,
            })
        })
        .collect())
}

/// Laufzeiten zu bis zu 50 Videos auf einmal - eine Einheit fuer alle
/// zusammen. Einzeln abzufragen waere 50-mal so teuer.
#[tauri::command]
pub async fn youtube_dauern(
    app: tauri::AppHandle,
    client_id: String,
    video_ids: Vec<String>,
) -> Result<std::collections::HashMap<String, u64>, String> {
    let mut out = std::collections::HashMap::new();
    for haeppchen in video_ids.chunks(50) {
        let url = format!("{API}/videos?part=contentDetails&id={}", haeppchen.join(","));
        let antwort = anfrage(&app, &client_id, reqwest::Method::GET, &url, None, KOSTEN_LIST).await?;
        if let Some(items) = antwort.get("items").and_then(|v| v.as_array()) {
            for v in items {
                let (Some(id), Some(dauer)) = (
                    v.get("id").and_then(|x| x.as_str()),
                    v.pointer("/contentDetails/duration").and_then(|x| x.as_str()),
                ) else {
                    continue;
                };
                out.insert(id.to_string(), iso_dauer_in_sekunden(dauer));
            }
        }
    }
    Ok(out)
}

/* --- Suchen --------------------------------------------------------------- */

/// Teuerster Aufruf im ganzen Modul: 100 Einheiten, also ein Hundertstel
/// des Tagesbudgets fuer einen einzigen Titel.
#[tauri::command]
pub async fn youtube_suche(
    app: tauri::AppHandle,
    client_id: String,
    title: String,
    artist: String,
) -> Result<Option<YtTrack>, String> {
    let frage = if artist.trim().is_empty() {
        title.clone()
    } else {
        format!("{title} {artist}")
    };
    let url = format!(
        "{API}/search?part=snippet&type=video&videoCategoryId=10&maxResults=10&q={}",
        percent_encoding::utf8_percent_encode(&frage, percent_encoding::NON_ALPHANUMERIC)
    );
    let antwort = anfrage(&app, &client_id, reqwest::Method::GET, &url, None, KOSTEN_SUCHE).await?;
    let leer = Vec::new();
    let items = antwort.get("items").and_then(|v| v.as_array()).unwrap_or(&leer);

    for item in items {
        let Some(video_id) = item.pointer("/id/videoId").and_then(|v| v.as_str()) else {
            continue;
        };
        let gefunden = item
            .pointer("/snippet/title")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        let kanal = item
            .pointer("/snippet/channelTitle")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        // Dieselbe Pruefung wie beim Herunterladen: keine Live-Fassung,
        // kein Remix, kein Untertitel-Reupload, wenn nicht danach gesucht
        // wurde. Sonst landet in der Playlist eine andere Aufnahme als in
        // der Bibliothek.
        if !crate::discovery::fassung_passt(&title, &gefunden, &kanal) {
            continue;
        }
        return Ok(Some(YtTrack {
            video_id: video_id.to_string(),
            item_id: String::new(),
            title: gefunden,
            artist: kanal,
            duration_s: 0,
        }));
    }
    Ok(None)
}

/* --- Schreiben ------------------------------------------------------------ */

#[tauri::command]
pub async fn youtube_playlist_erstellen(
    app: tauri::AppHandle,
    client_id: String,
    name: String,
) -> Result<YtPlaylist, String> {
    let koerper = serde_json::json!({
        "snippet": { "title": name, "description": "Von Reson abgeglichen" },
        // Nicht oeffentlich - eine aus Reson erzeugte Liste soll nicht
        // ungefragt auf dem Kanal auftauchen.
        "status": { "privacyStatus": "private" },
    });
    let antwort = anfrage(
        &app,
        &client_id,
        reqwest::Method::POST,
        &format!("{API}/playlists?part=snippet,status"),
        Some(koerper),
        KOSTEN_SCHREIBEN,
    )
    .await?;
    let id = antwort
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Playlist wurde angelegt, aber ohne Kennung.".to_string())?;
    Ok(YtPlaylist { id: id.to_string(), name, anzahl: 0 })
}

#[tauri::command]
pub async fn youtube_track_hinzufuegen(
    app: tauri::AppHandle,
    client_id: String,
    playlist_id: String,
    video_id: String,
) -> Result<(), String> {
    let koerper = serde_json::json!({
        "snippet": {
            "playlistId": playlist_id,
            "resourceId": { "kind": "youtube#video", "videoId": video_id }
        }
    });
    anfrage(
        &app,
        &client_id,
        reqwest::Method::POST,
        &format!("{API}/playlistItems?part=snippet"),
        Some(koerper),
        KOSTEN_SCHREIBEN,
    )
    .await?;
    Ok(())
}

/// Entfernt ueber die Eintrags-Kennung, NICHT die Video-Kennung: dasselbe
/// Video kann mehrfach in derselben Playlist stehen, und dann muss klar
/// sein, welcher der Eintraege gemeint ist.
#[tauri::command]
pub async fn youtube_track_entfernen(
    app: tauri::AppHandle,
    client_id: String,
    item_id: String,
) -> Result<(), String> {
    anfrage(
        &app,
        &client_id,
        reqwest::Method::DELETE,
        &format!("{API}/playlistItems?id={item_id}"),
        None,
        KOSTEN_SCHREIBEN,
    )
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn iso_dauer_wird_richtig_gelesen() {
        assert_eq!(iso_dauer_in_sekunden("PT4M13S"), 253);
        assert_eq!(iso_dauer_in_sekunden("PT1H2M3S"), 3723);
        assert_eq!(iso_dauer_in_sekunden("PT45S"), 45);
        assert_eq!(iso_dauer_in_sekunden("PT2H"), 7200);
        assert_eq!(iso_dauer_in_sekunden("P1DT3H"), 97_200);
    }

    #[test]
    fn minuten_und_monate_werden_nicht_verwechselt() {
        // "M" vor dem T sind Monate, danach Minuten. Ohne die
        // Unterscheidung waere aus 3 Minuten ein Vielfaches davon
        // geworden.
        assert_eq!(iso_dauer_in_sekunden("PT3M"), 180);
    }

    #[test]
    fn kaputte_dauer_ergibt_null_statt_unsinn() {
        assert_eq!(iso_dauer_in_sekunden(""), 0);
        assert_eq!(iso_dauer_in_sekunden("keine Dauer"), 0);
    }

    #[test]
    fn pazifischer_tag_hat_das_richtige_format() {
        let tag = pazifischer_tag();
        assert_eq!(tag.len(), 10, "war {tag}");
        let teile: Vec<&str> = tag.split('-').collect();
        assert_eq!(teile.len(), 3);
        let jahr: i64 = teile[0].parse().unwrap();
        let monat: u32 = teile[1].parse().unwrap();
        let tag_im_monat: u32 = teile[2].parse().unwrap();
        assert!(jahr >= 2024 && jahr < 2100, "Jahr war {jahr}");
        assert!((1..=12).contains(&monat), "Monat war {monat}");
        assert!((1..=31).contains(&tag_im_monat), "Tag war {tag_im_monat}");
    }

    #[test]
    fn schaltjahre_stimmen() {
        assert!(schaltjahr(2024));
        assert!(!schaltjahr(2023));
        assert!(!schaltjahr(1900)); // durch 100 teilbar, aber nicht durch 400
        assert!(schaltjahr(2000));
    }

    #[test]
    fn kontingent_reicht_fuer_die_erwartete_zahl_songs() {
        // Suchen (100) + Dauer holen (1) + Eintragen (50) = 151 pro Titel.
        let pro_song = KOSTEN_SUCHE + KOSTEN_LIST + KOSTEN_SCHREIBEN;
        assert_eq!(pro_song, 151);
        assert_eq!(TAGESKONTINGENT / pro_song, 66);
    }
}
