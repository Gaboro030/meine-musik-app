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
  const { invoke } = window.__TAURI__.core;
  const { listen } = window.__TAURI__.event;

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

  listen("media-control", (e) => {
    switch (e.payload && e.payload.action) {
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
  });
})();
