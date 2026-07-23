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

  function push(playing) {
    if (!nowPlayingMeta) return;
    invoke("update_now_playing", {
      title: nowPlayingMeta.title || "Meine Musik",
      artist: nowPlayingMeta.artist || "",
      playing,
    }).catch(() => {});
  }

  audioEl.addEventListener("play", () => push(true));
  audioEl.addEventListener("pause", () => push(false));

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
    }
  }).catch(() => {});
})();
