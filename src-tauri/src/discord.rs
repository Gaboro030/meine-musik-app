//! Discord Rich Presence: zeigt Freunden auf Discord, was gerade laeuft
//! ("Hoert <Titel> von <Interpret>", inkl. Cover und Fortschrittsbalken).
//!
//! Desktop-only. Die Crate spricht Discords lokale IPC (Named Pipe unter
//! Windows, Unix-Socket sonst) - beides gibt es auf Android nicht, und
//! einen Discord-Client, mit dem man sich verbinden koennte, erst recht
//! nicht. Deshalb haengt discord-rich-presence in Cargo.toml als
//! Target-Dependency, damit der Android-Build den Crate gar nicht erst
//! sieht (gleiche Bauart wie tauri-plugin-global-shortcut).
//!
//! Cover: Discord kann nur oeffentlich erreichbare Bild-URLs anzeigen, die
//! Cover dieser App liegen aber als eingebettete ID3-Bilder bzw. als
//! data:-URLs vor - beides unbrauchbar. Deshalb wird pro Titel EINMAL bei
//! Deezer nachgeschlagen (dieselbe Quelle, die cover.rs schon fuer
//! fehlende Cover nutzt; deren `cover_medium` ist eine oeffentliche
//! HTTPS-URL) und das Ergebnis fuer die Laufzeit gemerkt. Findet Deezer
//! nichts, bleibt es beim Standardbild der Discord-Anwendung.

/// Ohne eigene Discord-Anwendung geht es nicht: die ID bestimmt, welcher
/// Name in Discord ueber der Anzeige steht ("Hoert <Name der Anwendung>").
/// Es gibt keine allgemeingueltige ID, die man mitliefern koennte - jede
/// gehoert zu genau einer im Discord-Entwicklerportal angelegten
/// Anwendung. Sie kommt deshalb aus den Einstellungen; ohne sie bleibt die
/// Funktion einfach aus, statt still ins Leere zu senden.
#[cfg(not(any(target_os = "android", target_os = "ios")))]
mod imp {
    use discord_rich_presence::activity::{Activity, ActivityType, Assets, Timestamps};
    use discord_rich_presence::{DiscordIpc, DiscordIpcClient};
    use std::collections::HashMap;
    use std::sync::Mutex;

    struct Connection {
        client: DiscordIpcClient,
        app_id: String,
    }

    static CONNECTION: Mutex<Option<Connection>> = Mutex::new(None);
    /// "<Interpret>\0<Titel>" -> Cover-URL. Ein leerer Wert heisst "bei
    /// Deezer nachgesehen, nichts gefunden" - sonst wuerde bei jedem
    /// Fortschritts-Update erneut angefragt.
    static COVER_URLS: Mutex<Option<HashMap<String, String>>> = Mutex::new(None);

    fn cached_cover(key: &str) -> Option<String> {
        COVER_URLS.lock().ok()?.as_ref()?.get(key).cloned()
    }

    fn remember_cover(key: String, url: String) {
        if let Ok(mut guard) = COVER_URLS.lock() {
            guard.get_or_insert_with(HashMap::new).insert(key, url);
        }
    }

    /// Deezers Suche liefert die Album-Cover-URL direkt mit, ohne API-Key
    /// und in einem Request - siehe fetch_from_deezer in cover.rs, das
    /// dieselbe Antwort nutzt (dort werden allerdings die Bytes geladen,
    /// hier reicht die URL selbst).
    async fn lookup_cover_url(title: &str, artist: &str) -> String {
        let key = format!("{artist}\u{0}{title}");
        if let Some(hit) = cached_cover(&key) {
            return hit;
        }
        let url = deezer_cover(title, artist).await.unwrap_or_default();
        remember_cover(key, url.clone());
        url
    }

    async fn deezer_cover(title: &str, artist: &str) -> Option<String> {
        let client = reqwest::Client::builder()
            .user_agent("meine-musik/0.1 (+https://github.com/Gaboro030/meine-musik-app)")
            .build()
            .ok()?;
        let resp = client
            .get("https://api.deezer.com/search")
            .query(&[("q", format!("{artist} {title}"))])
            .send()
            .await
            .ok()?;
        if !resp.status().is_success() {
            return None;
        }
        let data: serde_json::Value = resp.json().await.ok()?;
        Some(
            data.get("data")?
                .get(0)?
                .get("album")?
                .get("cover_medium")?
                .as_str()?
                .to_string(),
        )
    }

    /// Alles an der Crate ist blockierend (Named Pipe / Unix-Socket), darf
    /// also nie direkt im async-Kontext laufen - sonst blockiert ein nicht
    /// laufender oder haengender Discord-Client den ganzen Runtime-Thread.
    fn with_client<F>(app_id: &str, f: F) -> Result<(), String>
    where
        F: FnOnce(&mut DiscordIpcClient) -> Result<(), String>,
    {
        let mut guard = CONNECTION.lock().map_err(|_| "Discord-Verbindung blockiert.".to_string())?;

        // Andere Anwendungs-ID als beim letzten Mal (Einstellung geaendert):
        // alte Verbindung schliessen, die gehoert zur alten Anwendung.
        if guard.as_ref().is_some_and(|c| c.app_id != app_id) {
            if let Some(mut old) = guard.take() {
                let _ = old.client.close();
            }
        }

        if guard.is_none() {
            let mut client = DiscordIpcClient::new(app_id);
            client
                .connect()
                .map_err(|e| format!("Discord nicht erreichbar: {e}"))?;
            *guard = Some(Connection { client, app_id: app_id.to_string() });
        }

        let conn = guard.as_mut().expect("gerade gesetzt");
        match f(&mut conn.client) {
            Ok(()) => Ok(()),
            Err(e) => {
                // Discord wurde zwischendurch beendet o.ae. - Verbindung
                // wegwerfen, damit der naechste Aufruf sauber neu aufbaut
                // statt ewig auf einer toten Pipe zu scheitern.
                if let Some(mut dead) = guard.take() {
                    let _ = dead.client.close();
                }
                Err(e)
            }
        }
    }

    fn now_millis() -> i64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0)
    }

    pub async fn update(
        app_id: String,
        title: String,
        artist: String,
        playing: bool,
        position: f64,
        duration: f64,
    ) -> Result<(), String> {
        if app_id.trim().is_empty() {
            return clear();
        }
        let cover = lookup_cover_url(&title, &artist).await;

        tauri::async_runtime::spawn_blocking(move || {
            with_client(app_id.trim(), |client| {
                // Discord zeigt "Hoert <Anwendungsname>" und darunter
                // details/state - Titel gehoert also in details, Interpret
                // in state (gleiche Aufteilung wie bei Spotify).
                let mut assets = Assets::new();
                if !cover.is_empty() {
                    assets = assets.large_image(cover.as_str()).large_text(title.as_str());
                }
                let mut activity = Activity::new()
                    .activity_type(ActivityType::Listening)
                    .details(title.as_str())
                    .assets(assets);
                if !artist.is_empty() {
                    activity = activity.state(artist.as_str());
                }
                // Fortschrittsbalken entsteht bei ActivityType::Listening
                // aus start UND end. Beim Pausieren beide weglassen: sonst
                // liefe der Balken in Discord weiter, obwohl nichts spielt.
                if playing && duration > 0.0 {
                    let start = now_millis() - (position * 1000.0) as i64;
                    activity = activity.timestamps(
                        Timestamps::new().start(start).end(start + (duration * 1000.0) as i64),
                    );
                }
                client.set_activity(activity).map_err(|e| e.to_string())
            })
        })
        .await
        .map_err(|e| e.to_string())?
    }

    pub fn clear() -> Result<(), String> {
        let mut guard = CONNECTION.lock().map_err(|_| "Discord-Verbindung blockiert.".to_string())?;
        if let Some(mut conn) = guard.take() {
            let _ = conn.client.clear_activity();
            let _ = conn.client.close();
        }
        Ok(())
    }
}

#[cfg(any(target_os = "android", target_os = "ios"))]
mod imp {
    pub async fn update(
        _app_id: String,
        _title: String,
        _artist: String,
        _playing: bool,
        _position: f64,
        _duration: f64,
    ) -> Result<(), String> {
        Err("Discord-Status gibt es nur auf dem Desktop.".into())
    }
    pub fn clear() -> Result<(), String> {
        Ok(())
    }
}

#[tauri::command]
pub async fn discord_update(
    app_id: String,
    title: String,
    artist: String,
    playing: bool,
    position: f64,
    duration: f64,
) -> Result<(), String> {
    imp::update(app_id, title, artist, playing, position, duration).await
}

#[tauri::command]
pub fn discord_clear() -> Result<(), String> {
    imp::clear()
}
