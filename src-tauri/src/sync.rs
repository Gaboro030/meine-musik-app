//! Phone <-> PC library sync: discover other devices with the Sync panel
//! open on the same WiFi (a small UDP broadcast beacon - no manual IP
//! entry or QR code needed for this one) and push whole playlists straight
//! into their library. Reuses the embedded HTTP server party.rs already
//! runs at all times (adds one route, POST /sync/receive) instead of
//! standing up a second server. Files transfer as plain HTTP POSTs of raw
//! bytes, one file per request (the audio file plus its .jpg/.artist.txt
//! sidecars if present) - written verbatim into the receiving device's
//! music_root, no metadata reconstruction needed since the files already
//! carry everything they need.
//!
//! Direction is symmetric: whichever device has a playlist open and picks
//! a discovered peer PUSHES its files to that peer. Same code path runs on
//! every platform, so this works PC->Handy, Handy->PC, or PC->PC.

use crate::party::Hub;
use axum::{
    body::Bytes,
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::Emitter;

const BEACON_PORT: u16 = 45654;
const BEACON_INTERVAL: Duration = Duration::from_millis(2000);
const PEER_TIMEOUT: Duration = Duration::from_secs(8);

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
    pub name: String,
    pub ip: String,
    pub port: u16,
    #[serde(skip)]
    last_seen: Instant,
}

struct SyncInner {
    peers: Mutex<HashMap<String, Peer>>,
    running: AtomicBool,
    instance_id: String,
}

#[derive(Clone)]
pub struct SyncState(Arc<SyncInner>);

impl SyncState {
    pub fn new() -> Self {
        SyncState(Arc::new(SyncInner {
            peers: Mutex::new(HashMap::new()),
            running: AtomicBool::new(false),
            instance_id: uuid::Uuid::new_v4().to_string(),
        }))
    }
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
    peers.retain(|_, p| p.last_seen >= cutoff);
    peers.values().cloned().collect()
}

/// Pushes every file (audio + sidecars) in the given playlists to a
/// discovered peer, a few at a time. The peer needs nothing from us but
/// its IP/port (from discovery) - it just receives whatever bytes arrive
/// at POST /sync/receive and writes them into its own library.
#[tauri::command]
pub async fn sync_send_playlists(
    app: tauri::AppHandle,
    hub: tauri::State<'_, Hub>,
    task_id: String,
    peer_ip: String,
    peer_port: u16,
    playlist_names: Vec<String>,
) -> Result<serde_json::Value, String> {
    use futures_util::StreamExt;

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
        let peer_ip = peer_ip.clone();
        let app = app.clone();
        let event = event.clone();
        let done = done.clone();
        let failed = failed.clone();
        async move {
            let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
            if !filename.is_empty() {
                if let Err(e) = send_one_file(&client, &peer_ip, peer_port, &playlist, &filename, &path).await {
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
    Ok(serde_json::json!({ "sent": total - failed.len(), "failed": failed, "total": total }))
}

async fn send_one_file(
    client: &reqwest::Client,
    ip: &str,
    port: u16,
    playlist: &str,
    filename: &str,
    path: &std::path::Path,
) -> Result<(), String> {
    let bytes = tokio::fs::read(path).await.map_err(|e| e.to_string())?;
    let url = format!(
        "http://{ip}:{port}/sync/receive?playlist={}&filename={}",
        percent_encoding::utf8_percent_encode(playlist, percent_encoding::NON_ALPHANUMERIC),
        percent_encoding::utf8_percent_encode(filename, percent_encoding::NON_ALPHANUMERIC),
    );
    let resp = client
        .post(&url)
        .body(bytes)
        .send()
        .await
        .map_err(|e| format!("Nicht erreichbar: {e}"))?;
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
                let key = format!("{ip}:{peer_port}");
                let is_new = {
                    let mut peers = state.0.peers.lock().unwrap();
                    let is_new = !peers.contains_key(&key);
                    peers.insert(key, Peer { name: peer_name, ip, port: peer_port, last_seen: Instant::now() });
                    is_new
                };
                if is_new {
                    let _ = app.emit("sync-peers-changed", ());
                }
            }
        }
    }
}

// --- Receiving side: one route added to party.rs's always-running server ---

/// Writes whatever bytes arrive straight into `<music_root>/<playlist>/
/// <filename>` - the sender already picked a real audio file or one of its
/// sidecars, so this never needs to interpret the bytes, just store them.
pub async fn api_sync_receive(
    State(hub): State<Hub>,
    Query(params): Query<HashMap<String, String>>,
    body: Bytes,
) -> Response {
    let playlist = params.get("playlist").cloned().unwrap_or_default();
    let filename = params.get("filename").cloned().unwrap_or_default();
    if playlist.is_empty() || filename.is_empty() {
        return (StatusCode::BAD_REQUEST, "playlist/filename fehlt").into_response();
    }
    let rel = format!("{}/{}", crate::commands::safe_filename(&playlist), filename);
    let path = match crate::commands::safe_join(&hub.0.music_root, &rel) {
        Ok(p) => p,
        Err(e) => return (StatusCode::BAD_REQUEST, e).into_response(),
    };
    match tokio::fs::write(&path, &body).await {
        Ok(_) => (StatusCode::OK, "ok").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}
