//! Anmeldung bei Spotify und Google (YouTube Music) - Etappe 1 des
//! Playlist-Abgleichs.
//!
//! Ablauf (OAuth 2.0 mit PKCE, der fuer installierte Programme vorgesehene
//! Weg):
//!
//! 1. Die App wuerfelt ein Geheimnis (`verifier`) und schickt den Nutzer
//!    mit dessen SHA-256-Abdruck in den Browser zum Anbieter.
//! 2. Der Nutzer meldet sich DORT an - Passwort und Zwei-Faktor-Code
//!    bekommt diese App nie zu sehen, das ist der ganze Sinn des
//!    Verfahrens.
//! 3. Der Anbieter leitet zurueck auf einen kurzlebigen lokalen Server,
//!    der nur fuer diesen einen Moment lauscht, und liefert einen Code.
//! 4. Die App tauscht Code + `verifier` gegen Zugriffs- und
//!    Erneuerungs-Token.
//!
//! Warum PKCE und kein Client-Secret: ein Secret, das in einem Programm
//! steckt, das jeder herunterladen kann, ist keins. PKCE loest das ohne -
//! den zurueckgeleiteten Code allein kann niemand einloesen, weil das
//! Geheimnis dazu nur im Speicher dieses Vorgangs liegt.
//!
//! Warum ein eigener Listener statt der Route am Party-Server: dessen Port
//! wechselt, wenn er belegt ist (siehe party.rs). Eine Weiterleitungs-
//! Adresse muss beim Anbieter aber exakt hinterlegt sein und darf sich
//! deshalb nicht aendern.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD as B64URL, Engine};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

/// Fest, weil die Adresse beim Anbieter hinterlegt werden muss.
const REDIRECT_PORT: u16 = 8899;
/// Wie lange auf die Rueckleitung gewartet wird, bevor abgebrochen wird.
const LOGIN_TIMEOUT: Duration = Duration::from_secs(300);

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Dienst {
    Spotify,
    Google,
}

impl Dienst {
    fn aus_str(s: &str) -> Option<Self> {
        match s.to_ascii_lowercase().as_str() {
            "spotify" => Some(Dienst::Spotify),
            "google" | "youtube" | "ytmusic" => Some(Dienst::Google),
            _ => None,
        }
    }

    fn schluessel(self) -> &'static str {
        match self {
            Dienst::Spotify => "spotify",
            Dienst::Google => "google",
        }
    }

    fn pfad(self) -> &'static str {
        match self {
            Dienst::Spotify => "/oauth/spotify",
            Dienst::Google => "/oauth/google",
        }
    }

    fn autorisierung(self) -> &'static str {
        match self {
            Dienst::Spotify => "https://accounts.spotify.com/authorize",
            Dienst::Google => "https://accounts.google.com/o/oauth2/v2/auth",
        }
    }

    fn token_endpunkt(self) -> &'static str {
        match self {
            Dienst::Spotify => "https://accounts.spotify.com/api/token",
            Dienst::Google => "https://oauth2.googleapis.com/token",
        }
    }

    /// Genau die Rechte, die der Playlist-Abgleich braucht - nicht mehr.
    fn rechte(self) -> &'static str {
        match self {
            // Lesen und Schreiben eigener Playlists, oeffentlich wie privat.
            Dienst::Spotify => {
                "playlist-read-private playlist-read-collaborative \
                 playlist-modify-private playlist-modify-public"
            }
            // youtube (nicht .readonly): Playlists anlegen und befuellen.
            Dienst::Google => "https://www.googleapis.com/auth/youtube",
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Token {
    pub access_token: String,
    #[serde(default)]
    pub refresh_token: String,
    /// Unix-Sekunden. 0 = unbekannt, dann wird vor jedem Zugriff erneuert.
    #[serde(default)]
    pub laeuft_ab: u64,
    /// Die Client-Kennung, mit der dieses Token geholt wurde. Aendert der
    /// Nutzer sie, ist das alte Token wertlos - dann lieber sauber
    /// abmelden als mit einer Fehlermeldung auflaufen, die niemand deuten
    /// kann.
    #[serde(default)]
    pub client_id: String,
}

#[derive(Serialize, Deserialize, Default)]
struct Ablage {
    #[serde(default)]
    tokens: HashMap<String, Token>,
}

/* --- Ablage auf der Platte ------------------------------------------------
   Enthaelt Erneuerungs-Token, mit denen jemand dauerhaft auf die Playlists
   des Kontos zugreifen koennte. Deshalb: eigene Datei im
   App-Datenverzeichnis, NICHT in der Musikbibliothek (die wandert per
   Geraete-Sync und Backup-ZIP weiter) und ausdruecklich vom Backup
   ausgenommen. */

fn ablage_pfad(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    use tauri::Manager;
    let state = app.try_state::<crate::commands::AppState>()?;
    Some(state.data_dir.join("cloud_tokens.json"))
}

fn ablage_lesen(app: &tauri::AppHandle) -> Ablage {
    let Some(pfad) = ablage_pfad(app) else {
        return Ablage::default();
    };
    std::fs::read_to_string(pfad)
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default()
}

fn ablage_schreiben(app: &tauri::AppHandle, ablage: &Ablage) {
    let Some(pfad) = ablage_pfad(app) else { return };
    if let Some(eltern) = pfad.parent() {
        let _ = std::fs::create_dir_all(eltern);
    }
    if let Ok(json) = serde_json::to_string_pretty(ablage) {
        let _ = std::fs::write(&pfad, json);
    }
}

fn token_holen(app: &tauri::AppHandle, dienst: Dienst) -> Option<Token> {
    ablage_lesen(app).tokens.get(dienst.schluessel()).cloned()
}

fn token_ablegen(app: &tauri::AppHandle, dienst: Dienst, token: Token) {
    let mut ablage = ablage_lesen(app);
    ablage.tokens.insert(dienst.schluessel().to_string(), token);
    ablage_schreiben(app, &ablage);
}

fn jetzt() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/* --- PKCE ---------------------------------------------------------------- */

fn zufallstext(bytes: usize) -> String {
    use rand::RngCore;
    let mut buf = vec![0u8; bytes];
    rand::thread_rng().fill_bytes(&mut buf);
    B64URL.encode(buf)
}

fn abdruck(verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    B64URL.encode(hasher.finalize())
}

/* --- Der kurzlebige Listener ---------------------------------------------
   Bewusst von Hand statt mit axum: es geht um genau eine Anfrage, danach
   ist der Server wieder weg. Ein zweiter Router mitsamt Zustand waere
   dafuer deutlich mehr Apparat als Nutzen. */

/// Wartet auf die Rueckleitung und liefert den Code. `state` muss
/// uebereinstimmen - sonst hat jemand anderes die Anfrage geschickt.
async fn auf_rueckleitung_warten(pfad: &str, state_erwartet: &str) -> Result<String, String> {
    let listener = tokio::net::TcpListener::bind(("127.0.0.1", REDIRECT_PORT))
        .await
        .map_err(|e| {
            format!("Port {REDIRECT_PORT} ist belegt ({e}) - laeuft die Anmeldung schon in einem anderen Fenster?")
        })?;

    let arbeit = async {
        loop {
            let (mut strom, _) = listener.accept().await.map_err(|e| e.to_string())?;
            let mut puffer = vec![0u8; 4096];
            let gelesen = strom.read(&mut puffer).await.map_err(|e| e.to_string())?;
            let anfrage = String::from_utf8_lossy(&puffer[..gelesen]).to_string();

            // "GET /oauth/spotify?code=...&state=... HTTP/1.1"
            let erste_zeile = anfrage.lines().next().unwrap_or("");
            let ziel = erste_zeile.split_whitespace().nth(1).unwrap_or("");
            if !ziel.starts_with(pfad) {
                // Irgendeine andere Anfrage (Browser holt /favicon.ico).
                let _ = strom.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n").await;
                continue;
            }

            let voll = format!("http://127.0.0.1{ziel}");
            let parsed = url::Url::parse(&voll).map_err(|e| e.to_string())?;
            let mut code = None;
            let mut state = None;
            let mut fehler = None;
            for (k, v) in parsed.query_pairs() {
                match k.as_ref() {
                    "code" => code = Some(v.to_string()),
                    "state" => state = Some(v.to_string()),
                    "error" => fehler = Some(v.to_string()),
                    _ => {}
                }
            }

            let (titel, text) = if fehler.is_some() {
                ("Anmeldung abgebrochen", "Du kannst dieses Fenster schliessen.")
            } else if code.is_some() && state.as_deref() == Some(state_erwartet) {
                ("Angemeldet", "Fertig - du kannst dieses Fenster schliessen und zu Reson zurueck.")
            } else {
                ("Etwas stimmt nicht", "Die Antwort passt nicht zur Anfrage. Bitte in Reson noch einmal versuchen.")
            };
            let seite = format!(
                "<!doctype html><meta charset=\"utf-8\"><title>{titel}</title>\
                 <body style=\"font-family:system-ui;background:#111;color:#eee;\
                 display:flex;align-items:center;justify-content:center;height:100vh;margin:0\">\
                 <div style=\"text-align:center\"><h1 style=\"font-weight:600\">{titel}</h1><p>{text}</p></div>"
            );
            let antwort = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                seite.len(),
                seite
            );
            let _ = strom.write_all(antwort.as_bytes()).await;
            let _ = strom.flush().await;

            if let Some(f) = fehler {
                return Err(format!("Anbieter hat abgelehnt: {f}"));
            }
            // Der Abgleich von state ist der Schutz davor, dass eine
            // untergeschobene Anfrage die Anmeldung kapert.
            if state.as_deref() != Some(state_erwartet) {
                return Err("Antwort passt nicht zur Anfrage (state stimmt nicht).".into());
            }
            return code.ok_or_else(|| "Kein Code in der Antwort.".to_string());
        }
    };

    match tokio::time::timeout(LOGIN_TIMEOUT, arbeit).await {
        Ok(r) => r,
        Err(_) => Err("Zeit abgelaufen - die Anmeldung wurde nicht abgeschlossen.".into()),
    }
}

/* --- Token besorgen und erneuern ------------------------------------------ */

async fn code_eintauschen(
    dienst: Dienst,
    client_id: &str,
    code: &str,
    verifier: &str,
) -> Result<Token, String> {
    let redirect = format!("http://127.0.0.1:{REDIRECT_PORT}{}", dienst.pfad());
    let formular = [
        ("grant_type", "authorization_code"),
        ("code", code),
        ("redirect_uri", &redirect),
        ("client_id", client_id),
        ("code_verifier", verifier),
    ];
    let client = reqwest::Client::new();
    let resp = client
        .post(dienst.token_endpunkt())
        .form(&formular)
        .send()
        .await
        .map_err(|e| format!("Token-Anfrage fehlgeschlagen: {e}"))?;
    let status = resp.status();
    let daten: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Antwort nicht lesbar: {e}"))?;
    if !status.is_success() {
        let grund = daten
            .get("error_description")
            .or_else(|| daten.get("error"))
            .and_then(|v| v.as_str())
            .unwrap_or("unbekannt");
        return Err(format!("Anmeldung abgelehnt ({status}): {grund}"));
    }
    Ok(aus_antwort(&daten, client_id, ""))
}

fn aus_antwort(daten: &serde_json::Value, client_id: &str, alter_refresh: &str) -> Token {
    let feld = |k: &str| daten.get(k).and_then(|v| v.as_str()).unwrap_or("").to_string();
    let gueltig = daten.get("expires_in").and_then(|v| v.as_u64()).unwrap_or(3600);
    let refresh = {
        let neu = feld("refresh_token");
        // Google schickt das Erneuerungs-Token nur beim ALLERSTEN Mal mit.
        // Wer es danach ueberschreibt, hat sich selbst ausgesperrt.
        if neu.is_empty() {
            alter_refresh.to_string()
        } else {
            neu
        }
    };
    Token {
        access_token: feld("access_token"),
        refresh_token: refresh,
        // 60 Sekunden Sicherheitsabstand: ein Token, das waehrend der
        // Anfrage ablaeuft, waere ein Fehler, den niemand nachvollziehen
        // kann.
        laeuft_ab: jetzt() + gueltig.saturating_sub(60),
        client_id: client_id.to_string(),
    }
}

async fn erneuern(dienst: Dienst, client_id: &str, refresh: &str) -> Result<Token, String> {
    let formular = [
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh),
        ("client_id", client_id),
    ];
    let client = reqwest::Client::new();
    let resp = client
        .post(dienst.token_endpunkt())
        .form(&formular)
        .send()
        .await
        .map_err(|e| format!("Erneuern fehlgeschlagen: {e}"))?;
    let status = resp.status();
    let daten: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("Erneuern abgelehnt ({status}) - bitte neu anmelden."));
    }
    Ok(aus_antwort(&daten, client_id, refresh))
}

/// Gueltiges Zugriffs-Token, notfalls frisch erneuert. Das ist die
/// Funktion, die die spaeteren Playlist-Module benutzen - sie sollen sich
/// um Ablaufzeiten nicht kuemmern muessen.
pub async fn gueltiges_token(
    app: &tauri::AppHandle,
    dienst: Dienst,
    client_id: &str,
) -> Result<String, String> {
    let Some(token) = token_holen(app, dienst) else {
        return Err("Nicht angemeldet.".into());
    };
    if !token.client_id.is_empty() && token.client_id != client_id {
        return Err("Die Client-Kennung wurde geaendert - bitte neu anmelden.".into());
    }
    if token.laeuft_ab > jetzt() && !token.access_token.is_empty() {
        return Ok(token.access_token);
    }
    if token.refresh_token.is_empty() {
        return Err("Zugang abgelaufen - bitte neu anmelden.".into());
    }
    let neu = erneuern(dienst, client_id, &token.refresh_token).await?;
    let access = neu.access_token.clone();
    token_ablegen(app, dienst, neu);
    Ok(access)
}

/* --- Tauri-Kommandos ------------------------------------------------------ */

/// Startet die Anmeldung: oeffnet den Browser beim Anbieter und wartet auf
/// die Rueckleitung. Laeuft, bis der Nutzer fertig ist oder die Zeit
/// ablaeuft - das Frontend zeigt so lange einen Hinweis.
#[tauri::command]
pub async fn cloud_login(
    app: tauri::AppHandle,
    dienst: String,
    client_id: String,
) -> Result<String, String> {
    let dienst = Dienst::aus_str(&dienst).ok_or_else(|| "Unbekannter Dienst.".to_string())?;
    let client_id = client_id.trim().to_string();
    if client_id.is_empty() {
        return Err("Bitte zuerst die Client-Kennung eintragen.".into());
    }

    let verifier = zufallstext(64);
    let challenge = abdruck(&verifier);
    let state = zufallstext(16);
    let redirect = format!("http://127.0.0.1:{REDIRECT_PORT}{}", dienst.pfad());

    let mut url = url::Url::parse(dienst.autorisierung()).map_err(|e| e.to_string())?;
    {
        let mut q = url.query_pairs_mut();
        q.append_pair("response_type", "code");
        q.append_pair("client_id", &client_id);
        q.append_pair("redirect_uri", &redirect);
        q.append_pair("scope", dienst.rechte());
        q.append_pair("state", &state);
        q.append_pair("code_challenge_method", "S256");
        q.append_pair("code_challenge", &challenge);
        if dienst == Dienst::Google {
            // Ohne beides schickt Google kein Erneuerungs-Token, und die
            // Anmeldung waere nach einer Stunde wieder weg.
            q.append_pair("access_type", "offline");
            q.append_pair("prompt", "consent");
        }
    }

    // Erst lauschen, dann den Browser oeffnen - sonst koennte die
    // Rueckleitung schneller sein als der Listener.
    let pfad = dienst.pfad().to_string();
    let state_kopie = state.clone();
    let warten = tokio::spawn(async move { auf_rueckleitung_warten(&pfad, &state_kopie).await });

    // Kurz Luft, damit bind() durch ist, bevor der Browser losrennt.
    tokio::time::sleep(Duration::from_millis(150)).await;
    open_im_browser(&app, url.as_str())?;

    let code = warten
        .await
        .map_err(|e| format!("Anmeldevorgang abgebrochen: {e}"))??;
    let token = code_eintauschen(dienst, &client_id, &code, &verifier).await?;
    token_ablegen(&app, dienst, token);
    Ok("angemeldet".into())
}

fn open_im_browser(app: &tauri::AppHandle, url: &str) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;
    // Gilt als veraltet zugunsten von tauri-plugin-opener. Das waere eine
    // weitere Abhaengigkeit samt Berechtigung fuer diese eine Zeile, und
    // shell::open tut hier genau das, was es soll. Beim naechsten
    // Tauri-Sprung mit umstellen.
    #[allow(deprecated)]
    app.shell()
        .open(url, None)
        .map_err(|e| format!("Browser liess sich nicht oeffnen: {e}"))
}

/// Wer ist angemeldet? Liefert pro Dienst nur ja/nein - das Token selbst
/// hat im Frontend nichts verloren.
#[tauri::command]
pub fn cloud_status(app: tauri::AppHandle) -> serde_json::Value {
    let ablage = ablage_lesen(&app);
    let da = |k: &str| {
        ablage
            .tokens
            .get(k)
            .map(|t| !t.access_token.is_empty() || !t.refresh_token.is_empty())
            .unwrap_or(false)
    };
    serde_json::json!({
        "spotify": da("spotify"),
        "google": da("google"),
    })
}

#[tauri::command]
pub fn cloud_logout(app: tauri::AppHandle, dienst: String) -> Result<(), String> {
    let dienst = Dienst::aus_str(&dienst).ok_or_else(|| "Unbekannter Dienst.".to_string())?;
    let mut ablage = ablage_lesen(&app);
    ablage.tokens.remove(dienst.schluessel());
    ablage_schreiben(&app, &ablage);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn abdruck_entspricht_dem_pkce_beispiel() {
        // Beispiel aus RFC 7636, Anhang B - damit ist belegt, dass hier
        // wirklich S256 herauskommt und nicht irgendein Base64.
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        assert_eq!(abdruck(verifier), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    }

    #[test]
    fn zufallstext_ist_lang_genug_und_verschieden() {
        // PKCE verlangt 43 bis 128 Zeichen fuer den verifier.
        let a = zufallstext(64);
        let b = zufallstext(64);
        assert!(a.len() >= 43 && a.len() <= 128, "Laenge war {}", a.len());
        assert_ne!(a, b);
    }

    #[test]
    fn dienstnamen_werden_erkannt() {
        assert!(matches!(Dienst::aus_str("spotify"), Some(Dienst::Spotify)));
        assert!(matches!(Dienst::aus_str("Google"), Some(Dienst::Google)));
        assert!(matches!(Dienst::aus_str("ytmusic"), Some(Dienst::Google)));
        assert!(Dienst::aus_str("napster").is_none());
    }

    #[test]
    fn google_behaelt_das_alte_erneuerungstoken() {
        // Google schickt es nur beim allerersten Mal mit. Wer es danach
        // mit einem leeren Feld ueberschreibt, sperrt sich selbst aus.
        let antwort = serde_json::json!({ "access_token": "neu", "expires_in": 3600 });
        let token = aus_antwort(&antwort, "cid", "alter-refresh");
        assert_eq!(token.refresh_token, "alter-refresh");
        assert_eq!(token.access_token, "neu");
    }

    #[test]
    fn neues_erneuerungstoken_ersetzt_das_alte() {
        let antwort = serde_json::json!({
            "access_token": "neu", "refresh_token": "frisch", "expires_in": 3600
        });
        let token = aus_antwort(&antwort, "cid", "alter-refresh");
        assert_eq!(token.refresh_token, "frisch");
    }

    #[test]
    fn ablaufzeit_hat_sicherheitsabstand() {
        let antwort = serde_json::json!({ "access_token": "x", "expires_in": 3600 });
        let token = aus_antwort(&antwort, "cid", "");
        let rest = token.laeuft_ab.saturating_sub(jetzt());
        // 3600 minus 60 Sekunden Abstand, ein paar Sekunden Toleranz.
        assert!((3530..=3545).contains(&rest), "Rest war {rest}");
    }

    #[test]
    fn rechte_bleiben_auf_playlists_beschraenkt() {
        // Kein Zugriff auf Hoergewohnheiten, Konto oder Wiedergabe.
        let s = Dienst::Spotify.rechte();
        assert!(s.contains("playlist-read-private"));
        assert!(s.contains("playlist-modify-private"));
        assert!(!s.contains("user-read-email"));
        assert!(!s.contains("streaming"));
    }
}
