fn main() {
    // "now-playing" ist ein Plugin direkt in der App (nowplaying.rs), ohne
    // eigene Rechte-Datei. Tauri prueft aber JEDEN "plugin:..."-Aufruf aus
    // der Seite gegen die Capabilities - auch addPluginListener, das intern
    // plugin:now-playing|registerListener aufruft. Ohne diese Freigabe wurde
    // das abgelehnt, und die Tasten im Sperrbildschirm/der Benachrichtigung
    // liefen ins Leere (der Fehler ging im .catch() unter). Beide
    // Schreibweisen, weil die JS-Seite erst snake_case versucht und das
    // Kotlin-Plugin nur camelCase kennt.
    tauri_build::try_build(
        tauri_build::Attributes::new().plugin(
            "now-playing",
            tauri_build::InlinedPlugin::new()
                .commands(&[
                    "register_listener",
                    "registerListener",
                    "remove_listener",
                    "removeListener",
                    // Android Auto: Bibliothek an PlaybackService.kt
                    "set_auto_library",
                ])
                .default_permission(tauri_build::DefaultPermissionRule::AllowAllCommands),
        ),
    )
    .expect("failed to run tauri-build");
}
