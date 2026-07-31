/* ===== Bruecke Player-Seite <-> Downloader-Rahmen =====

   Warum es das gibt: der Downloader ist eine eigene Seite. Ein Klick
   darauf hat bisher die Player-Seite ENTLADEN - und damit auch das
   <audio>-Element, an dem die Musik haengt. Die Wiedergabe brach also
   jedes Mal ab, sobald man etwas herunterladen wollte.

   Jetzt laeuft der Downloader in einem Rahmen ueber dem Player. Die
   Player-Seite bleibt geladen, die Musik laeuft weiter, und weil die
   Ebene ueber der Player-Leiste endet, kann man sie dort auch ganz
   normal anhalten.

   Der Haken dabei: Tauri legt seine Programmierschnittstelle nur im
   Haupt-Rahmen ab, window.__TAURI__ ist im Unter-Rahmen also nicht
   vorhanden. Statt das zu umgehen, reicht dieser Baustein die Aufrufe
   durch: das Kind fragt per Nachricht, die Elternseite fuehrt aus und
   schickt das Ergebnis zurueck. Fuer downloader.js sieht das aus wie
   eine ganz normale Tauri-Anbindung.

   Wird in BEIDEN Seiten eingebunden und entscheidet selbst, welche Rolle
   es hat. */
(function () {
  "use strict";

  const imRahmen = window.self !== window.top;
  const eigenesTauri = !!(window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke);

  /* ---------- Elternseite (Player) ---------- */
  if (!imRahmen) {
    const laufendeHorcher = new Map();

    window.addEventListener("message", async (e) => {
      const frame = document.getElementById("downloaderFrame");
      // Nur Nachrichten aus GENAU diesem Rahmen beantworten. Sonst waere
      // das hier eine offene Tuer: jede eingebettete Seite koennte
      // beliebige Backend-Befehle ausloesen.
      if (!frame || e.source !== frame.contentWindow) return;
      const d = e.data;
      if (!d || typeof d !== "object" || typeof d.kind !== "string") return;

      const antwort = (nachricht) => {
        if (frame.contentWindow) frame.contentWindow.postMessage(nachricht, "*");
      };

      if (d.kind === "reson-close") {
        if (typeof window.closeDownloaderOverlay === "function") window.closeDownloaderOverlay();
        return;
      }

      const core = window.__TAURI__ && window.__TAURI__.core;
      const ereignis = window.__TAURI__ && window.__TAURI__.event;

      if (d.kind === "reson-invoke") {
        if (!core) {
          antwort({ kind: "reson-invoke-result", id: d.id, ok: false, error: "Keine Verbindung zur App." });
          return;
        }
        try {
          const value = await core.invoke(d.cmd, d.args);
          antwort({ kind: "reson-invoke-result", id: d.id, ok: true, value });
        } catch (err) {
          antwort({ kind: "reson-invoke-result", id: d.id, ok: false, error: String(err && err.message ? err.message : err) });
        }
        return;
      }

      if (d.kind === "reson-listen") {
        if (!ereignis) {
          antwort({ kind: "reson-listen-ready", id: d.id, ok: false });
          return;
        }
        try {
          const un = await ereignis.listen(d.event, (ev) => {
            antwort({ kind: "reson-event", id: d.id, payload: ev.payload });
          });
          laufendeHorcher.set(d.id, un);
          antwort({ kind: "reson-listen-ready", id: d.id, ok: true });
        } catch (_) {
          antwort({ kind: "reson-listen-ready", id: d.id, ok: false });
        }
        return;
      }

      if (d.kind === "reson-unlisten") {
        const un = laufendeHorcher.get(d.id);
        if (un) {
          try { un(); } catch (_) {}
          laufendeHorcher.delete(d.id);
        }
      }
    });

    // Wird der Rahmen geschlossen, muessen auch seine Horcher weg -
    // sonst haengen sie fuer den Rest der Sitzung im Backend fest.
    window.addEventListener("reson-downloader-closed", () => {
      laufendeHorcher.forEach((un) => {
        try { un(); } catch (_) {}
      });
      laufendeHorcher.clear();
    });
    return;
  }

  /* ---------- Kindseite (Downloader im Rahmen) ---------- */

  // Zurueck zum Player heisst hier: Ebene schliessen, nicht den Rahmen
  // woandershin schicken (sonst laege der Player IM Rahmen, doppelt).
  window.resonZurueckZumPlayer = function () {
    window.parent.postMessage({ kind: "reson-close" }, "*");
  };

  // "Zum Player" und der Player-Link im Bibliotheks-Hinweis: im Rahmen
  // wuerde das den Player IM Rahmen oeffnen - also doppelt, mit einem
  // zweiten Abspieler darin. Stattdessen die Ebene schliessen; der Player
  // liegt ja schon darunter und spielt weiter.
  document.addEventListener("click", (e) => {
    const link = e.target.closest('a[href="index.html"]');
    if (!link) return;
    e.preventDefault();
    window.resonZurueckZumPlayer();
  });

  if (eigenesTauri) return; // Rahmen hat selbst Zugriff - nichts zu tun.

  let naechsteId = 1;
  const offeneAufrufe = new Map();
  const ereignisRueckrufe = new Map();

  window.addEventListener("message", (e) => {
    if (e.source !== window.parent) return;
    const d = e.data;
    if (!d || typeof d !== "object") return;
    if (d.kind === "reson-invoke-result") {
      const eintrag = offeneAufrufe.get(d.id);
      if (!eintrag) return;
      offeneAufrufe.delete(d.id);
      if (d.ok) eintrag.resolve(d.value);
      else eintrag.reject(new Error(d.error || "Fehlgeschlagen"));
      return;
    }
    if (d.kind === "reson-listen-ready") {
      const eintrag = offeneAufrufe.get(d.id);
      if (!eintrag) return;
      offeneAufrufe.delete(d.id);
      eintrag.resolve(d.ok);
      return;
    }
    if (d.kind === "reson-event") {
      const cb = ereignisRueckrufe.get(d.id);
      if (cb) cb({ payload: d.payload });
    }
  });

  function frage(nachricht) {
    return new Promise((resolve, reject) => {
      const id = naechsteId++;
      offeneAufrufe.set(id, { resolve, reject });
      window.parent.postMessage(Object.assign({ id }, nachricht), "*");
    });
  }

  window.__TAURI__ = {
    core: {
      invoke: (cmd, args) => frage({ kind: "reson-invoke", cmd, args }),
    },
    event: {
      listen: async (event, cb) => {
        const id = naechsteId++;
        ereignisRueckrufe.set(id, cb);
        await new Promise((resolve) => {
          offeneAufrufe.set(id, { resolve, reject: resolve });
          window.parent.postMessage({ kind: "reson-listen", id, event }, "*");
        });
        return () => {
          ereignisRueckrufe.delete(id);
          window.parent.postMessage({ kind: "reson-unlisten", id }, "*");
        };
      },
    },
  };
})();
