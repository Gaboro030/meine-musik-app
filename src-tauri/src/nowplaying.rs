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

    const PLUGIN_IDENTIFIER: &str = "com.reson.app";

    pub struct NowPlaying(pub PluginHandle<Wry>);

    #[derive(Serialize, Clone)]
    #[serde(rename_all = "camelCase")]
    pub struct NowPlayingPayload {
        pub title: String,
        pub artist: String,
        pub playing: bool,
        /// Vollstaendiger Pfad zur Cover-Datei, leer wenn es keine gibt.
        /// Android baut daraus sowohl das Bild in der Benachrichtigung als
        /// auch den Hintergrund des Players in den Schnelleinstellungen.
        pub cover: String,
        /// Beides in Millisekunden. Ohne die zeigt der System-Player keine
        /// Fortschrittsleiste, sondern nur den Titel.
        pub position_ms: i64,
        pub duration_ms: i64,
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

/// Sucht das Cover, das neben dem Track liegt. Zwei Schreibweisen, weil
/// sie aus zwei Quellen stammen: "<track>.cover_cache.jpg" schreibt
/// read_track_meta aus einem eingebetteten ID3-Bild, "<track>.jpg" legt
/// der Downloader direkt daneben (siehe commands.rs).
#[cfg(target_os = "android")]
fn cover_pfad(app: &tauri::AppHandle, playlist: &str, file: &str) -> String {
    use tauri::Manager;
    let Some(state) = app.try_state::<crate::commands::AppState>() else {
        return String::new();
    };
    let rel = format!(
        "{}/{}",
        crate::commands::safe_filename(playlist),
        crate::commands::safe_filename(file)
    );
    let Ok(track) = crate::commands::safe_join(&state.music_root, &rel) else {
        return String::new();
    };
    for kandidat in [
        track.with_extension("cover_cache.jpg"),
        track.with_extension("jpg"),
    ] {
        if kandidat.is_file() {
            return kandidat.to_string_lossy().to_string();
        }
    }
    String::new()
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn update_now_playing(
    app: tauri::AppHandle,
    title: String,
    artist: String,
    playing: bool,
    playlist: Option<String>,
    file: Option<String>,
    position_ms: Option<i64>,
    duration_ms: Option<i64>,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        use tauri::Manager;
        let cover = match (playlist.as_deref(), file.as_deref()) {
            (Some(p), Some(f)) => cover_pfad(&app, p, f),
            _ => String::new(),
        };
        let state = app.state::<android::NowPlaying>();
        state
            .0
            .run_mobile_plugin::<()>(
                "updateNowPlaying",
                android::NowPlayingPayload {
                    title,
                    artist,
                    playing,
                    cover,
                    position_ms: position_ms.unwrap_or(0),
                    duration_ms: duration_ms.unwrap_or(0),
                },
            )
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, title, artist, playing, playlist, file, position_ms, duration_ms);
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
            .run_mobile_plugin::<()>("clearNowPlaying", android::Empty {})
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
    }
    Ok(())
}
