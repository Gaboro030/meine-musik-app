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
  // Und er braucht eine Freigabe: addPluginListener ruft intern
  // plugin:now-playing|registerListener auf, das Tauri ohne Eintrag in
  // den Capabilities ablehnt (build.rs + capabilities/default.json). Genau
  // daran lag es zuletzt - der Fehler verschwand hier im catch.
  addPluginListener("now-playing", "media-control", (payload) => {
    switch (payload && payload.action) {
      // Getrennt statt blind umschalten: kommt "pause" (Kopfhoerer
      // abgezogen) bei schon pausierter Musik an, haette Umschalten sie
      // ausgerechnet dann ueber den Lautsprecher gestartet.
      case "play":
        if (audioEl.paused) togglePlayPause();
        break;
      case "pause":
        if (!audioEl.paused) togglePlayPause();
        break;
      case "next":
        nextTrack();
        break;
      case "prev":
        prevTrack();
        break;
      // Android Auto / Sprachassistent: Auswahl aus der Bibliothek.
      case "playMedia":
        nachDemLaden(() => playMediaId(payload.value));
        break;
      case "search":
        nachDemLaden(() => playFromSearch(payload.value));
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
  }).catch((e) => console.warn("Medientasten nicht verbunden:", e));

  /* ===== Android Auto =====
     PlaybackService.kt ist zugleich der MediaBrowserService, ueber den
     Android Auto die Bibliothek durchsucht. Die Bibliothek kennt nur diese
     Seite - also bekommt der Dienst bei jeder Aenderung eine schlanke
     Kopie (Name, Datei, Titel, Interpret, Dauer). Er legt sie als Datei
     ab, damit das Auto sie auch nach einem Neustart sofort zeigen kann.
     Gewaehlt wird ueber eine mediaId, die er als JSON baut:
     ["t", playlist, datei] = Titel, ["ps", playlist] = Playlist gemischt,
     ["s"] = ganze Bibliothek gemischt. */
  // Das Plugin gibt es nur in der Android-Huelle (lib.rs).
  const android = /android/i.test(navigator.userAgent);
  let gesendet = "";
  function bibliothekMelden() {
    if (!android || !Array.isArray(library)) return;
    const json = JSON.stringify(
      library.map((pl) => ({
        name: pl.name,
        tracks: (pl.tracks || []).map((t) => ({
          file: t.file,
          title: t.title || t.file,
          artist: t.artist || "",
          duration: Math.round(t.duration || 0),
        })),
      }))
    );
    if (json === gesendet) return;
    gesendet = json;
    invoke("plugin:now-playing|set_auto_library", { library: json }).catch(() => {
      gesendet = "";
    });
  }
  document.addEventListener("reson-library-changed", bibliothekMelden);
  if (Array.isArray(library) && library.length) bibliothekMelden();

  // Hat das Auto die App eben erst gestartet, ist die Bibliothek noch
  // nicht geladen - dann nach dem ersten Laden ausfuehren.
  function nachDemLaden(fn) {
    if (library.length) return fn();
    document.addEventListener("reson-library-changed", fn, { once: true });
  }

  // Laeuft der Titel schon, nicht wie ein Tipp auf die Zeile pausieren.
  function spiele(plIdx, trackIdx) {
    const ziel = library[plIdx] && library[plIdx].tracks[trackIdx];
    if (!ziel) return;
    if (nowPlayingMeta && nowPlayingMeta.stream_url === ziel.stream_url) {
      if (audioEl.paused) togglePlayPause();
      return;
    }
    playTrackIn(plIdx, trackIdx);
  }

  function playMediaId(mediaId) {
    let id;
    try {
      id = JSON.parse(mediaId);
    } catch (_) {
      return;
    }
    if (!Array.isArray(id)) return;
    if (id[0] === "s") return shuffleWholeLibrary();
    const plIdx = library.findIndex((p) => p.name === id[1]);
    if (plIdx < 0) return;
    if (id[0] === "ps") return startShuffledPlayback(library[plIdx]);
    if (id[0] === "t") spiele(plIdx, library[plIdx].tracks.findIndex((t) => t.file === id[2]));
  }

  // "Spiele … auf Reson": erst eine passende Playlist, dann ein Titel
  // oder Interpret. Ohne Suchbegriff ("Spiele Musik") alles gemischt.
  function playFromSearch(anfrage) {
    const q = String(anfrage || "").trim().toLowerCase();
    if (!q) return shuffleWholeLibrary();
    const namen = library.map((p) => p.name.toLowerCase());
    let plIdx = namen.indexOf(q);
    if (plIdx < 0) plIdx = namen.findIndex((n) => n.includes(q));
    if (plIdx >= 0) return startShuffledPlayback(library[plIdx]);
    const passt = (t) => `${t.title} ${t.artist}`.toLowerCase().includes(q);
    for (let i = 0; i < library.length; i++) {
      const ti = library[i].tracks.findIndex(passt);
      if (ti >= 0) return spiele(i, ti);
    }
  }
})();
