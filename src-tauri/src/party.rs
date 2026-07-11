//! Party mode: embedded LAN HTTP server replacing the Flask server the
//! original guest page talked to. Guests on the same WiFi scan the QR code
//! (or open http://<lan-ip>:8765/guest), see the host's currently playing
//! track live, can listen along in sync, and can add library songs to the
//! host's collaborative queue - exactly the feature set of the old Flask
//! /guest + /api/queue + /api/party/state + /api/events routes.
//!
//! The host app itself never talks HTTP to this server: its frontend goes
//! through tauri-shim.js -> the #[tauri::command]s below, which mutate the
//! same shared Hub. Events flow both ways: everything broadcast to guests
//! over SSE is also re-emitted on Tauri's event bus (`party-<name>`) so the
//! host UI sees guest queue adds instantly.

use axum::{
    extract::{Path as AxPath, State},
    http::{header, HeaderMap, StatusCode},
    response::sse::{Event, KeepAlive, Sse},
    response::{Html, IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use futures_util::StreamExt;
use serde_json::json;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use tokio::sync::broadcast;

const GUEST_HTML: &str = include_str!("../guest.html");
const GUEST_CSS: &str = include_str!("../../src/styles.css");
const DEFAULT_PORT: u16 = 8765;

#[derive(Clone)]
pub struct Hub(pub Arc<HubInner>);

pub struct HubInner {
    pub music_root: PathBuf,
    queue: Mutex<Vec<serde_json::Value>>,
    party: Mutex<serde_json::Value>,
    tx: broadcast::Sender<(String, String)>,
    port: AtomicU16,
    app: OnceLock<tauri::AppHandle>,
    // Internet mode: cloudflared quick tunnel (free, no account) exposing
    // the LAN server at a public https://*.trycloudflare.com URL so guests
    // outside the WiFi can join too.
    public_url: Mutex<Option<String>>,
    tunnel: Mutex<Option<tauri_plugin_shell::process::CommandChild>>,
}

fn default_party_state() -> serde_json::Value {
    json!({
        "active": false, "playlist": null, "file": null, "title": null,
        "artist": null, "cover": null, "stream_url": null,
        "position": 0, "playing": false, "updated": 0,
    })
}

impl Hub {
    pub fn new(music_root: PathBuf) -> Self {
        let (tx, _) = broadcast::channel(64);
        Hub(Arc::new(HubInner {
            music_root,
            queue: Mutex::new(Vec::new()),
            party: Mutex::new(default_party_state()),
            tx,
            port: AtomicU16::new(DEFAULT_PORT),
            app: OnceLock::new(),
            public_url: Mutex::new(None),
            tunnel: Mutex::new(None),
        }))
    }

    pub fn set_app(&self, app: tauri::AppHandle) {
        let _ = self.0.app.set(app);
    }

    /// Fan-out: SSE to every guest phone AND the Tauri event bus for the
    /// host UI (tauri-shim.js maps EventSource("/api/events") listeners
    /// onto `party-<name>` Tauri events).
    fn broadcast(&self, event: &str, payload: &serde_json::Value) {
        let _ = self.0.tx.send((event.to_string(), payload.to_string()));
        if let Some(app) = self.0.app.get() {
            use tauri::Emitter;
            let _ = app.emit(&format!("party-{event}"), payload.clone());
        }
    }
}

fn truncated(v: &serde_json::Value, key: &str, max: usize) -> serde_json::Value {
    match v.get(key).and_then(|x| x.as_str()) {
        Some(s) => json!(s.chars().take(max).collect::<String>()),
        None => serde_json::Value::Null,
    }
}

fn enc(s: &str) -> String {
    percent_encoding::utf8_percent_encode(s, percent_encoding::NON_ALPHANUMERIC).to_string()
}

/// Sanitize + store a host playback snapshot, then relay it to everyone.
/// Guests can't reach the host-internal stream protocol
/// (http://stream.localhost/...), so their stream_url is rewritten to this
/// server's own /stream route - relative, so it resolves against whatever
/// LAN address the guest loaded the page from.
fn apply_party_state(hub: &Hub, data: &serde_json::Value) -> serde_json::Value {
    let playlist = data.get("playlist").and_then(|x| x.as_str()).unwrap_or("");
    let file = data.get("file").and_then(|x| x.as_str()).unwrap_or("");
    let guest_stream = if !playlist.is_empty() && !file.is_empty() {
        json!(format!("/stream/{}/{}", enc(playlist), enc(file)))
    } else {
        serde_json::Value::Null
    };
    let snapshot = json!({
        "active": data.get("active").and_then(|x| x.as_bool()).unwrap_or(false),
        "playlist": truncated(data, "playlist", 180),
        "file": truncated(data, "file", 255),
        "title": truncated(data, "title", 300),
        "artist": truncated(data, "artist", 300),
        // Covers are base64 data: URIs from embedded ID3 art - can be a few
        // hundred KB, cap well above that (same guard the Flask route had).
        "cover": truncated(data, "cover", 2_000_000),
        "stream_url": guest_stream,
        "position": data.get("position").and_then(|x| x.as_f64()).unwrap_or(0.0),
        "playing": data.get("playing").and_then(|x| x.as_bool()).unwrap_or(false),
        "updated": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs_f64())
            .unwrap_or(0.0),
    });
    *hub.0.party.lock().unwrap() = snapshot.clone();
    hub.broadcast("party_sync", &snapshot);
    snapshot
}

/// Look the track up in the real library instead of trusting client-sent
/// metadata - a guest can only queue something that genuinely exists
/// (mirrors Flask's _find_track_in_library).
fn queue_add_inner(hub: &Hub, playlist: &str, file: &str) -> Result<serde_json::Value, String> {
    let dir = crate::commands::safe_join(&hub.0.music_root, &crate::commands::safe_filename(playlist))?;
    let path = crate::commands::safe_join(&dir, file)?;
    if !path.is_file() {
        return Err("Titel nicht gefunden.".into());
    }
    let meta = crate::commands::read_track_meta(&path);
    let entry = json!({
        "id": uuid::Uuid::new_v4().to_string(),
        "title": meta.title,
        "artist": meta.artist,
        "cover": meta.cover,
        // Host-internal URL - the HOST plays queued entries, guests only
        // see title/artist/cover in their queue list.
        "stream_url": crate::commands::stream_url_for(playlist, &meta.file),
        "added": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs_f64())
            .unwrap_or(0.0),
    });
    let snapshot = {
        let mut q = hub.0.queue.lock().unwrap();
        q.push(entry.clone());
        q.clone()
    };
    hub.broadcast("queue_update", &json!({ "queue": snapshot }));
    Ok(entry)
}

fn queue_remove_inner(hub: &Hub, entry_id: &str) -> bool {
    let (removed, snapshot) = {
        let mut q = hub.0.queue.lock().unwrap();
        let before = q.len();
        q.retain(|e| e.get("id").and_then(|x| x.as_str()) != Some(entry_id));
        (q.len() != before, q.clone())
    };
    if removed {
        hub.broadcast("queue_update", &json!({ "queue": snapshot }));
    }
    removed
}

/// Best-effort LAN IP for the guest QR code. Doesn't send any traffic -
/// just asks the OS which local interface it would route an external
/// address through (same trick as the Flask get_lan_ip()).
fn lan_ip() -> String {
    std::net::UdpSocket::bind("0.0.0.0:0")
        .and_then(|s| {
            s.connect("8.8.8.8:80")?;
            s.local_addr()
        })
        .map(|a| a.ip().to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string())
}

// --- Tauri commands (host side, via tauri-shim.js) --------------------------

fn qr_data_uri(url: &str) -> Result<String, String> {
    let code = qrcode::QrCode::new(url.as_bytes()).map_err(|e| e.to_string())?;
    let svg = code
        .render::<qrcode::render::svg::Color>()
        .min_dimensions(200, 200)
        .build();
    Ok(format!(
        "data:image/svg+xml;utf8,{}",
        percent_encoding::utf8_percent_encode(&svg, percent_encoding::NON_ALPHANUMERIC)
    ))
}

/// Guest URL + SVG QR code (as data: URI) for the sidebar popover. When the
/// internet tunnel is up, the QR points at the public URL instead of the
/// LAN one - the LAN address keeps working either way.
#[tauri::command]
pub fn party_info(hub: tauri::State<Hub>) -> Result<serde_json::Value, String> {
    let public = hub.0.public_url.lock().unwrap().clone();
    let url = public.clone().unwrap_or_else(|| {
        format!("http://{}:{}/guest", lan_ip(), hub.0.port.load(Ordering::Relaxed))
    });
    Ok(json!({ "url": url, "qr": qr_data_uri(&url)?, "internet": public.is_some() }))
}

/// Toggle the internet guest link: spawns a cloudflared "quick tunnel"
/// (free, anonymous, no Cloudflare account needed) that forwards a public
/// https://<random>.trycloudflare.com address to the embedded LAN server.
/// Guests anywhere on the internet can then use the exact same guest page,
/// SSE sync and audio streaming - the tunnel is outbound-only, so it works
/// through NAT/firewalls without any port forwarding.
#[tauri::command]
pub async fn party_internet(
    app: tauri::AppHandle,
    hub: tauri::State<'_, Hub>,
    enable: bool,
) -> Result<serde_json::Value, String> {
    use tauri_plugin_shell::process::CommandEvent;
    use tauri_plugin_shell::ShellExt;

    if !enable {
        if let Some(child) = hub.0.tunnel.lock().unwrap().take() {
            let _ = child.kill();
        }
        *hub.0.public_url.lock().unwrap() = None;
        return Ok(json!({ "ok": true, "public_url": serde_json::Value::Null }));
    }

    if let Some(existing) = hub.0.public_url.lock().unwrap().clone() {
        return Ok(json!({ "ok": true, "public_url": existing }));
    }

    let port = hub.0.port.load(Ordering::Relaxed);
    let spawned = app
        .shell()
        .sidecar("cloudflared")
        .map_err(|_| "Internet-Link ist nur in der Desktop-App verfügbar.".to_string())?
        .args([
            "tunnel",
            "--no-autoupdate",
            "--url",
            &format!("http://127.0.0.1:{port}"),
        ])
        .spawn()
        .map_err(|e| format!("cloudflared konnte nicht starten: {e}"))?;
    let (rx, child) = spawned;
    *hub.0.tunnel.lock().unwrap() = Some(child);

    // cloudflared prints the assigned URL to stderr within a few seconds -
    // scan its output until it shows up (or give up after 45s).
    let url_re = regex::Regex::new(r"https://[a-z0-9-]+\.trycloudflare\.com").unwrap();
    let mut rx_opt = Some(rx);
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(45);
    while std::time::Instant::now() < deadline {
        let rx_ref = rx_opt.as_mut().unwrap();
        match tokio::time::timeout(std::time::Duration::from_secs(5), rx_ref.recv()).await {
            Ok(Some(CommandEvent::Stdout(bytes))) | Ok(Some(CommandEvent::Stderr(bytes))) => {
                let line = String::from_utf8_lossy(&bytes);
                if let Some(m) = url_re.find(&line) {
                    let url = format!("{}/guest", m.as_str());
                    *hub.0.public_url.lock().unwrap() = Some(url.clone());
                    // Keep draining cloudflared's output so its pipe never
                    // fills up and blocks the tunnel process.
                    let mut rx_bg = rx_opt.take().unwrap();
                    tauri::async_runtime::spawn(async move {
                        while rx_bg.recv().await.is_some() {}
                    });
                    return Ok(json!({ "ok": true, "public_url": url }));
                }
            }
            Ok(Some(_)) => {}
            Ok(None) => break, // tunnel process exited
            Err(_) => {}       // 5s poll tick, keep waiting
        }
    }

    if let Some(child) = hub.0.tunnel.lock().unwrap().take() {
        let _ = child.kill();
    }
    Err("Internet-Link konnte nicht erstellt werden (Internetverbindung prüfen).".into())
}

#[tauri::command]
pub fn party_get_state(hub: tauri::State<Hub>) -> serde_json::Value {
    hub.0.party.lock().unwrap().clone()
}

#[tauri::command]
pub fn party_set_state(hub: tauri::State<Hub>, state: serde_json::Value) -> serde_json::Value {
    apply_party_state(&hub, &state)
}

#[tauri::command]
pub fn queue_list(hub: tauri::State<Hub>) -> Vec<serde_json::Value> {
    hub.0.queue.lock().unwrap().clone()
}

#[tauri::command]
pub fn queue_remove(hub: tauri::State<Hub>, entry_id: String) -> bool {
    queue_remove_inner(&hub, &entry_id)
}

// --- LAN HTTP server (guest side) -------------------------------------------

pub async fn run_server(hub: Hub) {
    let router = Router::new()
        .route("/", get(guest_page))
        .route("/guest", get(guest_page))
        .route("/static/player.css", get(guest_css))
        .route("/api/library", get(api_library))
        .route("/api/queue", get(api_queue_list))
        .route("/api/queue/add", post(api_queue_add))
        .route("/api/queue/:id", delete(api_queue_delete))
        .route("/api/party/state", get(api_party_get).post(api_party_post))
        .route("/api/events", get(api_events))
        .route("/stream/:playlist/:file", get(api_stream))
        .with_state(hub.clone());

    let listener = match tokio::net::TcpListener::bind(("0.0.0.0", DEFAULT_PORT)).await {
        Ok(l) => l,
        // Port taken (e.g. two app instances) - grab any free one; the QR
        // code reads the real port from the Hub, so it stays correct.
        Err(_) => match tokio::net::TcpListener::bind(("0.0.0.0", 0)).await {
            Ok(l) => l,
            Err(e) => {
                eprintln!("Party-Server konnte nicht starten: {e}");
                return;
            }
        },
    };
    if let Ok(addr) = listener.local_addr() {
        hub.0.port.store(addr.port(), Ordering::Relaxed);
    }
    if let Err(e) = axum::serve(listener, router).await {
        eprintln!("Party-Server beendet: {e}");
    }
}

async fn guest_page() -> Html<&'static str> {
    Html(GUEST_HTML)
}

async fn guest_css() -> impl IntoResponse {
    ([(header::CONTENT_TYPE, "text/css")], GUEST_CSS)
}

/// Same JSON shape as the host's /api/library, but with every stream_url
/// rewritten to this server's own /stream route so guest devices can
/// actually reach the audio.
async fn api_library(State(hub): State<Hub>) -> Json<serde_json::Value> {
    let mut playlists = crate::commands::list_playlists_inner(&hub.0.music_root);
    for pl in &mut playlists {
        for t in &mut pl.tracks {
            t.stream_url = format!("/stream/{}/{}", enc(&pl.name), enc(&t.file));
        }
    }
    Json(json!({ "playlists": playlists }))
}

async fn api_queue_list(State(hub): State<Hub>) -> Json<serde_json::Value> {
    Json(json!({ "queue": hub.0.queue.lock().unwrap().clone() }))
}

async fn api_queue_add(
    State(hub): State<Hub>,
    Json(body): Json<serde_json::Value>,
) -> Response {
    let playlist = body.get("playlist").and_then(|x| x.as_str()).unwrap_or("").trim();
    let file = body.get("file").and_then(|x| x.as_str()).unwrap_or("").trim();
    if playlist.is_empty() || file.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({ "error": "Playlist/Datei fehlt." }))).into_response();
    }
    match queue_add_inner(&hub, playlist, file) {
        Ok(entry) => Json(json!({ "ok": true, "entry": entry })).into_response(),
        Err(e) => (StatusCode::NOT_FOUND, Json(json!({ "error": e }))).into_response(),
    }
}

async fn api_queue_delete(State(hub): State<Hub>, AxPath(id): AxPath<String>) -> Json<serde_json::Value> {
    Json(json!({ "ok": queue_remove_inner(&hub, &id) }))
}

async fn api_party_get(State(hub): State<Hub>) -> Json<serde_json::Value> {
    Json(hub.0.party.lock().unwrap().clone())
}

async fn api_party_post(
    State(hub): State<Hub>,
    Json(body): Json<serde_json::Value>,
) -> Json<serde_json::Value> {
    apply_party_state(&hub, &body);
    Json(json!({ "ok": true }))
}

async fn api_events(
    State(hub): State<Hub>,
) -> Sse<impl futures_util::Stream<Item = Result<Event, std::convert::Infallible>>> {
    let rx = hub.0.tx.subscribe();
    let stream = tokio_stream::wrappers::BroadcastStream::new(rx).filter_map(|msg| async move {
        match msg {
            Ok((event, data)) => Some(Ok(Event::default().event(event).data(data))),
            // Lagged receiver (guest phone slept through >64 events) - just
            // skip the missed ones, the next party_sync heartbeat catches up.
            Err(_) => None,
        }
    });
    Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(std::time::Duration::from_secs(15))
            .text("heartbeat"),
    )
}

/// MP3 streaming with byte-range support for guest devices - reuses the
/// exact same stream_file() the host's stream:// protocol uses (tauri and
/// axum share the same `http` crate types, so the response converts 1:1).
async fn api_stream(
    State(hub): State<Hub>,
    AxPath((playlist, file)): AxPath<(String, String)>,
    headers: HeaderMap,
) -> Response {
    let range = headers
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);
    // AxPath already percent-decoded the segments; stream_file decodes once
    // more, so re-encode here to keep names with %/# intact.
    let rel = format!("{}/{}", enc(&playlist), enc(&file));
    let resp = crate::commands::stream_file(&hub.0.music_root, &rel, range).await;
    let (parts, body) = resp.into_parts();
    Response::from_parts(parts, axum::body::Body::from(body))
}
