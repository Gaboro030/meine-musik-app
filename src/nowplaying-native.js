/* ===== Spotify/YT-Music-Style Wiedergabe-Notification (Android) =====
   Android pausiert die WebView/JS des Fensters, sobald die App in den
   Hintergrund geht - ein Foreground-Service mit MediaSession ist der
   einzige Weg, das zu umgehen und Lockscreen-/Benachrichtigungs-Controls
   zu zeigen (nowplaying.rs + android-extra/PlaybackService.kt +
   NowPlayingPlugin.kt). Diese Datei füttert diesen Service bei jedem
   Play/Pause mit den aktuellen Metadaten und leitet Tastendrücke aus der
   Notification (Prev/Play-Pause/Next) an dieselben Funktionen weiter, die
   auch der In-App-Player-Bar-Button aufruft. */
(function () {
  "use strict";
  if (!window.__TAURI__) return;
  const { invoke, addPluginListener } = window.__TAURI__.core;

  const ms = (sekunden) =>
    Number.isFinite(sekunden) && sekunden > 0 ? Math.round(sekunden * 1000) : 0;

  function push(playing) {
    if (!nowPlayingMeta) return;
    invoke("update_now_playing", {
      title: nowPlayingMeta.title || "Reson",
      artist: nowPlayingMeta.artist || "",
      playing,
      // Rust sucht daraus das Cover neben der Track-Datei. Ohne das zeigt
      // der System-Player eine graue Flaeche statt des Bildes.
      playlist: nowPlayingMeta.playlist || null,
      file: nowPlayingMeta.file || null,
      // Fuer die Fortschrittsleiste mit Minutenangabe im System-Player.
      positionMs: ms(audioEl.currentTime),
      durationMs: ms(audioEl.duration),
    }).catch(() => {});
  }

  audioEl.addEventListener("play", () => push(true));
  audioEl.addEventListener("pause", () => push(false));
  // Dauer steht erst fest, wenn die Datei eingelesen ist - ohne diesen
  // Nachschlag bliebe die Leiste beim ersten Update noch bei 0.
  audioEl.addEventListener("loadedmetadata", () => push(!audioEl.paused));
  audioEl.addEventListener("seeked", () => push(!audioEl.paused));

  // Android rechnet die Position zwischen zwei Meldungen selbst hoch
  // (anhand der Geschwindigkeit im PlaybackState), es braucht also keine
  // Meldung pro Sekunde. Alle fuenf Sekunden haelt die Anzeige trotzdem
  // sauber Schritt, auch nach Pausen und Sprüngen.
  setInterval(() => {
    if (!audioEl.paused) push(true);
  }, 5000);

  // WICHTIG: "media-control" wird von NowPlayingPlugin.kt per trigger(...)
  // aus einem @TauriPlugin heraus gefeuert - das ist ein PLUGIN-Event
  // (Kanal ist an den Plugin-Namen "now-playing" aus nowplaying.rs
  // gebunden), kein normales App-weites emit()-Event. window.__TAURI__.
  // event.listen() hoert nur auf Letzteres und bekam dieses Event deshalb
  // NIE - Notification zeigte zwar den Songtitel (updateNowPlaying lief),
  // aber Play/Prev/Next taten sichtbar nichts. addPluginListener ist der
  // richtige Kanal fuer Plugin-eigene Events.
  addPluginListener("now-playing", "media-control", (payload) => {
    switch (payload && payload.action) {
      case "play":
      case "pause":
        togglePlayPause();
        break;
      case "next":
        nextTrack();
        break;
      case "prev":
        prevTrack();
        break;
      case "seek": {
        // Ziehen an der Leiste im System-Player. Kommt in Millisekunden.
        const ziel = Number(payload.position);
        if (Number.isFinite(ziel) && ziel >= 0) {
          audioEl.currentTime = ziel / 1000;
          push(!audioEl.paused);
        }
        break;
      }
    }
  }).catch(() => {});
})();
