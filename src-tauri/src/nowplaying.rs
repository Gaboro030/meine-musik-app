/// Spotify/YouTube-Music-Style Wiedergabe-Notification (Android). Ohne
/// einen Foreground-Service pausiert Android die WebView/JS des Tauri-
/// Fensters sobald die App in den Hintergrund geht - kein Workaround von
/// der Webview-Seite möglich. android-extra/PlaybackService.kt ist genau
/// so ein Service (MediaSession + MediaStyle-Notification mit Titel/
/// Interpret + Prev/Play-Pause/Next); dieses Modul ist die Rust<->Kotlin-
/// Brücke, die ihn tatsächlich startet/aktualisiert/stoppt, sobald ein
/// Song läuft, und Notification-Tastendrücke als "media-control"-Event
/// zurück ans Frontend gibt.
///
/// Android-only - Desktop braucht kein Pendant (kein Hintergrund-Pausieren
/// dort), die Befehle unten sind auf jeder Plattform vorhanden, tun auf
/// Desktop aber einfach nichts.
#[cfg(target_os = "android")]
pub mod android {
    use serde::Serialize;
    use tauri::plugin::{Builder, PluginHandle, TauriPlugin};
    use tauri::{Manager, Wry};

    const PLUGIN_IDENTIFIER: &str = "com.meinemusik.app";

    pub struct NowPlaying(pub PluginHandle<Wry>);

    #[derive(Serialize, Clone)]
    pub struct NowPlayingPayload {
        pub title: String,
        pub artist: String,
        pub playing: bool,
    }

    #[derive(Serialize, Clone)]
    pub struct Empty {}

    pub fn init() -> TauriPlugin<Wry> {
        Builder::new("now-playing")
            .setup(|app, api| {
                let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "NowPlayingPlugin")?;
                app.manage(NowPlaying(handle));
                Ok(())
            })
            .build()
    }
}

#[tauri::command]
pub async fn update_now_playing(
    app: tauri::AppHandle,
    title: String,
    artist: String,
    playing: bool,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        use tauri::Manager;
        let state = app.state::<android::NowPlaying>();
        state
            .0
            .run_mobile_plugin(
                "updateNowPlaying",
                android::NowPlayingPayload { title, artist, playing },
            )
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, title, artist, playing);
    }
    Ok(())
}

#[tauri::command]
pub async fn clear_now_playing(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        use tauri::Manager;
        let state = app.state::<android::NowPlaying>();
        state
            .0
            .run_mobile_plugin("clearNowPlaying", android::Empty {})
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
    }
    Ok(())
}
