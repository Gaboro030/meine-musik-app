/* ===== Playlist-Export als M3U =====
   App-native Zusatzfunktion ohne Flask-Vorbild (wie Handy-Sync in sync.js)
   - nutzt die Tauri-Dialog-/FS-Plugins direkt statt über tauri-shim.js zu
   gehen, deshalb eigene Datei statt player.js anzufassen. Rust liefert nur
   den fertigen M3U-Text (export_playlist_m3u in commands.rs, ueber den
   /api/library/playlist/<name>/export-m3u-Shim-Pfad) - das eigentliche
   Speichern (Zielordner waehlen, Datei schreiben) passiert hier mit den
   JS-Plugin-APIs, weil das Rust-Kommando dafuer beliebige externe Pfade
   beschreiben muesste. */
(function () {
  "use strict";
  if (!window.__TAURI__) return;
  const exportBtn = document.getElementById("exportPlaylistBtn");
  if (!exportBtn) return;

  exportBtn.addEventListener("click", async () => {
    if (typeof currentPlaylist === "undefined" || !currentPlaylist) return;
    const name = currentPlaylist.name;
    exportBtn.disabled = true;
    try {
      const res = await fetch(`/api/library/playlist/${encodeURIComponent(name)}/export-m3u`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Export fehlgeschlagen.");

      const safeName = name.replace(/[\\/:*?"<>|]/g, "_");
      const path = await window.__TAURI__.dialog.save({
        defaultPath: `${safeName}.m3u`,
        filters: [{ name: "M3U-Playlist", extensions: ["m3u"] }],
      });
      if (!path) return; // Nutzer hat abgebrochen

      await window.__TAURI__.fs.writeTextFile(path, data.content);
      if (typeof showToast === "function") showToast(`📤 „${name}" als M3U exportiert`);
    } catch (err) {
      if (typeof showToast === "function") showToast(String(err && err.message ? err.message : err));
    } finally {
      exportBtn.disabled = false;
    }
  });
})();
