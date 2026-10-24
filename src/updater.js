/* ===== In-App-Update =====
   update-dialog.js zeichnet das Popup, diese Datei liefert ihm den
   Plattform-Adapter und die Texte.

   - Desktop: tauri-plugin-updater liest latest.json aus dem neuesten
     GitHub-Release, prueft die Signatur gegen den oeffentlichen Schluessel
     in tauri.conf.json und startet den Installer selbst.
   - Android: Release-Liste ueber die oeffentliche GitHub-API, APK-Download
     in den App-Cache (NowPlayingPlugin.kt), Installation ueber Androids
     eigenen Dialog. Rust laesst nur Adressen aus dem eigenen Release durch,
     Android prueft beim Installieren, dass das APK mit demselben Schluessel
     signiert ist wie die installierte App.
   Installiert wird nie ohne Klick auf "Installieren". */
(function () {
  "use strict";
  if (!window.__TAURI__ || !window.UpdateUI) return;
  const { invoke, addPluginListener } = window.__TAURI__.core;
  const REPO = "Gaboro030/meine-musik-app";

  // update-dialog.js fragt nach Schluesseln wie "update.title" - die App
  // uebersetzt aber deutschen Text (i18n.js). Hier die Bruecke dazwischen.
  const DE = {
    "update.title": "Update verfügbar",
    "update.body": "Version {version} steht bereit. Du nutzt gerade {current}.",
    "update.notes": "Das ist neu",
    "update.install": "Installieren",
    "update.later": "Später",
    "update.skip": "Dieses Update überspringen",
    "update.downloading": "Update wird heruntergeladen …",
    "update.version": "Version {version}",
    "update.installing": "Update wird installiert …",
    "update.installing.hint": "Die App startet gleich neu.",
    "update.handoff.title": "Download abgeschlossen",
    "update.handoff": "Bestätige die Installation im nächsten Fenster.",
    "update.error": "Update fehlgeschlagen",
    "update.errorBody": "Prüfe deine Verbindung und versuche es erneut.",
    "update.retry": "Erneut versuchen",
    "update.checking": "Suche läuft …",
    "update.upToDate": "Du bist auf dem neuesten Stand (Version {current}).",
    "update.checkFailed": "Die Suche nach Updates ist fehlgeschlagen.",
    "common.cancel": "Abbrechen",
    "common.close": "Schließen",
  };
  window.I18n = {
    t: (key, vars) => window.t(DE[key] || key, vars),
    number: (n, opts) => new Intl.NumberFormat(window.getLanguage?.() === "en" ? "en" : "de", opts).format(n),
    onChange: (fn) => document.addEventListener("i18n-changed", fn),
  };

  // "0.10.0" > "0.9.3" - Ziffernweise statt als Text vergleichen.
  function newer(a, b) {
    const pa = String(a).replace(/^v/, "").split(".").map(Number);
    const pb = String(b).replace(/^v/, "").split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
    }
    return false;
  }
  console.assert(newer("0.10.0", "0.9.3") && !newer("0.2.0", "0.2.0") && !newer("v0.1.9", "0.2.0"), "[update] newer()");

  function desktopAdapter(current) {
    const updater = window.__TAURI__.updater;
    let pending = null;
    return {
      mode: "desktop",
      async check() {
        pending = await updater.check();
        if (!pending) return null;
        return { version: pending.version, current, notes: pending.body || "" };
      },
      async install(onProgress) {
        let total = 0;
        let done = 0;
        await pending.downloadAndInstall((ev) => {
          if (ev.event === "Started") total = ev.data.contentLength || 0;
          else if (ev.event === "Progress" && total) {
            done += ev.data.chunkLength;
            onProgress({ percent: Math.min(100, Math.round((done / total) * 100)) });
          }
        });
        // Unter Windows beendet der Installer die App ohnehin selbst.
        await window.__TAURI__.process.relaunch();
      },
    };
  }

  function androidAdapter(current) {
    let apkUrl = null;
    // Kommt der Nutzer aus Androids Einstellung "Unbekannte Apps
    // installieren" zurueck, geht es von selbst weiter.
    const backInApp = () =>
      new Promise((resolve) => {
        const on = () => {
          if (document.visibilityState !== "visible") return;
          document.removeEventListener("visibilitychange", on);
          resolve();
        };
        document.addEventListener("visibilitychange", on);
      });
    return {
      mode: "android",
      async check() {
        const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
          headers: { Accept: "application/vnd.github+json" },
        });
        if (res.status === 404) return null; // noch kein Release
        if (!res.ok) throw new Error(`GitHub ${res.status}`);
        const rel = await res.json();
        const apk = (rel.assets || []).find((a) => a.name.toLowerCase().endsWith(".apk"));
        if (!apk || !newer(rel.tag_name, current)) return null;
        apkUrl = apk.browser_download_url;
        return { version: rel.tag_name.replace(/^v/, ""), current, notes: rel.body || "" };
      },
      async install(onProgress) {
        let ok = (await invoke("android_update", { action: "canInstall" }))?.ok;
        if (!ok) {
          await invoke("android_update", { action: "openSettings" });
          await backInApp();
          ok = (await invoke("android_update", { action: "canInstall" }))?.ok;
          if (!ok) throw new Error("Installation aus dieser App nicht erlaubt");
        }
        const listener = await addPluginListener("now-playing", "update-progress", (p) => onProgress({ percent: p.percent }));
        try {
          await invoke("android_update", { action: "download", url: apkUrl });
        } finally {
          listener.unregister();
        }
        await invoke("android_update", { action: "install" });
      },
    };
  }

  invoke("get_app_version").then((current) => {
    const android = /android/i.test(navigator.userAgent);
    if (!android && !window.__TAURI__.updater) return; // Plugin fehlt (z.B. Dev-Build ohne Updater)
    UpdateUI.init({ adapter: android ? androidAdapter(current) : desktopAdapter(current), currentVersion: current });
    UpdateUI.bindSettings();
  });
})();
