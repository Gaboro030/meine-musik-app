//! Geraete-Sync: ganze Playlists von einem Geraet auf ein anderes schieben.
//! Reitet auf dem HTTP-Server, den party.rs ohnehin dauerhaft laufen laesst
//! (zwei Routen: POST /sync/pair und POST /sync/receive), statt einen
//! zweiten Server aufzumachen. Uebertragen werden rohe Bytes, eine Datei
//! pro Anfrage (Audiodatei plus ihre .jpg/.artist.txt-Sidecars) - beim
//! Empfaenger landen sie unveraendert im music_root, es muss nichts an
//! Metadaten rekonstruiert werden.
//!
//! Es gibt zwei Wege, das Gegenueber zu finden:
//!
//! 1. Gleiches WLAN: ein kleiner UDP-Broadcast-Beacon, beide Geraete
//!    sehen sich automatisch in der Liste. Nichts einzugeben.
//!
//! 2. Ueberall sonst (anderes WLAN, Mobilfunk, Rechner eines Freundes):
//!    das EMPFANGENDE Geraet erzeugt eine Einladung. Dafuer wird derselbe
//!    cloudflared-Tunnel benutzt, den auch der Party-Gastlink schon nutzt
//!    (party::ensure_tunnel) - der ist ausgehend aufgebaut und kommt
//!    dadurch ohne Portfreigabe durch NAT und Firewall. Die Einladung gibt
//!    es als QR-Code (Handy scannt) und als tippbaren Text (ein Freund am
//!    eigenen PC kann nicht scannen).
//!
//! Warum der Code laenger ist als sechs Ziffern: eine kurze Ziffernfolge
//! muesste irgendwo nachgeschlagen werden, um daraus eine erreichbare
//! Adresse zu machen - das braeuchte einen dauerhaft laufenden
//! Vermittlungsserver, den es hier bewusst nicht gibt (die App kommt ohne
//! eigene Infrastruktur aus). Deshalb TRAEGT der Code die Adresse selbst:
//! "<tunnel-name>-<6 Ziffern>". Die sechs Ziffern sind die eigentliche
//! Absicherung, der Rest ist die Wegbeschreibung.
//!
//! Absicherung: /sync/receive war frueher voellig offen - im LAN vertretbar,
//! ueber einen oeffentlich erreichbaren Tunnel nicht. Jetzt gilt: eine
//! Einladung ist 10 Minuten gueltig und wird beim ersten erfolgreichen
//! Verbinden verbraucht; danach hat das gekoppelte Geraet ein Sitzungs-
//! Token, mit dem es die eigentlichen Dateien schickt. Anfragen, die durch
//! den Tunnel kommen (erkennbar am von cloudflared gesetzten
//! CF-Connecting-IP-Kopfzeilenfeld), MUESSEN ein gueltiges Token haben.
//! Direkte Anfragen aus dem lokalen Netz bleiben wie bisher ohne Token
//! erlaubt - dort war die Vertrauensgrenze immer schon das WLAN selbst.
//!
//! Richtung ist symmetrisch: wer eine Playlist offen hat und ein Geraet
//! auswaehlt, SCHIEBT seine Dateien dorthin. Gleicher Code auf jeder
//! Plattform, funktioniert also PC->Handy, Handy->PC und PC->PC.

use crate::party::Hub;
use axum::{
    body::Bytes,
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::Emitter;

const BEACON_PORT: u16 = 45654;
const BEACON_INTERVAL: Duration = Duration::from_millis(2000);
const PEER_TIMEOUT: Duration = Duration::from_secs(8);
/// Wie lange eine noch nicht eingeloeste Einladung gilt.
const INVITE_TTL: Duration = Duration::from_secs(10 * 60);
/// Wie lange ein gekoppeltes Geraet ohne Lebenszeichen senden darf, bevor
/// sein Token verfaellt. Grosszuegig, weil eine Uebertragung von hunderten
/// Dateien laenger dauern kann als eine Einladung gilt.
const SESSION_TTL: Duration = Duration::from_secs(6 * 60 * 60);

fn device_name() -> String {
    if cfg!(target_os = "android") {
        "Android-Handy".to_string()
    } else {
        std::env::var("COMPUTERNAME")
            .or_else(|_| std::env::var("HOSTNAME"))
            .unwrap_or_else(|_| "PC".to_string())
    }
}

#[derive(Clone, Serialize)]
pub struct Peer {
    /// Stabile Kennung fuer diesen Listeneintrag - das Frontend schickt sie
    /// beim Senden zurueck, statt IP/Port (LAN) bzw. Adresse/Token
    /// (gekoppelt) selbst zu jonglieren.
    pub id: String,
    pub name: String,
    pub ip: String,
    pub port: u16,
    /// Nur bei ueber eine Einladung gekoppelten Geraeten gefuellt: die
    /// oeffentliche Adresse des Gegenuebers. Leer = normales LAN-Geraet.
    pub base_url: String,
    /// True fuer gekoppelte Geraete - das Frontend zeigt sie anders an
    /// (sie verschwinden nicht von selbst wieder aus der Liste).
    pub paired: bool,
    #[serde(skip)]
    last_seen: Instant,
    /// Sitzungs-Token des Gegenuebers, nie ans Frontend.
    #[serde(skip)]
    token: String,
}

/// Einladung, die DIESES Geraet ausgestellt hat (es ist dann der
/// Empfaenger). Immer nur eine gleichzeitig: zwei parallele Einladungen
/// waeren nicht zu unterscheiden, weil beide auf denselben Tunnel zeigen.
struct Invite {
    pin: String,
    created_at: Instant,
}

/// Ein Geraet, das sich mit unserer Einladung gekoppelt hat und uns jetzt
/// Dateien schicken darf.
struct Session {
    name: String,
    created_at: Instant,
}

struct SyncInner {
    peers: Mutex<HashMap<String, Peer>>,
    running: AtomicBool,
    instance_id: String,
    invite: Mutex<Option<Invite>>,
    /// Token -> Sitzung. Von den axum-Routen aus erreichbar, die keinen
    /// Zugriff auf den Tauri-State haben (siehe SYNC_SESSIONS unten).
    sessions: Mutex<HashMap<String, Session>>,
}

#[derive(Clone)]
pub struct SyncState(Arc<SyncInner>);

impl SyncState {
    pub fn new() -> Self {
        let state = SyncState(Arc::new(SyncInner {
            peers: Mutex::new(HashMap::new()),
            running: AtomicBool::new(false),
            instance_id: uuid::Uuid::new_v4().to_string(),
            invite: Mutex::new(None),
            sessions: Mutex::new(HashMap::new()),
        }));
        // Die axum-Routen bekommen als State den Hub, nicht den SyncState -
        // sie kaemen sonst nicht an Einladung/Sitzungen heran. Statt den
        // Router-State umzubauen (der haengt an jeder Party-Route mit dran)
        // hier eine Ablage, die beide Seiten sehen. Wird genau einmal beim
        // Start gesetzt.
        let _ = SYNC_GLOBAL.set(state.clone());
        state
    }
}

static SYNC_GLOBAL: OnceLock<SyncState> = OnceLock::new();

fn global() -> Option<&'static SyncState> {
    SYNC_GLOBAL.get()
}

/// Sagt party.rs, ob der Tunnel gerade fuer eine Sync-Einladung gebraucht
/// wird - "Internet-Link aus" wuerde ihn sonst mitreissen.
pub fn has_active_invite() -> bool {
    let Some(state) = global() else { return false };
    let mut invite = state.0.invite.lock().unwrap();
    if invite.as_ref().is_some_and(|i| i.created_at.elapsed() > INVITE_TTL) {
        *invite = None;
    }
    invite.is_some()
}

// --- Tauri commands (either side can call these) ----------------------------

/// Turns discovery on: starts broadcasting this device's presence and
/// listening for others every ~2s. Idempotent - safe to call again while
/// already running (e.g. the panel re-opened).
#[tauri::command]
pub async fn sync_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, SyncState>,
    hub: tauri::State<'_, Hub>,
) -> Result<(), String> {
    if state.0.running.swap(true, Ordering::SeqCst) {
        return Ok(());
    }
    let state = state.inner().clone();
    let hub = hub.inner().clone();
    tauri::async_runtime::spawn(async move { beacon_loop(state, hub, app).await });
    Ok(())
}

#[tauri::command]
pub fn sync_stop(state: tauri::State<SyncState>) {
    state.0.running.store(false, Ordering::SeqCst);
}

#[tauri::command]
pub fn sync_list_peers(state: tauri::State<SyncState>) -> Vec<Peer> {
    let mut peers = state.0.peers.lock().unwrap();
    let cutoff = Instant::now() - PEER_TIMEOUT;
    // Gekoppelte Geraete melden keinen Beacon - sie duerfen deshalb nicht
    // nach 8 Sekunden aus der Liste fliegen wie ein LAN-Nachbar, der die
    // App geschlossen hat.
    peers.retain(|_, p| p.paired || p.last_seen >= cutoff);
    let mut out: Vec<Peer> = peers.values().cloned().collect();
    // Gekoppelte zuerst: die hat der Nutzer bewusst hinzugefuegt.
    out.sort_by(|a, b| b.paired.cmp(&a.paired).then(a.name.cmp(&b.name)));
    out
}

/* --- Einladung ausstellen (Empfaenger-Seite) ------------------------------ */

/// Sechs Ziffern, gleichverteilt gezogen. Kurz genug zum Vorlesen, und der
/// einzige Teil des Codes, der wirklich geheim sein muss.
fn make_pin() -> String {
    use rand::Rng;
    format!("{:06}", rand::thread_rng().gen_range(0..1_000_000))
}

/// Aus "https://wine-vertical-attorney.trycloudflare.com" wird
/// "wine-vertical-attorney". Nur dieser Teil wandert in den Code - das
/// Schema und die immer gleiche Domain wieder mitzutippen waere sinnlos.
fn tunnel_slug(origin: &str) -> Option<String> {
    origin
        .strip_prefix("https://")?
        .strip_suffix(".trycloudflare.com")
        .map(str::to_string)
}

fn origin_from_slug(slug: &str) -> String {
    format!("https://{slug}.trycloudflare.com")
}

/// Zerlegt "<slug>-<6 Ziffern>" wieder in Adresse und PIN. Der Slug selbst
/// enthaelt Bindestriche, getrennt wird deshalb am LETZTEN.
fn parse_invite_code(code: &str) -> Option<(String, String)> {
    let code = code.trim().to_lowercase();
    let (slug, pin) = code.rsplit_once('-')?;
    if pin.len() != 6 || !pin.chars().all(|c| c.is_ascii_digit()) || slug.is_empty() {
        return None;
    }
    Some((slug.to_string(), pin.to_string()))
}

/// Stellt eine Einladung aus: baut (oder nutzt) den Tunnel und wuerfelt
/// eine PIN. Liefert den tippbaren Code und denselben Code als QR-Bild.
#[tauri::command]
pub async fn sync_create_invite(
    app: tauri::AppHandle,
    hub: tauri::State<'_, Hub>,
    state: tauri::State<'_, SyncState>,
) -> Result<serde_json::Value, String> {
    let origin = crate::party::ensure_tunnel(&app, &hub).await?;
    let slug = tunnel_slug(&origin).ok_or_else(|| "Unerwartete Tunnel-Adresse.".to_string())?;
    let pin = make_pin();
    let code = format!("{slug}-{pin}");
    *state.0.invite.lock().unwrap() = Some(Invite { pin, created_at: Instant::now() });
    Ok(serde_json::json!({
        "code": code,
        "qr": crate::party::qr_data_uri(&code)?,
        "valid_minutes": INVITE_TTL.as_secs() / 60,
    }))
}

/// Zieht eine noch nicht eingeloeste Einladung zurueck.
#[tauri::command]
pub fn sync_revoke_invite(state: tauri::State<SyncState>) {
    *state.0.invite.lock().unwrap() = None;
}

/* --- Einladung einloesen (Sender-Seite) ----------------------------------- */

/// Loest einen Einladungscode ein und nimmt das Gegenueber als Geraet in
/// die Liste auf. Ab da laeuft das Senden ueber genau denselben Weg wie
/// bei einem Geraet aus dem eigenen WLAN.
#[tauri::command]
pub async fn sync_pair_with_code(
    state: tauri::State<'_, SyncState>,
    code: String,
) -> Result<Peer, String> {
    let (slug, pin) = parse_invite_code(&code)
        .ok_or_else(|| "Code sieht nicht richtig aus - erwartet wird z.B. \"blaue-wolke-schnell-482913\".".to_string())?;
    let base_url = origin_from_slug(&slug);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .post(format!("{base_url}/sync/pair"))
        .json(&serde_json::json!({ "pin": pin, "name": device_name() }))
        .send()
        .await
        .map_err(|_| "Gegenstelle nicht erreichbar - laeuft die App dort noch und ist die Einladung noch offen?".to_string())?;
    if resp.status() == StatusCode::UNAUTHORIZED {
        return Err("Code ist abgelaufen, schon benutzt oder falsch.".into());
    }
    if !resp.status().is_success() {
        return Err(format!("Verbinden fehlgeschlagen (HTTP {}).", resp.status()));
    }
    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let token = data.get("token").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if token.is_empty() {
        return Err("Gegenstelle hat kein Sitzungs-Token geliefert.".into());
    }
    let name = data
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Gekoppeltes Geraet")
        .to_string();

    let peer = Peer {
        id: format!("paired:{slug}"),
        name,
        ip: String::new(),
        port: 0,
        base_url,
        paired: true,
        last_seen: Instant::now(),
        token,
    };
    state.0.peers.lock().unwrap().insert(peer.id.clone(), peer.clone());
    Ok(peer)
}

/// Nimmt ein gekoppeltes Geraet wieder aus der Liste.
#[tauri::command]
pub fn sync_unpair(state: tauri::State<SyncState>, peer_id: String) {
    state.0.peers.lock().unwrap().remove(&peer_id);
}

/// Namen der Geraete, die sich mit UNSERER Einladung gekoppelt haben.
/// Damit sieht der Empfaenger, dass der Code angekommen ist - sonst
/// starrt er nach dem Vorlesen der PIN auf einen QR-Code und weiss nicht,
/// ob etwas passiert ist.
#[tauri::command]
pub fn sync_paired_senders(state: tauri::State<SyncState>) -> Vec<String> {
    let mut sessions = state.0.sessions.lock().unwrap();
    sessions.retain(|_, s| s.created_at.elapsed() <= SESSION_TTL);
    sessions.values().map(|s| s.name.clone()).collect()
}

/// Schiebt jede Datei (Audio + Sidecars) der gewaehlten Playlists zum
/// ausgewaehlten Geraet, ein paar gleichzeitig. Das Gegenueber braucht von
/// uns nichts weiter - es nimmt an POST /sync/receive entgegen, was
/// ankommt, und legt es in seiner Bibliothek ab.
#[tauri::command]
pub async fn sync_send_playlists(
    app: tauri::AppHandle,
    hub: tauri::State<'_, Hub>,
    state: tauri::State<'_, SyncState>,
    task_id: String,
    peer_id: String,
    playlist_names: Vec<String>,
) -> Result<serde_json::Value, String> {
    use futures_util::StreamExt;

    // Ziel EINMAL aufloesen und die Adresse mitnehmen, statt bei jeder
    // Datei erneut in die Peer-Liste zu greifen: der Beacon-Thread raeumt
    // dort im Hintergrund auf, ein LAN-Geraet koennte also mitten in der
    // Uebertragung kurz aus der Liste fallen.
    let (target_base, token, peer_name) = {
        let peers = state.0.peers.lock().unwrap();
        let peer = peers
            .get(&peer_id)
            .ok_or_else(|| "Geraet ist nicht mehr erreichbar.".to_string())?;
        let base = if peer.base_url.is_empty() {
            format!("http://{}:{}", peer.ip, peer.port)
        } else {
            peer.base_url.clone()
        };
        (base, peer.token.clone(), peer.name.clone())
    };

    let music_root = hub.0.music_root.clone();
    let mut all_files: Vec<(String, std::path::PathBuf)> = Vec::new();
    for name in &playlist_names {
        let dir = music_root.join(crate::commands::safe_filename(name));
        let Ok(entries) = std::fs::read_dir(&dir) else { continue };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                all_files.push((name.clone(), path));
            }
        }
    }

    let total = all_files.len();
    let event = format!("sync-progress-{task_id}");
    let done = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let failed: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));
    // A stuck connection (peer unreachable, firewall silently dropping the
    // packets) would otherwise hang - a real error surfaces much faster and
    // actually tells the user something instead of just spinning.
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .unwrap_or_default();

    // Three at a time, same reasoning as the batch downloader: noticeably
    // faster than one file after another, without piling up so many
    // simultaneous requests that a slower phone chokes on them.
    futures_util::stream::iter(all_files.into_iter().map(|(playlist, path)| {
        let client = client.clone();
        let target_base = target_base.clone();
        let token = token.clone();
        let app = app.clone();
        let event = event.clone();
        let done = done.clone();
        let failed = failed.clone();
        async move {
            let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
            if !filename.is_empty() {
                if let Err(e) = send_one_file(&client, &target_base, &token, &playlist, &filename, &path).await {
                    failed.lock().unwrap().push(format!("{filename}: {e}"));
                }
            }
            let n = done.fetch_add(1, Ordering::SeqCst) + 1;
            let _ = app.emit(&event, serde_json::json!({ "done": n, "total": total }));
        }
    }))
    .buffer_unordered(3)
    .collect::<Vec<()>>()
    .await;

    let failed = failed.lock().unwrap().clone();
    Ok(serde_json::json!({
        "sent": total - failed.len(),
        "failed": failed,
        "total": total,
        "peer": peer_name,
    }))
}

async fn send_one_file(
    client: &reqwest::Client,
    base_url: &str,
    token: &str,
    playlist: &str,
    filename: &str,
    path: &std::path::Path,
) -> Result<(), String> {
    let bytes = tokio::fs::read(path).await.map_err(|e| e.to_string())?;
    let url = format!(
        "{base_url}/sync/receive?playlist={}&filename={}",
        percent_encoding::utf8_percent_encode(playlist, percent_encoding::NON_ALPHANUMERIC),
        percent_encoding::utf8_percent_encode(filename, percent_encoding::NON_ALPHANUMERIC),
    );
    let mut req = client.post(&url).body(bytes);
    // LAN-Geraete haben kein Token (siehe Modul-Kommentar) - dann bleibt
    // die Kopfzeile einfach weg.
    if !token.is_empty() {
        req = req.header(SYNC_TOKEN_HEADER, token);
    }
    let resp = req
        .send()
        .await
        .map_err(|e| format!("Nicht erreichbar: {e}"))?;
    if resp.status() == StatusCode::UNAUTHORIZED {
        return Err("Kopplung abgelaufen - Code neu erzeugen.".into());
    }
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    Ok(())
}

/// Broadcasts this device's presence and listens for others' beacons at
/// the same time - a `tokio::select!` between a periodic send tick and the
/// socket's own recv, so listening never pauses just because it's not our
/// turn to speak. Beacons carry a random per-launch instance id purely so
/// a device doesn't add its own broadcast right back to its peer list.
async fn beacon_loop(state: SyncState, hub: Hub, app: tauri::AppHandle) {
    let Ok(sock) = tokio::net::UdpSocket::bind(("0.0.0.0", BEACON_PORT)).await else {
        eprintln!("Sync: Broadcast-Port {BEACON_PORT} nicht verfuegbar.");
        state.0.running.store(false, Ordering::SeqCst);
        return;
    };
    let _ = sock.set_broadcast(true);

    let name = device_name();
    let instance_id = state.0.instance_id.clone();
    let mut buf = [0u8; 512];
    let mut ticker = tokio::time::interval(BEACON_INTERVAL);

    while state.0.running.load(Ordering::SeqCst) {
        tokio::select! {
            _ = ticker.tick() => {
                let payload = serde_json::json!({ "name": name, "port": hub.port(), "id": instance_id }).to_string();
                let _ = sock.send_to(payload.as_bytes(), ("255.255.255.255", BEACON_PORT)).await;
            }
            recv = sock.recv_from(&mut buf) => {
                let Ok((n, addr)) = recv else { continue };
                let Ok(msg) = serde_json::from_slice::<serde_json::Value>(&buf[..n]) else { continue };
                let peer_id = msg.get("id").and_then(|x| x.as_str()).unwrap_or("");
                if peer_id.is_empty() || peer_id == instance_id {
                    continue;
                }
                let peer_name = msg.get("name").and_then(|x| x.as_str()).unwrap_or("Geraet").to_string();
                let peer_port = msg.get("port").and_then(|x| x.as_u64()).unwrap_or(0) as u16;
                if peer_port == 0 {
                    continue;
                }
                let ip = addr.ip().to_string();
                let key = format!("lan:{ip}:{peer_port}");
                let is_new = {
                    let mut peers = state.0.peers.lock().unwrap();
                    let is_new = !peers.contains_key(&key);
                    peers.insert(
                        key.clone(),
                        Peer {
                            id: key,
                            name: peer_name,
                            ip,
                            port: peer_port,
                            base_url: String::new(),
                            paired: false,
                            last_seen: Instant::now(),
                            token: String::new(),
                        },
                    );
                    is_new
                };
                if is_new {
                    let _ = app.emit("sync-peers-changed", ());
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Echte Form einer cloudflared-Schnellzugangs-Adresse.
    const ORIGIN: &str = "https://wine-vertical-attorney-mounting.trycloudflare.com";

    #[test]
    fn erlaubte_endung_laesst_musik_und_beidateien_durch() {
        for name in [
            "Song.mp3", "Song.M4A", "Video.mp4", "Song.opus", "Song.flac",
            "Song.jpg", "Song.cover_cache.jpg", "Song.artist.txt", "Song.album.txt",
            "Song.lyrics.json",
        ] {
            assert!(erlaubte_endung(name), "{name} sollte erlaubt sein");
        }
    }

    #[test]
    fn erlaubte_endung_blockt_ausfuehrbares_und_versteckte_dateien() {
        for name in [
            "boese.exe", "boese.bat", "boese.cmd", "boese.ps1", "boese.lnk",
            "boese.dll", "boese.sh", "boese", "Song.mp3.exe", ".bashrc",
            ".config", "autorun.inf",
        ] {
            assert!(!erlaubte_endung(name), "{name} haette abgelehnt werden muessen");
        }
    }

    #[test]
    fn code_round_trip_keeps_address_and_pin() {
        let slug = tunnel_slug(ORIGIN).unwrap();
        let code = format!("{slug}-482913");
        let (parsed_slug, pin) = parse_invite_code(&code).unwrap();
        assert_eq!(parsed_slug, "wine-vertical-attorney-mounting");
        assert_eq!(pin, "482913");
        assert_eq!(origin_from_slug(&parsed_slug), ORIGIN);
    }

    #[test]
    fn code_splits_at_the_last_dash_not_the_first() {
        // Der Tunnelname enthaelt selbst Bindestriche - am ersten zu
        // trennen wuerde die Adresse zerreissen.
        let (slug, pin) = parse_invite_code("blaue-wolke-schnell-000042").unwrap();
        assert_eq!(slug, "blaue-wolke-schnell");
        assert_eq!(pin, "000042");
    }

    #[test]
    fn code_is_case_insensitive_and_tolerates_stray_spaces() {
        // Vorgelesene/kopierte Codes kommen gern mit Leerzeichen oder in
        // Grossbuchstaben an.
        let (slug, pin) = parse_invite_code("  Blaue-Wolke-482913 \n").unwrap();
        assert_eq!(slug, "blaue-wolke");
        assert_eq!(pin, "482913");
    }

    #[test]
    fn malformed_codes_are_rejected() {
        assert!(parse_invite_code("").is_none());
        assert!(parse_invite_code("nurtext").is_none(), "ohne Bindestrich");
        assert!(parse_invite_code("wolke-12345").is_none(), "PIN zu kurz");
        assert!(parse_invite_code("wolke-1234567").is_none(), "PIN zu lang");
        assert!(parse_invite_code("wolke-abcdef").is_none(), "PIN keine Ziffern");
        assert!(parse_invite_code("-482913").is_none(), "kein Tunnelname");
    }

    #[test]
    fn pin_is_always_six_digits() {
        for _ in 0..500 {
            let pin = make_pin();
            assert_eq!(pin.len(), 6, "PIN war {pin}");
            assert!(pin.chars().all(|c| c.is_ascii_digit()), "PIN war {pin}");
        }
    }

    #[test]
    fn tunnel_slug_rejects_foreign_addresses() {
        assert!(tunnel_slug("https://example.com").is_none());
        assert!(tunnel_slug("http://wolke.trycloudflare.com").is_none(), "kein https");
    }

    #[test]
    fn lan_requests_stay_allowed_without_a_token() {
        // Das war schon immer so und muss so bleiben: im eigenen WLAN
        // laeuft der Sync ohne Kopplung.
        assert!(receive_allowed(&HeaderMap::new()));
    }

    #[test]
    fn tunnel_requests_without_a_valid_token_are_refused() {
        // Genau die Luecke, die es vorher gab: ueber den oeffentlichen
        // Tunnel konnte jeder Dateien in die Bibliothek legen.
        let mut headers = HeaderMap::new();
        headers.insert(TUNNEL_MARKER_HEADER, "203.0.113.7".parse().unwrap());
        assert!(!receive_allowed(&headers));

        headers.insert(SYNC_TOKEN_HEADER, "erfundenes-token".parse().unwrap());
        assert!(!receive_allowed(&headers));
    }
}

// --- Empfangsseite: zwei Routen an party.rs' dauerhaft laufendem Server ---

/// Eigene Kopfzeile statt Authorization: das ist kein Bearer-Token nach
/// OAuth-Art, und cloudflared/Proxys lassen ein unbekanntes X-Feld
/// unangetastet durch.
const SYNC_TOKEN_HEADER: &str = "x-sync-token";
/// Setzt cloudflared bei jeder durch den Tunnel gereichten Anfrage. Ist es
/// da, kam die Anfrage aus dem Internet und nicht aus dem lokalen Netz.
const TUNNEL_MARKER_HEADER: &str = "cf-connecting-ip";

/// Einloesen einer Einladung: richtige PIN rein, Sitzungs-Token raus. Die
/// Einladung ist danach verbraucht - ein abgefangener oder
/// weitergegebener Code nuetzt niemandem mehr etwas.
pub async fn api_sync_pair(body: Bytes) -> Response {
    let Some(state) = global() else {
        return (StatusCode::SERVICE_UNAVAILABLE, "Sync nicht bereit").into_response();
    };
    let payload: serde_json::Value = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(_) => return (StatusCode::BAD_REQUEST, "Ungueltige Anfrage").into_response(),
    };
    let pin = payload.get("pin").and_then(|v| v.as_str()).unwrap_or("");
    let peer_name = payload.get("name").and_then(|v| v.as_str()).unwrap_or("Geraet");

    {
        let mut invite = state.0.invite.lock().unwrap();
        let valid = invite
            .as_ref()
            .is_some_and(|i| i.created_at.elapsed() <= INVITE_TTL && i.pin == pin);
        if !valid {
            // Abgelaufene Einladung gleich wegraeumen, damit sie nicht als
            // "aktiv" gilt und den Tunnel unnoetig festhaelt.
            if invite.as_ref().is_some_and(|i| i.created_at.elapsed() > INVITE_TTL) {
                *invite = None;
            }
            return (StatusCode::UNAUTHORIZED, "Code ungueltig").into_response();
        }
        *invite = None; // einmalig: verbraucht
    }

    let token = uuid::Uuid::new_v4().to_string();
    {
        let mut sessions = state.0.sessions.lock().unwrap();
        sessions.retain(|_, s| s.created_at.elapsed() <= SESSION_TTL);
        sessions.insert(
            token.clone(),
            Session { name: peer_name.to_string(), created_at: Instant::now() },
        );
    }
    axum::Json(serde_json::json!({ "token": token, "name": device_name() })).into_response()
}

/// Darf diese Anfrage Dateien ablegen? Aus dem lokalen Netz ja (das war
/// schon immer die Vertrauensgrenze), durch den Tunnel nur mit gueltigem
/// Sitzungs-Token.
fn receive_allowed(headers: &HeaderMap) -> bool {
    let through_tunnel = headers.contains_key(TUNNEL_MARKER_HEADER);
    let token = headers.get(SYNC_TOKEN_HEADER).and_then(|v| v.to_str().ok()).unwrap_or("");
    if !token.is_empty() {
        if let Some(state) = global() {
            let mut sessions = state.0.sessions.lock().unwrap();
            sessions.retain(|_, s| s.created_at.elapsed() <= SESSION_TTL);
            if sessions.contains_key(token) {
                return true;
            }
        }
    }
    !through_tunnel
}

/// Was ueberhaupt in der Bibliothek landen darf. Genau die Dateiarten, die
/// die App selbst erzeugt - Musik, Video und die Beidateien daneben.
///
/// Warum das noetig ist: /sync/receive nimmt Anfragen aus dem lokalen Netz
/// ohne Kopplung an (das war immer die Vertrauensgrenze, siehe
/// receive_allowed). Im heimischen WLAN vertretbar - im Cafe-, Hotel- oder
/// Uni-WLAN heisst das aber, dass ein Fremder eine beliebige Datei mit
/// beliebigem Namen in einen Ordner legen kann, den man selbst regelmaessig
/// oeffnet. Eine .exe/.bat/.lnk dort ist genau der Koeder, der so etwas
/// gefaehrlich macht. Mit dieser Liste kann bestenfalls eine kaputte
/// Musikdatei ankommen.
fn erlaubte_endung(filename: &str) -> bool {
    const ERLAUBT: &[&str] = &[
        // Musik/Video
        ".mp3", ".m4a", ".mp4", ".opus", ".webm", ".flac", ".wav", ".ogg", ".aac",
        // Beidateien (siehe commands.rs/lyrics.rs: with_extension(...))
        ".jpg", ".jpeg", ".png", ".artist.txt", ".album.txt", ".lyrics.json",
        ".cover_cache.jpg", ".loudness.json",
    ];
    let lower = filename.to_ascii_lowercase();
    // Kein Punkt am Anfang (".bashrc") und kein Name ohne Endung.
    if lower.starts_with('.') {
        return false;
    }
    ERLAUBT.iter().any(|e| lower.ends_with(e))
}

/// Writes whatever bytes arrive straight into `<music_root>/<playlist>/
/// <filename>` - the sender already picked a real audio file or one of its
/// sidecars, so this never needs to interpret the bytes, just store them.
pub async fn api_sync_receive(
    State(hub): State<Hub>,
    Query(params): Query<HashMap<String, String>>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    if !receive_allowed(&headers) {
        return (StatusCode::UNAUTHORIZED, "Nicht gekoppelt").into_response();
    }
    let playlist = params.get("playlist").cloned().unwrap_or_default();
    let filename = params.get("filename").cloned().unwrap_or_default();
    if playlist.is_empty() || filename.is_empty() {
        return (StatusCode::BAD_REQUEST, "playlist/filename fehlt").into_response();
    }
    // Der Dateiname lief bisher UNGEFILTERT in den Pfad - nur die Playlist
    // ging durch safe_filename. Beides jetzt, sonst landet hier alles, was
    // das Gegenueber schickt, unter genau dem Namen im Musikordner.
    let rel = format!(
        "{}/{}",
        crate::commands::safe_filename(&playlist),
        crate::commands::safe_filename(&filename)
    );
    if !erlaubte_endung(&filename) {
        return (StatusCode::BAD_REQUEST, "Dateityp nicht erlaubt").into_response();
    }
    let path = match crate::commands::safe_join(&hub.0.music_root, &rel) {
        Ok(p) => p,
        Err(e) => return (StatusCode::BAD_REQUEST, e).into_response(),
    };
    match tokio::fs::write(&path, &body).await {
        Ok(_) => {
            // The write lands straight on disk - nothing tells this
            // device's own UI a file just appeared unless we say so. Was
            // the actual bug behind "gesendet, aber nichts auf dem Handy":
            // transfer worked, the library view just never re-fetched.
            hub.notify_app("library-changed");
            (StatusCode::OK, "ok").into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}
