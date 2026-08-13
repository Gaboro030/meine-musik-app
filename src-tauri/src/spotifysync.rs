//! Spotify-Playlists lesen und schreiben - Etappe 2 des Abgleichs.
//!
//! Setzt auf cloudauth.rs auf: das Token besorgt sich jeder Aufruf ueber
//! `gueltiges_token`, das notfalls selbst erneuert. Dieses Modul kuemmert
//! sich nur um die Web-API.
//!
//! Zwei Dinge, die bei Spotify jeder Aufruf beachten muss:
//!
//! * **Seitenweise Antworten.** /me/playlists und die Titelliste liefern
//!   hoechstens 50 Eintraege und dazu ein `next`-Feld. Wer das ignoriert,
//!   sieht bei jeder groesseren Bibliothek nur den Anfang und wuerde beim
//!   Abgleich alles Weitere fuer "geloescht" halten.
//! * **429 mit Retry-After.** Spotify drosselt und sagt dabei, wie lange
//!   zu warten ist. Das einfach als Fehler durchzureichen wuerde einen
//!   Abgleich mittendrin abbrechen lassen.

use crate::cloudauth::{gueltiges_token, Dienst};
use serde::Serialize;
use std::time::Duration;

const API: &str = "https://api.spotify.com/v1";
/// Spotify nimmt hoechstens 100 Titel pro Schreibvorgang entgegen.
const MAX_PRO_SCHREIBVORGANG: usize = 100;
/// Wie oft nach einer Drosselung erneut versucht wird, bevor aufgegeben wird.
const MAX_VERSUCHE: u32 = 4;

#[derive(Serialize, Clone)]
pub struct CloudPlaylist {
    pub id: String,
    pub name: String,
    pub anzahl: u32,
    /// Fremde Playlists (denen man nur folgt) lassen sich nicht beschreiben -
    /// das Frontend soll sie gar nicht erst zum Abgleich anbieten.
    pub schreibbar: bool,
}

#[derive(Serialize, Clone, PartialEq)]
pub struct CloudTrack {
    pub uri: String,
    pub title: String,
    pub artist: String,
    pub duration_ms: u64,
}

/* --- Anfragen mit Drosselungs-Behandlung ---------------------------------- */

async fn anfrage(
    app: &tauri::AppHandle,
    client_id: &str,
    methode: reqwest::Method,
    url: &str,
    koerper: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let mut versuch = 0u32;
    loop {
        let token = gueltiges_token(app, Dienst::Spotify, client_id).await?;
        let mut req = client
            .request(methode.clone(), url)
            .bearer_auth(&token)
            .timeout(Duration::from_secs(30));
        if let Some(k) = &koerper {
            req = req.json(k);
        }
        let resp = req.send().await.map_err(|e| format!("Spotify nicht erreichbar: {e}"))?;
        let status = resp.status();

        // 429: Spotify sagt selbst, wie lange zu warten ist. Abwarten und
        // noch einmal - sonst reisst ein Abgleich mittendrin ab.
        if status.as_u16() == 429 && versuch < MAX_VERSUCHE {
            let warten = resp
                .headers()
                .get("retry-after")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(2)
                .min(60);
            tokio::time::sleep(Duration::from_secs(warten)).await;
            versuch += 1;
            continue;
        }

        // 204 (z.B. bei manchen Schreibvorgaengen) hat keinen Koerper.
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
            return Err(format!("Spotify hat abgelehnt ({status}): {grund}"));
        }
        if text.trim().is_empty() {
            return Ok(serde_json::Value::Null);
        }
        return serde_json::from_str(&text).map_err(|e| format!("Antwort nicht lesbar: {e}"));
    }
}

/// Folgt dem `next`-Feld, bis alle Seiten eingesammelt sind.
async fn alle_seiten(
    app: &tauri::AppHandle,
    client_id: &str,
    start_url: &str,
) -> Result<Vec<serde_json::Value>, String> {
    let mut out = Vec::new();
    let mut url = start_url.to_string();
    // Notbremse: eine kaputte Antwort, die immer auf sich selbst zeigt,
    // wuerde sonst ewig weiterlaufen.
    for _ in 0..200 {
        let seite = anfrage(app, client_id, reqwest::Method::GET, &url, None).await?;
        if let Some(items) = seite.get("items").and_then(|v| v.as_array()) {
            out.extend(items.iter().cloned());
        }
        match seite.get("next").and_then(|v| v.as_str()) {
            Some(next) if !next.is_empty() => url = next.to_string(),
            _ => break,
        }
    }
    Ok(out)
}

/* --- Lesen ---------------------------------------------------------------- */

async fn eigene_id(app: &tauri::AppHandle, client_id: &str) -> Result<String, String> {
    let me = anfrage(app, client_id, reqwest::Method::GET, &format!("{API}/me"), None).await?;
    me.get("id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Konto-Kennung fehlt in der Antwort.".to_string())
}

#[tauri::command]
pub async fn spotify_playlists(
    app: tauri::AppHandle,
    client_id: String,
) -> Result<Vec<CloudPlaylist>, String> {
    let ich = eigene_id(&app, &client_id).await?;
    let items = alle_seiten(&app, &client_id, &format!("{API}/me/playlists?limit=50")).await?;
    Ok(items
        .iter()
        .filter_map(|p| {
            let id = p.get("id")?.as_str()?.to_string();
            let name = p.get("name").and_then(|v| v.as_str()).unwrap_or("(ohne Namen)").to_string();
            let anzahl = p.pointer("/tracks/total").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
            let besitzer = p.pointer("/owner/id").and_then(|v| v.as_str()) == Some(ich.as_str());
            let gemeinsam = p.get("collaborative").and_then(|v| v.as_bool()).unwrap_or(false);
            Some(CloudPlaylist {
                id,
                name,
                anzahl,
                schreibbar: besitzer || gemeinsam,
            })
        })
        .collect())
}

/// Wandelt einen Eintrag aus der Titelliste um. Getrennt von der Abfrage,
/// damit die Umwandlung ohne Netz pruefbar ist.
fn track_aus_json(item: &serde_json::Value) -> Option<CloudTrack> {
    // Der eigentliche Titel steckt bei /playlists/../tracks unter "track";
    // bei der Suche liegt er direkt vor.
    let t = item.get("track").unwrap_or(item);
    // Lokale Dateien und entfernte Titel kommen als null oder ohne uri.
    let uri = t.get("uri")?.as_str()?.to_string();
    if !uri.starts_with("spotify:track:") {
        return None;
    }
    let title = t.get("name")?.as_str()?.to_string();
    let artist = t
        .get("artists")
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|x| x.get("name").and_then(|n| n.as_str()))
                .collect::<Vec<_>>()
                .join(", ")
        })
        .unwrap_or_default();
    let duration_ms = t.get("duration_ms").and_then(|v| v.as_u64()).unwrap_or(0);
    Some(CloudTrack { uri, title, artist, duration_ms })
}

#[tauri::command]
pub async fn spotify_playlist_tracks(
    app: tauri::AppHandle,
    client_id: String,
    playlist_id: String,
) -> Result<Vec<CloudTrack>, String> {
    let url = format!(
        "{API}/playlists/{playlist_id}/tracks?limit=100&fields=next,items(track(uri,name,duration_ms,artists(name)))"
    );
    let items = alle_seiten(&app, &client_id, &url).await?;
    Ok(items.iter().filter_map(track_aus_json).collect())
}

/* --- Suchen --------------------------------------------------------------- */

/// Wie gut passt ein Suchtreffer? Kleiner ist besser, None heisst
/// "kommt nicht in Frage".
///
/// Titel und Interpret muessen sich ueberlappen, die Laufzeit darf um
/// hoechstens fuenf Sekunden abweichen. Das ist strenger als beim
/// YouTube-Abgleich, und mit Absicht: hier wird etwas in eine fremde
/// Playlist geschrieben. Ein falscher Treffer faellt dort auf und muss
/// von Hand wieder heraus - lieber nichts eintragen als das Falsche.
fn treffer_wert(
    ziel_titel: &str,
    ziel_artist: &str,
    ziel_dauer_ms: u64,
    kandidat: &CloudTrack,
) -> Option<u32> {
    if !woerter_passen(ziel_titel, &kandidat.title) {
        return None;
    }
    if !ziel_artist.trim().is_empty() && !woerter_passen(ziel_artist, &kandidat.artist) {
        return None;
    }
    let abweichung = if ziel_dauer_ms > 0 && kandidat.duration_ms > 0 {
        let d = ziel_dauer_ms.abs_diff(kandidat.duration_ms);
        if d > 5000 {
            return None;
        }
        (d / 1000) as u32
    } else {
        // Ohne bekannte Laufzeit nicht ablehnen, aber schlechter bewerten
        // als einen Treffer, dessen Laenge nachweislich stimmt.
        6
    };
    Some(abweichung)
}

/// Wortmengen-Vergleich, unempfindlich gegen Reihenfolge, Zusaetze in
/// Klammern und Gross-/Kleinschreibung.
fn woerter_passen(a: &str, b: &str) -> bool {
    let wa = wortmenge(a);
    let wb = wortmenge(b);
    if wa.is_empty() || wb.is_empty() {
        return false;
    }
    let gemeinsam = wa.iter().filter(|w| wb.contains(*w)).count();
    let vereinigt = wa.len() + wb.len() - gemeinsam;
    vereinigt > 0 && (gemeinsam as f64 / vereinigt as f64) >= 0.5
}

fn wortmenge(text: &str) -> std::collections::HashSet<String> {
    text.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .filter(|w| w.len() > 1)
        .map(|w| w.to_string())
        .collect()
}

#[tauri::command]
pub async fn spotify_suche(
    app: tauri::AppHandle,
    client_id: String,
    title: String,
    artist: String,
    duration_ms: Option<u64>,
) -> Result<Option<CloudTrack>, String> {
    let frage = if artist.trim().is_empty() {
        title.clone()
    } else {
        format!("{title} {artist}")
    };
    let url = format!(
        "{API}/search?type=track&limit=20&q={}",
        percent_encoding::utf8_percent_encode(&frage, percent_encoding::NON_ALPHANUMERIC)
    );
    let antwort = anfrage(&app, &client_id, reqwest::Method::GET, &url, None).await?;
    let leer = Vec::new();
    let items = antwort
        .pointer("/tracks/items")
        .and_then(|v| v.as_array())
        .unwrap_or(&leer);

    let mut beste: Option<(u32, CloudTrack)> = None;
    for item in items {
        let Some(kandidat) = track_aus_json(item) else { continue };
        let Some(wert) = treffer_wert(&title, &artist, duration_ms.unwrap_or(0), &kandidat) else {
            continue;
        };
        if beste.as_ref().is_none_or(|(b, _)| wert < *b) {
            beste = Some((wert, kandidat));
        }
    }
    Ok(beste.map(|(_, t)| t))
}

/* --- Schreiben ------------------------------------------------------------ */

#[tauri::command]
pub async fn spotify_playlist_erstellen(
    app: tauri::AppHandle,
    client_id: String,
    name: String,
) -> Result<CloudPlaylist, String> {
    let ich = eigene_id(&app, &client_id).await?;
    let koerper = serde_json::json!({
        "name": name,
        // Nicht oeffentlich: eine aus Reson erzeugte Playlist soll nicht
        // ungefragt im Profil des Nutzers auftauchen.
        "public": false,
        "description": "Von Reson abgeglichen",
    });
    let antwort = anfrage(
        &app,
        &client_id,
        reqwest::Method::POST,
        &format!("{API}/users/{ich}/playlists"),
        Some(koerper),
    )
    .await?;
    let id = antwort
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Playlist wurde angelegt, aber ohne Kennung.".to_string())?;
    Ok(CloudPlaylist {
        id: id.to_string(),
        name,
        anzahl: 0,
        schreibbar: true,
    })
}

#[tauri::command]
pub async fn spotify_tracks_hinzufuegen(
    app: tauri::AppHandle,
    client_id: String,
    playlist_id: String,
    uris: Vec<String>,
) -> Result<u32, String> {
    let mut geschrieben = 0u32;
    for haeppchen in uris.chunks(MAX_PRO_SCHREIBVORGANG) {
        anfrage(
            &app,
            &client_id,
            reqwest::Method::POST,
            &format!("{API}/playlists/{playlist_id}/tracks"),
            Some(serde_json::json!({ "uris": haeppchen })),
        )
        .await?;
        geschrieben += haeppchen.len() as u32;
    }
    Ok(geschrieben)
}

#[tauri::command]
pub async fn spotify_tracks_entfernen(
    app: tauri::AppHandle,
    client_id: String,
    playlist_id: String,
    uris: Vec<String>,
) -> Result<u32, String> {
    let mut entfernt = 0u32;
    for haeppchen in uris.chunks(MAX_PRO_SCHREIBVORGANG) {
        let liste: Vec<serde_json::Value> = haeppchen
            .iter()
            .map(|u| serde_json::json!({ "uri": u }))
            .collect();
        anfrage(
            &app,
            &client_id,
            reqwest::Method::DELETE,
            &format!("{API}/playlists/{playlist_id}/tracks"),
            Some(serde_json::json!({ "tracks": liste })),
        )
        .await?;
        entfernt += haeppchen.len() as u32;
    }
    Ok(entfernt)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn track(title: &str, artist: &str, ms: u64) -> CloudTrack {
        CloudTrack {
            uri: format!("spotify:track:{title}"),
            title: title.to_string(),
            artist: artist.to_string(),
            duration_ms: ms,
        }
    }

    #[test]
    fn eintrag_aus_der_titelliste_wird_gelesen() {
        let item = serde_json::json!({
            "track": {
                "uri": "spotify:track:abc",
                "name": "Gold Digger",
                "duration_ms": 207000,
                "artists": [{ "name": "Kanye West" }, { "name": "Jamie Foxx" }]
            }
        });
        let t = track_aus_json(&item).unwrap();
        assert_eq!(t.uri, "spotify:track:abc");
        assert_eq!(t.title, "Gold Digger");
        assert_eq!(t.artist, "Kanye West, Jamie Foxx");
        assert_eq!(t.duration_ms, 207000);
    }

    #[test]
    fn lokale_dateien_und_leere_eintraege_fliegen_raus() {
        // Beides kommt in echten Playlists vor: eine geloeschte Aufnahme
        // steht als null drin, eine lokale Datei mit spotify:local:-URI.
        assert!(track_aus_json(&serde_json::json!({ "track": null })).is_none());
        assert!(track_aus_json(&serde_json::json!({
            "track": { "uri": "spotify:local:x", "name": "Eigene Datei" }
        }))
        .is_none());
    }

    #[test]
    fn suchtreffer_mit_passender_laenge_gewinnt() {
        let genau = track("Gold Digger", "Kanye West", 207000);
        let daneben = track("Gold Digger", "Kanye West", 203000);
        let a = treffer_wert("Gold Digger", "Kanye West", 207000, &genau).unwrap();
        let b = treffer_wert("Gold Digger", "Kanye West", 207000, &daneben).unwrap();
        assert!(a < b);
    }

    #[test]
    fn deutlich_andere_laenge_wird_abgelehnt() {
        // Ein Live-Mitschnitt oder eine Extended-Fassung faellt hier raus,
        // auch wenn Titel und Interpret stimmen.
        let lang = track("Gold Digger", "Kanye West", 400000);
        assert!(treffer_wert("Gold Digger", "Kanye West", 207000, &lang).is_none());
    }

    #[test]
    fn anderer_song_wird_abgelehnt() {
        let fremd = track("Stronger", "Kanye West", 207000);
        assert!(treffer_wert("Gold Digger", "Kanye West", 207000, &fremd).is_none());
    }

    #[test]
    fn falscher_interpret_wird_abgelehnt() {
        let fremd = track("Gold Digger", "Taylor Swift", 207000);
        assert!(treffer_wert("Gold Digger", "Kanye West", 207000, &fremd).is_none());
    }

    #[test]
    fn ohne_bekannte_laufzeit_wird_nicht_abgelehnt() {
        // Nicht jeder Track in der Bibliothek hat eine ausgelesene Dauer -
        // dann darf das kein Ausschlusskriterium sein.
        let t = track("Gold Digger", "Kanye West", 207000);
        assert!(treffer_wert("Gold Digger", "Kanye West", 0, &t).is_some());
    }

    #[test]
    fn zusaetze_in_klammern_stoeren_den_vergleich_nicht() {
        assert!(woerter_passen("Gold Digger (Official Video)", "Gold Digger"));
        assert!(woerter_passen("Kanye West", "Kanye West, Jamie Foxx"));
    }

    #[test]
    fn schreibvorgaenge_werden_in_hundertergruppen_geteilt() {
        // Spotify nimmt hoechstens 100 auf einmal - ohne Aufteilung
        // scheitert jede groessere Playlist.
        let uris: Vec<String> = (0..250).map(|i| format!("spotify:track:{i}")).collect();
        let gruppen: Vec<_> = uris.chunks(MAX_PRO_SCHREIBVORGANG).collect();
        assert_eq!(gruppen.len(), 3);
        assert_eq!(gruppen[0].len(), 100);
        assert_eq!(gruppen[2].len(), 50);
    }
}
