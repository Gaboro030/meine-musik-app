/* ===== Playlist-Export als M3U / CSV =====
   App-native Zusatzfunktion ohne Flask-Vorbild (wie Handy-Sync in sync.js)
   - nutzt die Tauri-Dialog-/FS-Plugins direkt statt über tauri-shim.js zu
   gehen, deshalb eigene Datei statt player.js anzufassen. Rust liefert nur
   den fertigen Text (export_playlist_m3u/export_playlist_csv in
   commands.rs, ueber die /api/library/playlist/<name>/export-m3u bzw.
   -export-csv-Shim-Pfade) - das eigentliche Speichern (Zielordner waehlen,
   Datei schreiben) passiert hier mit den JS-Plugin-APIs, weil das Rust-
   Kommando dafuer beliebige externe Pfade beschreiben muesste.

   CSV statt M3U: kein eigener/direkter Player-Import, sondern gedacht fuer
   Drittanbieter-Transfer-Tools (SoundIiiz, TuneMyMusic, FreeYourMusic), die
   eine CSV-Playlist nach Spotify/YouTube Music hochladen koennen - ein
   direkter Push in deren APIs braeuchte eine eigene registrierte/
   genehmigte OAuth-App, die es hier nicht gibt. */
(function () {
  "use strict";
  if (!window.__TAURI__) return;

  async function exportPlaylistAs(btn, routeSuffix, extension, filterName, label) {
    if (typeof currentPlaylist === "undefined" || !currentPlaylist) return;
    const name = currentPlaylist.name;
    btn.disabled = true;
    try {
      const res = await fetch(`/api/library/playlist/${encodeURIComponent(name)}/${routeSuffix}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Export fehlgeschlagen.");

      const safeName = name.replace(/[\\/:*?"<>|]/g, "_");
      const path = await window.__TAURI__.dialog.save({
        defaultPath: `${safeName}.${extension}`,
        filters: [{ name: filterName, extensions: [extension] }],
      });
      if (!path) return; // Nutzer hat abgebrochen

      await window.__TAURI__.fs.writeTextFile(path, data.content);
      if (typeof showToast === "function") showToast(`📤 „${name}" ${label}`);
    } catch (err) {
      if (typeof showToast === "function") showToast(String(err && err.message ? err.message : err));
    } finally {
      btn.disabled = false;
    }
  }

  const exportBtn = document.getElementById("exportPlaylistBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () =>
      exportPlaylistAs(exportBtn, "export-m3u", "m3u", "M3U-Playlist", "als M3U exportiert")
    );
  }

  const exportCsvBtn = document.getElementById("exportPlaylistCsvBtn");
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", () =>
      exportPlaylistAs(exportCsvBtn, "export-csv", "csv", "CSV-Playlist", "als CSV exportiert")
    );
  }
})();
