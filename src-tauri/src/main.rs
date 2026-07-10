#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use std::fs;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle();

            // Desktop -> user's real Music folder; Android/iOS -> app-private
            // data dir (no public "Music" concept, and no storage permission
            // dance needed for a private single-user app).
            let root = handle
                .path()
                .audio_dir()
                .unwrap_or_else(|_| handle.path().app_data_dir().unwrap())
                .join("MeineMusik");
            fs::create_dir_all(&root).ok();

            let data_dir = handle.path().app_data_dir().unwrap();
            fs::create_dir_all(&data_dir).ok();

            app.manage(commands::AppState {
                music_root: root,
                playlists_file: data_dir.join("playlists.json"),
            });
            Ok(())
        })
        // stream://<playlist>/<file>.mp3 - byte-range aware audio streaming,
        // the native replacement for Flask's /api/library/stream/<pl>/<file>.
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
            commands::add_track_to_playlist,
            commands::remove_track_from_playlist,
            commands::fetch_thumbnail,
            commands::download_track,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
