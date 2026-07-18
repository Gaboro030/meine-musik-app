mod backup;
mod commands;
mod discovery;
mod duplicates;
mod hotkeys;
mod innertube;
mod lyrics;
mod nowplaying;
mod party;
mod playlist;
mod sync;
mod trash;

use std::fs;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init());

    // Global (system-wide) hotkeys - desktop only, see hotkeys.rs. One
    // shared handler for every registered shortcut: looks up which
    // action it maps to via hotkeys::ACTIVE and relays that to the
    // frontend as a "global-hotkey" event.
    #[cfg(desktop)]
    {
        use tauri::Emitter;
        builder = builder.plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    match event.state() {
                        tauri_plugin_global_shortcut::ShortcutState::Pressed => {
                            if let Ok(table) = hotkeys::ACTIVE.lock() {
                                if let Some((_, id)) = table.iter().find(|(s, _)| s == shortcut) {
                                    let _ = app.emit("global-hotkey", id.clone());
                                }
                            }
                        }
                        _ => {}
                    }
                })
                .build(),
        );
    }

    // Spotify/YT-Music-Style Wiedergabe-Notification - Android-only, siehe
    // nowplaying.rs. Startet den PlaybackService-Foreground-Service, der
    // die Android-WebView sonst beim Minimieren stummschaltende
    // Hintergrund-Pausierung umgeht.
    #[cfg(target_os = "android")]
    {
        builder = builder.plugin(nowplaying::android::init());
    }

    builder
        .setup(|app| {
            let handle = app.handle();

            let root = handle
                .path()
                .audio_dir()
                .unwrap_or_else(|_| handle.path().app_data_dir().unwrap())
                .join("MeineMusik");
            fs::create_dir_all(&root).ok();

            let data_dir = handle.path().app_data_dir().unwrap();
            let trash_dir = data_dir.join("trash");
            fs::create_dir_all(&trash_dir).ok();

            app.manage(commands::AppState {
                music_root: root.clone(),
                trash_dir,
                trash_index_file: data_dir.join("trash_index.json"),
            });

            // Party mode: shared hub (queue + party state + event bus) and
            // the embedded LAN server guests connect to via the QR code.
            let hub = party::Hub::new(root);
            hub.set_app(handle.clone());
            app.manage(hub.clone());
            tauri::async_runtime::spawn(party::run_server(hub));

            // Handy-Sync: discovery/transfer state, off until the user opens
            // the Sync panel and starts it.
            app.manage(sync::SyncState::new());
            Ok(())
        })
        .register_asynchronous_uri_scheme_protocol("stream", |ctx, request, responder| {
            let state = ctx.app_handle().state::<commands::AppState>();
            let root = state.music_root.clone();
            let range_header = request
                .headers()
                .get("range")
                .and_then(|v| v.to_str().ok())
                .map(str::to_string);
            let rel = request.uri().path().trim_start_matches('/').to_string();
            tauri::async_runtime::spawn(async move {
                let resp = commands::stream_file(&root, &rel, range_header).await;
                responder.respond(resp);
            });
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_playlists,
            commands::create_playlist,
            commands::rename_playlist,
            commands::delete_playlist,
            commands::add_track_to_playlist,
            commands::remove_track_from_playlist,
            commands::upload_track,
            commands::fetch_thumbnail,
            commands::download_track,
            commands::download_track_progress,
            commands::clear_lyrics_cache,
            commands::get_app_version,
            playlist::resolve_playlist,
            trash::list_trash,
            trash::restore_trash,
            trash::delete_trash_forever,
            lyrics::fetch_lyrics,
            lyrics::get_lyrics_cached,
            discovery::discover_tracks,
            discovery::discover_rows,
            discovery::recommend_for_playlist,
            discovery::search_online,
            party::party_info,
            party::party_internet,
            party::party_get_state,
            party::party_set_state,
            party::party_participants,
            party::party_remove_participant,
            commands::export_playlist_m3u,
            duplicates::find_duplicates,
            backup::export_library_zip,
            backup::import_library_zip,
            party::queue_list,
            party::queue_remove,
            party::party_chat_list,
            party::party_chat_send,
            innertube::set_po_token,
            innertube::set_po_token_error,
            innertube::bg_fetch,
            sync::sync_start,
            sync::sync_stop,
            sync::sync_list_peers,
            sync::sync_send_playlists,
            hotkeys::set_global_hotkeys,
            nowplaying::update_now_playing,
            nowplaying::clear_now_playing,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            // cloudflared läuft als eigener Prozess - ohne expliziten Kill
            // würde der Tunnel das App-Ende überleben.
            if let tauri::RunEvent::Exit = event {
                if let Some(hub) = app_handle.try_state::<party::Hub>() {
                    hub.shutdown();
                }
            }
        });
}
