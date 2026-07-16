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

  // Android's PoToken (BotGuard) generation runs in the background from
  // page load (potoken-init.js) and takes a couple seconds - awaited here
  // before any call that actually hits YouTube's Innertube API, so the
  // very first search/discover/download of a session doesn't race it and
  // lose. No-op on desktop / once ready (already-resolved promise).
  function awaitPoToken(timeoutMs = 6000) {
    const ready = window.__poTokenReady;
    if (!ready) return Promise.resolve();
    return Promise.race([ready, new Promise((r) => setTimeout(r, timeoutMs))]);
  }

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
        await awaitPoToken();
        return jsonResponse({ rows: await invoke("discover_rows", { excludeIds: csv(q.get("exclude")) }) });
      }
      if (parts[2] === "discover") {
        await awaitPoToken();
        return jsonResponse({ recommendations: await invoke("discover_tracks", { excludeIds: csv(q.get("exclude")) }) });
      }
      if (parts[2] === "search-online") {
        await awaitPoToken();
        return jsonResponse({ results: await invoke("search_online", { query: q.get("q") || "" }) });
      }
      if (parts[2] === "download" && method === "POST") {
        await awaitPoToken();
        const b = jsonBody();
        const playlist = b.playlist || "Entdeckt";
        await invoke("download_track", { videoId: b.id, playlistName: playlist, title: b.title || "Song", uploader: b.uploader || "" });
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
    // get_lyrics_cached reads a <file>.lyrics.json sidecar next to the
    // track first (playlist/file identify it) - zero network once a
    // song's lyrics have ever been looked up (playback prefetch or a
    // previous open), only falling back to the live lrclib/lyrics.ovh
    // lookup fetch_lyrics does on a genuine cache miss.
    if (parts[1] === "lyrics") {
      const durRaw = q.get("duration");
      const data = await invoke("get_lyrics_cached", {
        playlist: q.get("playlist") || "",
        file: q.get("file") || "",
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
        await awaitPoToken();
        await invoke("download_track", {
          videoId: b.video_id,
          playlistName: b.target_playlist,
          title: b.title || "Song",
          uploader: b.uploader || "",
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

    // --- party / queue: shared Hub in Rust, mirrored to guests over the
    // embedded LAN server (see party.rs) --------------------------------------
    if (parts[1] === "queue") {
      if (parts.length === 2 && method === "GET") {
        return jsonResponse({ queue: await invoke("queue_list") });
      }
      if (method === "DELETE") {
        return jsonResponse({ ok: await invoke("queue_remove", { entryId: seg(parts[2] || "") }) });
      }
      return jsonResponse({ error: "Nicht verfügbar." }, 404);
    }
    if (parts[1] === "party") {
      if (method === "POST") {
        await invoke("party_set_state", { state: jsonBody() });
        return jsonResponse({ ok: true });
      }
      return jsonResponse(await invoke("party_get_state"));
    }
    if (parts[1] === "hotkey") return jsonResponse({ ok: true });

    // --- settings --------------------------------------------------------
    if (parts[1] === "settings") {
      if (parts[2] === "version") {
        return jsonResponse({ version: await invoke("get_app_version") });
      }
      if (parts[2] === "clear-lyrics-cache" && method === "POST") {
        return jsonResponse({ removed: await invoke("clear_lyrics_cache") });
      }
    }

    return jsonResponse({ error: "Nicht verfügbar." }, 404);
  }

  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    if (!url.startsWith("/api/")) return realFetch(input, init);
    return route(url, init).catch((err) => jsonResponse({ error: String(err) }, 500));
  };

  // player.js opens EventSource("/api/events") for the realtime bus (guest
  // queue adds + party sync). Here the bus is Tauri's own event system:
  // party.rs re-emits everything it broadcasts to guests as `party-<name>`
  // events, so this fake EventSource just maps listener names onto those.
  const RealEventSource = window.EventSource;
  window.EventSource = function (url, opts) {
    if (String(url).includes("/api/events")) {
      const unlisteners = [];
      let closed = false;
      return {
        addEventListener(name, cb) {
          window.__TAURI__.event
            .listen(`party-${name}`, (e) => cb({ data: JSON.stringify(e.payload) }))
            .then((un) => {
              if (closed) un();
              else unlisteners.push(un);
            });
        },
        removeEventListener() {},
        close() {
          closed = true;
          unlisteners.forEach((un) => un());
          unlisteners.length = 0;
        },
        readyState: 1,
      };
    }
    return new RealEventSource(url, opts);
  };

  document.addEventListener("DOMContentLoaded", () => {
    // QR code: party.rs runs an embedded LAN server; party_info returns the
    // guest URL plus a ready-made SVG QR code as data: URI. player.js
    // re-sets src to /api/qr every time the popover opens - that path 404s
    // in the webview, so the error handler swaps the real QR back in.
    const qrImage = document.getElementById("qrImage");
    const qrHint = document.getElementById("qrHint");
    if (qrImage) {
      let qrDataUri =
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' +
            '<rect width="200" height="200" fill="#f0f0f0"/>' +
            '<text x="50%" y="54%" font-size="60" text-anchor="middle" dominant-baseline="middle">🎉</text>' +
            "</svg>"
        );
      const refreshQr = () => {
        invoke("party_info")
          .then((info) => {
            qrDataUri = info.qr;
            qrImage.src = info.qr;
            if (qrHint) {
              qrHint.textContent = `Mit dem Handy scannen oder ${info.url} öffnen – gleiches WLAN nötig.`;
            }
          })
          .catch(() => {});
      };
      qrImage.src = qrDataUri;
      qrImage.addEventListener("error", () => {
        qrImage.src = qrDataUri;
        refreshQr(); // LAN-IP kann sich ändern (WLAN-Wechsel) - frisch holen
      });
      refreshQr();

      // Guest-Link zum Antippen kopieren.
      if (qrHint) {
        qrHint.style.cursor = "pointer";
        qrHint.title = "Klicken zum Kopieren";
        qrHint.addEventListener("click", () => {
          const m = qrHint.textContent.match(/https?:\/\/\S+/);
          if (m && navigator.clipboard) {
            navigator.clipboard.writeText(m[0]).then(() => {
              const prev = qrHint.textContent;
              qrHint.textContent = "✓ Link kopiert!";
              setTimeout(() => { qrHint.textContent = prev; }, 1200);
            }).catch(() => {});
          }
        });
      }

      // Internet-Link: cloudflared quick tunnel - Freunde können auch OHNE
      // gleiches WLAN beitreten. Button wird ins QR-Popover injiziert.
      const qrPopover = document.getElementById("qrPopover");
      if (qrPopover) {
        const netBtn = document.createElement("button");
        netBtn.type = "button";
        netBtn.id = "internetLinkBtn";
        netBtn.className = "party-toggle-switch internet-link-btn";
        netBtn.textContent = "🌍 Internet-Link erstellen";
        let internetOn = false;
        let busy = false;
        netBtn.addEventListener("click", async () => {
          if (busy) return;
          busy = true;
          netBtn.disabled = true;
          netBtn.textContent = internetOn ? "Wird beendet …" : "Wird erstellt … (ca. 5 Sek.)";
          try {
            const res = await invoke("party_internet", { enable: !internetOn });
            internetOn = !!res.public_url;
            netBtn.textContent = internetOn ? "🌍 Internet-Link beenden" : "🌍 Internet-Link erstellen";
            netBtn.classList.toggle("active", internetOn);
            refreshQr();
          } catch (err) {
            netBtn.textContent = "🌍 Internet-Link erstellen";
            if (qrHint) qrHint.textContent = String(err);
          } finally {
            busy = false;
            netBtn.disabled = false;
          }
        });
        qrPopover.appendChild(netBtn);
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

    // Full song name on hover (user-requested addition): every truncated
    // title/artist label gets its complete text as a native tooltip.
    // Delegated, so it also covers cards/rows rendered later.
    const TRUNCATED = ".card-title, .card-sub, .track-title, .track-artist, .pb-title, .pb-artist";
    document.addEventListener("mouseover", (e) => {
      const el = e.target instanceof Element ? e.target.closest(TRUNCATED) : null;
      if (el && !el.title && el.textContent) el.title = el.textContent;
    });
  });
})();
