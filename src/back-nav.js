/* ===== Zurueck-Geste / Zurueck-Taste =====
   Android (Tauri): ohne eigenen Listener ruft Tauri bei "Zurueck"
   webView.goBack() auf, solange es History-Eintraege gibt, sonst schliesst
   es die App. Vorher gab es keine Eintraege - Zurueck beendete die App
   sofort, auch mit offenen Einstellungen oder Songtext.
   Hier bekommt jede offene Ebene (Fenster, Popover, Songtext, Video,
   Warteschlange, Downloader, geoeffnete Playlist) einen Eintrag ueber
   BackStack (back-stack.js). Erkannt wird das am DOM statt an jedem
   Oeffner einzeln: player.js & Co. bleiben unveraendert, und neue Ebenen
   brauchen nur eine Zeile in LAYERS. Am Hauptbildschirm ohne offene Ebene
   gibt es keinen Eintrag mehr, dann schliesst Android die App wie gewohnt.
   Auf dem Desktop wirkt dasselbe fuer die Maus-Zurueck-Taste. */
(function () {
  "use strict";
  if (!window.BackStack) return;

  const escape = () =>
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

  // [Selektor fuer die OFFENE Ebene, schliessen(el)]
  const LAYERS = [
    ["#playlistView:not(.hidden)", () => navBackBtn.click()],
    ["#mobileMoreSheet:not(.hidden)", (el) => el.classList.add("hidden")],
    ["#queuePanel:not(.hidden)", () => closeQueuePanel()],
    ["#lyricsOverlay:not(.hidden)", () => closeLyrics()],
    ["#visualizerOverlay:not(.hidden)", () => closeVisualizer()],
    ["#videoOverlay:not(.hidden)", () => closeVideoView()],
    ["#downloaderOverlay:not(.hidden)", () => closeDownloaderOverlay()],
    [".sidebar-tool-popover:not(.hidden)", (el) => {
      el.classList.add("hidden");
      const btn = el.parentElement && el.parentElement.querySelector(".sidebar-tool-btn");
      if (btn) btn.classList.remove("active");
    }],
    [".modal-overlay:not(.hidden)", (el) => {
      const close = el.querySelector(".modal-close");
      if (close) close.click();
      else el.classList.add("hidden");
    }],
    [".custom-theme-overlay", (el) => el.querySelector(".custom-theme-close").click()],
    [".theme-ctx-menu, .add-to-playlist-menu", (el) => el.remove()],
    // Eigener Escape-Handler des Update-Fensters entscheidet je Zustand
    // (waehrend der Installation bleibt es offen).
    [".upd-overlay.is-open", escape],
  ];

  const open = new Map(); // el -> release()
  let n = 0;
  let pendingPops = 0;
  let lastPopAt = 0;

  function isOpenNow(el) {
    if (!el.isConnected) return false;
    return LAYERS.some(([sel]) => el.matches(sel));
  }

  function track(el, close) {
    const id = "layer-" + ++n;
    const release = BackStack.push(id, () => {
      open.delete(el);
      close(el);
      // Ebene, die sich nicht schliessen liess (Update laeuft): wieder eintragen.
      setTimeout(() => { if (isOpenNow(el) && !open.has(el)) track(el, close); }, 0);
    });
    open.set(el, release);
  }

  function scan() {
    const now = new Map();
    LAYERS.forEach(([sel, close]) => {
      document.querySelectorAll(sel).forEach((el) => { if (!now.has(el)) now.set(el, close); });
    });
    // Erst schliessen: BackStack.pop() geht per history.back() zurueck,
    // und das laeuft asynchron. Ein pushState davor landete hinter dem
    // Eintrag, der gerade entfernt wird (Popover A zu, B auf).
    open.forEach((release, el) => {
      if (now.has(el)) return;
      open.delete(el);
      pendingPops++;
      lastPopAt = Date.now();
      release();
    });
    const fresh = [...now].filter(([el]) => !open.has(el));
    if (!fresh.length) return;
    // Notbremse: kam das popstate nie (Engine-Eigenheit), nicht ewig warten.
    if (pendingPops && Date.now() - lastPopAt < 500) {
      setTimeout(scan, 60);
      return;
    }
    pendingPops = 0;
    fresh.forEach(([el, close]) => track(el, close));
  }
  addEventListener("popstate", () => { if (pendingPops) pendingPops--; });

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    // setTimeout statt requestAnimationFrame: rAF steht still, solange das
    // Fenster verdeckt ist - die Ebene muss trotzdem eingetragen werden.
    setTimeout(() => { queued = false; scan(); }, 16);
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });

  BackStack.init();
  scan();
})();
