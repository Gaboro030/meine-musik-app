/* ===== Geräte-Sync =====
   Playlists von Gerät zu Gerät schieben (PC<->Handy, beide Richtungen) -
   nicht zu verwechseln mit dem Party-Modus, der Wiedergabe spiegelt statt
   Dateien zu bewegen. Die Übertragung reitet auf dem HTTP-Server, den der
   Party-Modus ohnehin dauerhaft laufen lässt (POST /sync/receive), eine
   Datei pro Anfrage. App-eigene Ergänzung ohne Vorbild im alten
   Flask-Frontend, deshalb eine eigene Datei statt player.js.

   Zwei Wege zum Gegenüber (Details siehe sync.rs):
   - Gleiches WLAN: UDP-Broadcast, die Geräte finden sich von allein.
   - Sonst: das EMPFANGENDE Gerät erzeugt einen Code (QR zum Scannen plus
     Text zum Tippen, weil ein Freund am eigenen PC nicht scannen kann).
     Wer den Code einlöst, hat das Gerät danach in derselben Liste stehen
     wie einen WLAN-Nachbarn - ab da ist der Ablauf identisch. */
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
  const targetNameEl = document.getElementById("syncModalTitle");
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
    // Gekoppelte Geräte bleiben sichtbar, auch wenn der Sync-Modus (die
    // WLAN-Suche) aus ist - die hat der Nutzer bewusst per Code verbunden.
    const visible = syncOn ? peers : peers.filter((p) => p.paired);
    if (!visible.length) {
      if (syncOn) peerListEl.innerHTML = `<div class="sync-peer-empty">${t("Suche Geräte …")}</div>`;
      return;
    }
    for (const p of visible) {
      const row = document.createElement("div");
      row.className = "sync-peer-row";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sync-peer-item";
      btn.textContent = `${p.paired ? "🔗" : "📱"} ${p.name}`;
      btn.addEventListener("click", () => {
        popover.classList.add("hidden");
        openSendModal(p);
      });
      row.appendChild(btn);
      if (p.paired) {
        const off = document.createElement("button");
        off.type = "button";
        off.className = "sync-peer-unpair";
        off.textContent = "✕";
        off.title = t("Verbindung trennen");
        off.addEventListener("click", async (e) => {
          e.stopPropagation();
          try {
            await invoke("sync_unpair", { peerId: p.id });
          } catch (_) {}
          refreshPeers();
        });
        row.appendChild(off);
      }
      peerListEl.appendChild(row);
    }
  }

  async function refreshPeers() {
    try {
      renderPeers(await invoke("sync_list_peers"));
    } catch (_) {}
  }

  async function toggleSync() {
    syncOn = !syncOn;
    if (syncOn) {
      modeBtn.textContent = t("Sync-Modus beenden");
      modeBtn.classList.add("active");
      statusText.textContent = t("Sichtbar für andere Geräte im WLAN - Liste aktualisiert sich automatisch.");
      try {
        await invoke("sync_start");
      } catch (_) {}
      refreshPeers();
      pollTimer = setInterval(refreshPeers, 3000);
    } else {
      modeBtn.textContent = t("Sync-Modus starten");
      modeBtn.classList.remove("active");
      statusText.textContent = t("Findet andere Geräte im selben WLAN, auf denen der Sync-Modus offen ist.");
      try {
        await invoke("sync_stop");
      } catch (_) {}
      clearInterval(pollTimer);
      pollTimer = null;
      // Nicht einfach leeren: gekoppelte Geräte bleiben stehen.
      refreshPeers();
    }
  }

  modeBtn.addEventListener("click", toggleSync);

  // Settings -> "Handy-Sync beim Start aktivieren" (player.js persists the
  // toggle, sync.js just reads it once here) - skips having to open the
  // popover and press "Sync-Modus starten" manually every launch.
  if (localStorage.getItem("syncAutoStart") === "1") toggleSync();
  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    popover.classList.toggle("hidden");
  });
  document.addEventListener("click", (e) => {
    if (!popover.contains(e.target) && e.target !== toggleBtn) popover.classList.add("hidden");
  });

  async function openSendModal(peer) {
    currentPeer = peer;
    targetNameEl.textContent = t("An {device} senden", { device: peer.name });
    progressWrap.classList.add("hidden");
    sendBtn.disabled = false;
    sendBtn.textContent = t("Senden");
    playlistListEl.innerHTML = `<div class="sync-peer-empty">${t("Lade Playlists …")}</div>`;
    modal.classList.remove("hidden");
    try {
      const data = await invoke("list_playlists");
      playlistListEl.innerHTML = "";
      if (!data.length) {
        playlistListEl.innerHTML = `<div class="sync-peer-empty">${t("Keine Playlists in der Bibliothek.")}</div>`;
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
      showToast(t("Bitte mindestens eine Playlist auswählen."));
      return;
    }
    sendBtn.disabled = true;
    sendBtn.textContent = t("Wird gesendet …");
    progressWrap.classList.remove("hidden");
    progressBar.style.width = "0%";
    progressLabel.textContent = t("Vorbereitung …");

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
        peerId: currentPeer.id,
        playlistNames: names,
      });
      if (result.failed && result.failed.length) {
        // Show the actual reason (e.g. "Nicht erreichbar: ..." vs "HTTP
        // 400") instead of just a count - if every file fails the same
        // way, this is the one piece of information that tells us why.
        showToast(t("{sent} gesendet, {failed} fehlgeschlagen: {reason}", { sent: result.sent, failed: result.failed.length, reason: result.failed[0] }));
      } else {
        showToast(t("{count} Dateien an {peer} gesendet!", { count: result.sent, peer: currentPeer.name }));
      }
      sendBtn.textContent = t("Fertig ✓");
      setTimeout(closeModal, 1200);
    } catch (err) {
      showToast(String(err));
      sendBtn.disabled = false;
      sendBtn.textContent = t("Senden");
    } finally {
      unlisten();
    }
  });

  /* --- Einladung ausstellen (dieses Gerät empfängt) --------------------- */
  const inviteModal = document.getElementById("syncInviteModal");
  const inviteStatus = document.getElementById("syncInviteStatus");
  const inviteContent = document.getElementById("syncInviteContent");
  const inviteQr = document.getElementById("syncInviteQr");
  const inviteCodeEl = document.getElementById("syncInviteCode");
  const inviteCopyBtn = document.getElementById("syncInviteCopy");
  const inviteValidEl = document.getElementById("syncInviteValid");
  const invitePairedEl = document.getElementById("syncInvitePaired");
  const inviteBtn = document.getElementById("syncInviteBtn");
  let invitePollTimer = null;

  function closeInviteModal() {
    inviteModal.classList.add("hidden");
    clearInterval(invitePollTimer);
    invitePollTimer = null;
  }

  async function openInvite() {
    popover.classList.add("hidden");
    inviteModal.classList.remove("hidden");
    inviteContent.classList.add("hidden");
    invitePairedEl.textContent = "";
    inviteStatus.textContent = t("Verbindung wird vorbereitet …");
    try {
      // Baut beim ersten Mal den cloudflared-Tunnel auf - das dauert ein
      // paar Sekunden, deshalb der Zwischenstand oben.
      const data = await invoke("sync_create_invite");
      inviteStatus.textContent = t("Auf dem anderen Gerät scannen oder den Code eintippen.");
      inviteQr.src = data.qr;
      inviteCodeEl.textContent = data.code;
      inviteValidEl.textContent = t("Gültig für {min} Minuten, danach einmalig verbraucht.", { min: data.valid_minutes });
      inviteContent.classList.remove("hidden");

      // Rückmeldung, sobald das Gegenüber den Code eingelöst hat - sonst
      // sieht der Empfänger nur seinen QR-Code und weiß nicht, ob es klappt.
      clearInterval(invitePollTimer);
      invitePollTimer = setInterval(async () => {
        try {
          const names = await invoke("sync_paired_senders");
          invitePairedEl.textContent = names.length
            ? t("✅ Verbunden: {names}", { names: names.join(", ") })
            : "";
        } catch (_) {}
      }, 2000);
    } catch (err) {
      inviteStatus.textContent = String(err);
    }
  }

  inviteBtn.addEventListener("click", openInvite);
  document.getElementById("syncInviteClose").addEventListener("click", closeInviteModal);
  document.getElementById("syncInviteCancel").addEventListener("click", closeInviteModal);
  inviteModal.addEventListener("click", (e) => { if (e.target === inviteModal) closeInviteModal(); });
  inviteCopyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(inviteCodeEl.textContent);
      showToast(t("Code kopiert."));
    } catch (_) {
      showToast(t("Kopieren nicht möglich - Code bitte abtippen."));
    }
  });

  /* --- Code einlösen (dieses Gerät sendet) ------------------------------ */
  const codeModal = document.getElementById("syncCodeModal");
  const codeInput = document.getElementById("syncCodeInput");
  const codeError = document.getElementById("syncCodeError");
  const codeConnectBtn = document.getElementById("syncCodeConnect");

  function closeCodeModal() {
    codeModal.classList.add("hidden");
  }

  document.getElementById("syncEnterCodeBtn").addEventListener("click", () => {
    popover.classList.add("hidden");
    codeError.classList.add("hidden");
    codeInput.value = "";
    codeModal.classList.remove("hidden");
    codeInput.focus();
  });
  document.getElementById("syncCodeClose").addEventListener("click", closeCodeModal);
  document.getElementById("syncCodeCancel").addEventListener("click", closeCodeModal);
  codeModal.addEventListener("click", (e) => { if (e.target === codeModal) closeCodeModal(); });

  async function connectWithCode() {
    const code = codeInput.value.trim();
    if (!code) return;
    codeConnectBtn.disabled = true;
    codeConnectBtn.textContent = t("Verbinde …");
    codeError.classList.add("hidden");
    try {
      const peer = await invoke("sync_pair_with_code", { code });
      closeCodeModal();
      await refreshPeers();
      showToast(t("Mit {name} verbunden.", { name: peer.name }));
      // Direkt weiter zum eigentlichen Zweck: Playlists auswählen.
      openSendModal(peer);
    } catch (err) {
      codeError.textContent = String(err);
      codeError.classList.remove("hidden");
    } finally {
      codeConnectBtn.disabled = false;
      codeConnectBtn.textContent = t("Verbinden");
    }
  }
  codeConnectBtn.addEventListener("click", connectWithCode);
  codeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") connectWithCode();
  });

  listen("sync-peers-changed", refreshPeers);
  // Gekoppelte Geräte überleben das Schließen des Panels - beim Start
  // einmal holen, damit sie sofort in der Liste stehen.
  refreshPeers();

  // A received file lands straight on disk (sync.rs writes it directly) -
  // nothing else would ever tell this app's own library view to re-fetch.
  // Debounced: a playlist transfer fires this once per file, no need to
  // re-render on every single one of possibly 100+.
  let libraryRefreshTimer = null;
  listen("library-changed", () => {
    clearTimeout(libraryRefreshTimer);
    libraryRefreshTimer = setTimeout(() => {
      if (typeof refreshLibrary === "function") refreshLibrary();
    }, 600);
  });
})();
