/* ===== Tauri API shim =====
   player.js is the ORIGINAL Flask frontend, copied verbatim - it talks to
   REST endpoints like /api/library via fetch(). There is no Flask server
   in the Tauri app, so this shim (loaded BEFORE player.js) intercepts
   fetch() for every /api/* path and translates it 1:1 into the matching
   Rust #[tauri::command] invoke() call, returning a Response-shaped
   object. That way the original player.js needs zero modifications - the
   whole UI stays byte-identical to the old app.

   Not-yet-ported endpoints (party mode / guest queue / QR - they need an
   embedded LAN server, planned next) get harmless stubs so the original
   code paths don't error out. */
(function () {
  "use strict";

  const { invoke } = window.__TAURI__.core;
  const realFetch = window.fetch.bind(window);

  function jsonResponse(data, status = 200) {
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => null },
      json: async () => data,
      text: async () => JSON.stringify(data),
    };
  }

  const csv = (s) => (s || "").split(",").map((x) => x.trim()).filter(Boolean);
  const seg = (p) => decodeURIComponent(p);

  async function route(url, init) {
    const u = new URL(url, "http://tauri.local");
    const parts = u.pathname.split("/").filter(Boolean); // ["api", ...]
    const q = u.searchParams;
    const method = ((init && init.method) || "GET").toUpperCase();
    const body = init && init.body;
    const jsonBody = () => (typeof body === "string" ? JSON.parse(body) : {});

    // --- library -----------------------------------------------------------
    if (parts[1] === "library") {
      if (parts.length === 2) {
        return jsonResponse({ playlists: await invoke("list_playlists") });
      }
      if (parts[2] === "recommendations") {
        const recommendations = await invoke("recommend_for_playlist", {
          playlistName: q.get("playlist") || "",
          excludeIds: csv(q.get("exclude")),
        });
        return jsonResponse({ recommendations });
      }
      if (parts[2] === "discover-rows") {
        return jsonResponse({ rows: await invoke("discover_rows", { excludeIds: csv(q.get("exclude")) }) });
      }
      if (parts[2] === "discover") {
        return jsonResponse({ recommendations: await invoke("discover_tracks", { excludeIds: csv(q.get("exclude")) }) });
      }
      if (parts[2] === "search-online") {
        return jsonResponse({ results: await invoke("search_online", { query: q.get("q") || "" }) });
      }
      if (parts[2] === "download" && method === "POST") {
        const b = jsonBody();
        const playlist = b.playlist || "Entdeckt";
        await invoke("download_track", { videoId: b.id, playlistName: playlist, title: b.title || "Song" });
        return jsonResponse({ ok: true, playlist });
      }
      if (parts[2] === "upload" && method === "POST" && body instanceof FormData) {
        const playlist = String(body.get("playlist") || "Neue Playlist");
        const files = body.getAll("files");
        let saved = 0;
        let skipped = 0;
        for (const f of files) {
          try {
            const buf = await f.arrayBuffer();
            await invoke("upload_track", {
              playlistName: playlist,
              filename: f.name,
              data: Array.from(new Uint8Array(buf)),
            });
            saved++;
          } catch (_) {
            skipped++;
          }
        }
        return jsonResponse({ ok: true, playlist, saved, skipped });
      }
      if (parts[2] === "playlist") {
        const name = seg(parts[3] || "");
        if (parts[4] === "rename" && method === "POST") {
          const b = jsonBody();
          await invoke("rename_playlist", { oldName: name, newName: b.new_name });
          return jsonResponse({ ok: true, name: b.new_name });
        }
        if (method === "DELETE") {
          await invoke("delete_playlist", { name });
          return jsonResponse({ ok: true });
        }
      }
      if (parts[2] === "track" && method === "DELETE") {
        await invoke("remove_track_from_playlist", {
          playlistName: seg(parts[3] || ""),
          filename: seg(parts[4] || ""),
        });
        return jsonResponse({ ok: true });
      }
    }

    // --- trash ---------------------------------------------------------------
    if (parts[1] === "trash") {
      if (parts.length === 2) {
        return jsonResponse({ trash: await invoke("list_trash") });
      }
      if (parts[3] === "restore" && method === "POST") {
        await invoke("restore_trash", { trashId: parts[2] });
        return jsonResponse({ ok: true });
      }
      if (method === "DELETE") {
        await invoke("delete_trash_forever", { trashId: parts[2] });
        return jsonResponse({ ok: true });
      }
    }

    // --- lyrics --------------------------------------------------------------
    if (parts[1] === "lyrics") {
      const durRaw = q.get("duration");
      const data = await invoke("fetch_lyrics", {
        title: q.get("title") || "",
        artist: q.get("artist") || "",
        duration: durRaw ? Number(durRaw) : null,
      });
      return jsonResponse(data);
    }

    // --- add-track -----------------------------------------------------------
    if (parts[1] === "playlists" && parts[2] === "add-track" && method === "POST") {
      const b = jsonBody();
      if (b.video_id) {
        await invoke("download_track", {
          videoId: b.video_id,
          playlistName: b.target_playlist,
          title: b.title || "Song",
        });
      } else {
        await invoke("add_track_to_playlist", {
          sourcePlaylist: b.source_playlist,
          filename: b.filename,
          targetPlaylist: b.target_playlist,
        });
      }
      return jsonResponse({ ok: true, playlist: b.target_playlist });
    }

    // --- party / queue / hotkey: stubs until the embedded LAN server exists ---
    if (parts[1] === "queue") {
      if (parts.length === 2 && method === "GET") return jsonResponse({ queue: [] });
      if (method === "DELETE") return jsonResponse({ ok: true });
      return jsonResponse({ error: "Party-Modus folgt in einem späteren Update." }, 501);
    }
    if (parts[1] === "party") {
      if (method === "GET") return jsonResponse({ active: false, playing: false, position: 0 });
      return jsonResponse({ ok: true });
    }
    if (parts[1] === "hotkey") return jsonResponse({ ok: true });

    return jsonResponse({ error: "Nicht verfügbar." }, 404);
  }

  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    if (!url.startsWith("/api/")) return realFetch(input, init);
    return route(url, init).catch((err) => jsonResponse({ error: String(err) }, 500));
  };

  // player.js opens EventSource("/api/events") for the realtime bus (guest
  // queue + party sync). No server behind it here - hand back an inert
  // object instead of letting a real EventSource retry-loop 404s forever.
  const RealEventSource = window.EventSource;
  window.EventSource = function (url, opts) {
    if (String(url).includes("/api/events")) {
      return { addEventListener() {}, removeEventListener() {}, close() {}, readyState: 2 };
    }
    return new RealEventSource(url, opts);
  };

  document.addEventListener("DOMContentLoaded", () => {
    // QR code needs the LAN guest server (not ported yet) - placeholder
    // instead of a broken-image icon.
    const qrImage = document.getElementById("qrImage");
    const qrHint = document.getElementById("qrHint");
    if (qrImage) {
      const placeholder =
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' +
            '<rect width="200" height="200" fill="#f0f0f0"/>' +
            '<text x="50%" y="54%" font-size="60" text-anchor="middle" dominant-baseline="middle">🎉</text>' +
            "</svg>"
        );
      qrImage.src = placeholder;
      // player.js re-sets src to /api/qr every time the popover opens -
      // that 404s here, so swap the placeholder back in on load failure.
      qrImage.addEventListener("error", () => {
        qrImage.src = placeholder;
      });
    }
    if (qrHint) qrHint.textContent = "Party-Modus & QR folgen in einem späteren Update.";

    // The old app's /downloader page doesn't exist in the native app -
    // its links now open a quick YouTube-download dialog instead.
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest('a[href="/downloader"]');
      if (!a) return;
      e.preventDefault();
      promptYoutubeDownload();
    });

    async function promptYoutubeDownload() {
      const toast = window.showToast || ((m) => alert(m));
      const raw = window.prompt("YouTube-Link oder Video-ID:");
      if (!raw) return;
      const m = raw.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{6,20})/) || raw.match(/^([\w-]{6,20})$/);
      if (!m) {
        toast("Konnte keine Video-ID erkennen.");
        return;
      }
      const title = window.prompt("Titel für die Datei:", "Song") || "Song";
      const playlist = window.prompt("In welche Playlist? (neue oder bestehende)", "Meins") || "Meins";
      toast("⏳ Lade von YouTube …");
      try {
        await invoke("download_track", { videoId: m[1], playlistName: playlist, title });
        toast(`⬇ „${title}" zu „${playlist}" hinzugefügt`);
        if (window.refreshLibrary) await window.refreshLibrary();
      } catch (err) {
        toast(String(err) || "Download fehlgeschlagen.");
      }
    }

    // Live volume percentage (user-requested addition on top of the 1:1
    // port): audioEl fires "volumechange" whenever player.js sets .volume.
    const audioEl = document.getElementById("audioEl");
    const volPercent = document.getElementById("pbVolumePercent");
    if (audioEl && volPercent) {
      const update = () => {
        volPercent.textContent = `${Math.round(audioEl.volume * 100)}%`;
      };
      audioEl.addEventListener("volumechange", update);
      update();
    }
  });
})();
