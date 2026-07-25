/* ===== Discord Rich Presence =====
   Meldet an Discord, was gerade laeuft ("Hoert <Titel> von <Interpret>"
   inkl. Cover und Fortschrittsbalken). Die eigentliche IPC-Arbeit macht
   discord.rs; hier wird nur entschieden, WANN etwas gemeldet wird.

   Eigene Datei wie nowplaying-native.js, statt player.js weiter aufzublaehen.

   Gemeldet wird an den Stellen, an denen sich der Zustand wirklich aendert
   (Play, Pause, Trackwechsel, Springen) - ausdruecklich NICHT bei
   timeupdate: Discord drosselt Presence-Updates, und die laufende Zeit
   rechnet Discord aus den mitgeschickten Start-/Endzeitpunkten selbst
   weiter. Ein Update pro Sekunde waere also nutzlos und wuerde nur ins
   Limit laufen. */
(function () {
  "use strict";
  if (!window.__TAURI__) return;
  const { invoke } = window.__TAURI__.core;

  const ENABLED_KEY = "discordPresence";
  const APP_ID_KEY = "discordAppId";
  // Discord verwirft zu dichte Updates. Play/Pause/Springen kann der
  // Nutzer aber beliebig schnell hintereinander ausloesen - deshalb wird
  // gebuendelt und immer nur der zuletzt gueltige Zustand gesendet.
  const MIN_INTERVAL_MS = 3000;

  let lastSentAt = 0;
  let pendingTimer = null;
  let lastPayloadKey = "";

  const enabled = () => localStorage.getItem(ENABLED_KEY) === "1";
  const appId = () => (localStorage.getItem(APP_ID_KEY) || "").trim();

  function send(force) {
    if (!enabled() || !appId()) return;
    // Bare Referenz wie in nowplaying-native.js: player.js deklariert
    // nowPlayingMeta mit `let` im globalen Skript-Scope, das haengt also
    // NICHT als Eigenschaft an window.
    if (typeof nowPlayingMeta === "undefined" || !nowPlayingMeta) return;
    const meta = nowPlayingMeta;
    const playing = !audioEl.paused;
    const position = Number.isFinite(audioEl.currentTime) ? audioEl.currentTime : 0;
    const duration = Number.isFinite(audioEl.duration) ? audioEl.duration : 0;

    // Unveraenderter Zustand muss nicht erneut gesendet werden. Die
    // Position gehoert bewusst gerundet in den Schluessel: sonst zaehlte
    // jedes Zehntel als Aenderung, obwohl Discord dieselbe Anzeige baut.
    const key = `${meta.title}|${meta.artist}|${playing}|${Math.round(position)}|${Math.round(duration)}`;
    if (!force && key === lastPayloadKey) return;
    lastPayloadKey = key;
    lastSentAt = Date.now();

    invoke("discord_update", {
      appId: appId(),
      title: meta.title || "",
      artist: meta.artist || "",
      playing,
      position,
      duration,
    }).catch(() => {
      // Discord laeuft nicht/wurde beendet - kein Grund, den Nutzer mit
      // einer Fehlermeldung zu behelligen. discord.rs wirft die tote
      // Verbindung selbst weg und baut beim naechsten Mal neu auf.
    });
  }

  function schedule() {
    if (!enabled() || !appId()) return;
    const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastSentAt));
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => send(false), wait);
  }

  audioEl.addEventListener("play", schedule);
  audioEl.addEventListener("pause", schedule);
  audioEl.addEventListener("seeked", schedule);
  audioEl.addEventListener("loadedmetadata", schedule);

  /* Ein- und Ausschalten sowie eine geaenderte Anwendungs-ID sollen sofort
     wirken, nicht erst beim naechsten Songwechsel. player.js ruft das
     nach dem Speichern der Einstellung auf. */
  window.refreshDiscordPresence = function () {
    clearTimeout(pendingTimer);
    if (!enabled() || !appId()) {
      invoke("discord_clear").catch(() => {});
      lastPayloadKey = "";
      return;
    }
    send(true);
  };

  // Beim Beenden aufraeumen: sonst bleibt der Status in Discord stehen,
  // bis der Client selbst merkt, dass die Verbindung weg ist.
  window.addEventListener("beforeunload", () => {
    invoke("discord_clear").catch(() => {});
  });

  if (enabled() && appId()) schedule();
})();
