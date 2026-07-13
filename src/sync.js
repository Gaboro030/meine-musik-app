/* ===== Handy-Sync =====
   Peer-to-peer library sync between devices on the same WiFi (PC<->Handy,
   either direction) - separate from Party Mode, which mirrors playback
   rather than moving files. Discovery is a small UDP broadcast beacon
   (sync.rs); the actual transfer rides on the same embedded HTTP server
   Party Mode already runs at all times (POST /sync/receive), one file per
   request. This is an app-native addition (no equivalent in the old Flask
   frontend), so it lives in its own file instead of touching player.js. */
(function () {
  "use strict";
  const { invoke } = window.__TAURI__.core;
  const { listen } = window.__TAURI__.event;

  const toggleBtn = document.getElementById("syncToggleBtn");
  const popover = document.getElementById("syncPopover");
  const statusText = document.getElementById("syncStatusText");
  const modeBtn = document.getElementById("syncModeBtn");
  const peerListEl = document.getElementById("syncPeerList");

  const modal = document.getElementById("syncModal");
  const modalClose = document.getElementById("syncModalClose");
  const modalCancel = document.getElementById("syncModalCancel");
  const targetNameEl = document.getElementById("syncTargetName");
  const selectAll = document.getElementById("syncSelectAll");
  const playlistListEl = document.getElementById("syncPlaylistList");
  const progressWrap = document.getElementById("syncProgressWrap");
  const progressBar = document.getElementById("syncProgressBar");
  const progressLabel = document.getElementById("syncProgressLabel");
  const sendBtn = document.getElementById("syncSendBtn");

  if (!toggleBtn || !modal) return;

  let syncOn = false;
  let currentPeer = null;
  let pollTimer = null;

  function showToast(message) {
    let toast = document.getElementById("syncToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "syncToast";
      toast.className = "player-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.remove("show");
    void toast.offsetWidth;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function renderPeers(peers) {
    peerListEl.innerHTML = "";
    if (!syncOn) return;
    if (!peers.length) {
      peerListEl.innerHTML = '<div class="sync-peer-empty">Suche Geräte …</div>';
      return;
    }
    for (const p of peers) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sync-peer-item";
      btn.textContent = `📱 ${p.name}`;
      btn.addEventListener("click", () => {
        popover.classList.add("hidden");
        openSendModal(p);
      });
      peerListEl.appendChild(btn);
    }
  }

  async function refreshPeers() {
    if (!syncOn) return;
    try {
      renderPeers(await invoke("sync_list_peers"));
    } catch (_) {}
  }

  async function toggleSync() {
    syncOn = !syncOn;
    if (syncOn) {
      modeBtn.textContent = "Sync-Modus beenden";
      modeBtn.classList.add("active");
      statusText.textContent = "Sichtbar für andere Geräte im WLAN - Liste aktualisiert sich automatisch.";
      try {
        await invoke("sync_start");
      } catch (_) {}
      refreshPeers();
      pollTimer = setInterval(refreshPeers, 3000);
    } else {
      modeBtn.textContent = "Sync-Modus starten";
      modeBtn.classList.remove("active");
      statusText.textContent = "Findet andere Geräte im selben WLAN, auf denen der Sync-Modus offen ist.";
      try {
        await invoke("sync_stop");
      } catch (_) {}
      clearInterval(pollTimer);
      pollTimer = null;
      peerListEl.innerHTML = "";
    }
  }

  modeBtn.addEventListener("click", toggleSync);
  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    popover.classList.toggle("hidden");
  });
  document.addEventListener("click", (e) => {
    if (!popover.contains(e.target) && e.target !== toggleBtn) popover.classList.add("hidden");
  });

  async function openSendModal(peer) {
    currentPeer = peer;
    targetNameEl.textContent = peer.name;
    progressWrap.classList.add("hidden");
    sendBtn.disabled = false;
    sendBtn.textContent = "Senden";
    playlistListEl.innerHTML = '<div class="sync-peer-empty">Lade Playlists …</div>';
    modal.classList.remove("hidden");
    try {
      const data = await invoke("list_playlists");
      playlistListEl.innerHTML = "";
      if (!data.length) {
        playlistListEl.innerHTML = '<div class="sync-peer-empty">Keine Playlists in der Bibliothek.</div>';
        return;
      }
      for (const pl of data) {
        const row = document.createElement("label");
        row.className = "sync-playlist-row";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = true;
        cb.dataset.name = pl.name;
        const span = document.createElement("span");
        span.textContent = `${pl.name} (${pl.tracks.length})`;
        row.append(cb, span);
        playlistListEl.appendChild(row);
      }
    } catch (err) {
      playlistListEl.innerHTML = `<div class="sync-peer-empty">${String(err)}</div>`;
    }
  }

  function closeModal() {
    modal.classList.add("hidden");
    currentPeer = null;
  }
  modalClose.addEventListener("click", closeModal);
  modalCancel.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  selectAll.addEventListener("change", () => {
    playlistListEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => { cb.checked = selectAll.checked; });
  });

  sendBtn.addEventListener("click", async () => {
    if (!currentPeer) return;
    const names = [...playlistListEl.querySelectorAll('input[type="checkbox"]:checked')].map((cb) => cb.dataset.name);
    if (!names.length) {
      showToast("Bitte mindestens eine Playlist auswählen.");
      return;
    }
    sendBtn.disabled = true;
    sendBtn.textContent = "Wird gesendet …";
    progressWrap.classList.remove("hidden");
    progressBar.style.width = "0%";
    progressLabel.textContent = "Vorbereitung …";

    const taskId = `sync${Date.now()}`;
    const unlisten = await listen(`sync-progress-${taskId}`, (e) => {
      const { done, total } = e.payload;
      const pct = total ? (done / total) * 100 : 0;
      progressBar.style.width = `${pct}%`;
      progressLabel.textContent = `${done} / ${total}`;
    });

    try {
      const result = await invoke("sync_send_playlists", {
        taskId,
        peerIp: currentPeer.ip,
        peerPort: currentPeer.port,
        playlistNames: names,
      });
      if (result.failed && result.failed.length) {
        // Show the actual reason (e.g. "Nicht erreichbar: ..." vs "HTTP
        // 400") instead of just a count - if every file fails the same
        // way, this is the one piece of information that tells us why.
        showToast(`${result.sent} gesendet, ${result.failed.length} fehlgeschlagen: ${result.failed[0]}`);
      } else {
        showToast(`${result.sent} Dateien an ${currentPeer.name} gesendet!`);
      }
      sendBtn.textContent = "Fertig ✓";
      setTimeout(closeModal, 1200);
    } catch (err) {
      showToast(String(err));
      sendBtn.disabled = false;
      sendBtn.textContent = "Senden";
    } finally {
      unlisten();
    }
  });

  listen("sync-peers-changed", refreshPeers);
})();
