/* ===== Globale System-Hotkeys (Desktop) =====
   Die in HOTKEY_ACTIONS (player.js) konfigurierten Kombinationen wirken
   dort nur, solange das Fenster fokussiert ist - eine Webview kann
   Tastendrücke grundsätzlich nicht sehen, während sie unfokussiert/
   minimiert ist (Browser-Sandbox-Grenze, kein JS-Workaround möglich).
   Diese Datei spiegelt die aktuellen Bindings zusätzlich nach Rust
   (hotkeys.rs, tauri-plugin-global-shortcut - Desktop-only, Android hat
   weder Tastatur noch ein "minimiert"-Konzept dafür). Die dort
   registrierten Kombinationen feuern dann auch im Hintergrund, über ein
   "global-hotkey"-Event zurück ins Frontend - beide Wege rufen am Ende
   dieselbe HOTKEY_ACTIONS-Funktion auf, Verhalten ist identisch. */
(function () {
  "use strict";
  if (!window.__TAURI__) return;
  const { invoke } = window.__TAURI__.core;
  const { listen } = window.__TAURI__.event;

  function syncGlobalHotkeys() {
    const bindings = HOTKEY_ACTIONS.map((a) => ({ id: a.id, ...hotkeyBindings[a.id] }));
    invoke("set_global_hotkeys", { bindings }).catch(() => {});
  }

  syncGlobalHotkeys();

  // saveHotkeyBindings() (player.js) persists a rebind to localStorage -
  // re-registering here right after keeps Rust's global set in lockstep
  // without touching player.js's own hotkey-recording logic at all.
  const originalSave = window.saveHotkeyBindings;
  window.saveHotkeyBindings = function () {
    originalSave();
    syncGlobalHotkeys();
  };

  listen("global-hotkey", (e) => {
    const action = HOTKEY_ACTIONS.find((a) => a.id === e.payload);
    if (action) action.fn();
  });
})();
