/* ===== i18n: Sprache DE/EN =====
   Deutsch ist die eigentliche "Quelle" - Uebersetzungsschluessel sind der
   deutsche Original-Text selbst statt erfundener IDs. Vorteil: nur EIN
   Woerterbuch (DE->EN) noetig statt zwei parallele, und ein fehlender
   Eintrag faellt nicht als "undefined"/leere Stelle auf, sondern zeigt
   einfach weiter den deutschen Text - nie eine kaputte/leere UI.

   Verwendung:
   - Statischer HTML-Text: data-i18n="Deutscher Text" auf dem Element, das
     GENAU diesen Text (und sonst nichts) enthaelt - angewandt via
     applyStaticI18n() bei jedem Sprachwechsel und einmal beim Laden.
   - Attribute: data-i18n-title="..." / data-i18n-placeholder="..." fuer
     title/placeholder statt textContent.
   - Dynamischer Text in player.js/downloader.js/... : t("Deutscher Text")
     bzw. t("Text mit {platzhalter}", { platzhalter: wert }) fuer Toasts,
     dynamisch erzeugte Labels usw. */
(function () {
  "use strict";

  const LANG_KEY = "appLanguage";

  const EN = {
    // ----- Navigation / Sidebar -----
    "Home": "Home",
    "Bibliothek": "Library",
    "Papierkorb": "Trash",
    "Duplikate": "Duplicates",
    "Statistik": "Statistics",
    "Health-Check": "Health Check",
    "Playlists": "Playlists",
    "Noch keine Playlist": "No playlists yet",
    "Freunde einladen": "Invite friends",
    "Scannen & Songs zur Warteschlange hinzufügen": "Scan to add songs to the queue",
    "Hören gerade zu": "Listening now",
    "Party-Modus": "Party mode",
    "Spielt auf allen Geräten im WLAN exakt denselben Song synchron ab.": "Plays the exact same song in sync on every device on the network.",
    "Party starten": "Start party",
    "Party beenden": "End party",
    "Nachricht an alle…": "Message everyone…",
    "Senden": "Send",
    "Verlauf als Playlist speichern": "Save history as playlist",
    "Handy-Sync": "Phone sync",
    "Findet andere Geräte im selben WLAN, auf denen der Sync-Modus offen ist.": "Finds other devices on the same network with sync mode open.",
    "Sync-Modus starten": "Start sync mode",
    "Sync-Modus beenden": "Stop sync mode",
    "Design": "Theme",
    "Rechtsklick auf ein Theme = anpassen, was es ändert": "Right-click a theme to customize what it changes",
    "Eigenes Theme ✎": "Custom theme ✎",
    "Einstellungen": "Settings",
    "Downloader": "Downloader",
    "Musik hinzufügen": "Add music",

    // ----- Suche / Header -----
    "Songs, Playlists, Interpreten suchen…": "Search songs, playlists, artists…",
    "⬇️ Downloader": "⬇️ Downloader",

    // ----- Leerer Zustand -----
    "Noch keine Musik in deiner Bibliothek": "No music in your library yet",
    "Zum Downloader": "Go to downloader",

    // ----- Home -----
    "Guten Tag": "Good day",
    "Guten Morgen": "Good morning",
    "Guten Abend": "Good evening",
    "📻 Daily Mix": "📻 Daily Mix",
    "Stimmungen": "Moods",
    "Zuletzt hinzugefügt": "Recently added",
    "Andere Songs entdecken": "Discover other songs",
    "Neue Vorschläge": "New suggestions",

    // ----- Bibliothek -----
    "Deine Bibliothek": "Your library",
    "Playlist hinzufügen": "Add playlist",
    "Songordner per Drag & Drop hierher ziehen": "Drag & drop a song folder here",

    // ----- Playlist-Ansicht -----
    "PLAYLIST": "PLAYLIST",
    "Playlist umbenennen": "Rename playlist",
    "Als M3U exportieren (für andere Player)": "Export as M3U (for other players)",
    "Als CSV exportieren (Import in SoundIiiz/TuneMyMusic → Spotify/YouTube Music)": "Export as CSV (import into SoundIiiz/TuneMyMusic → Spotify/YouTube Music)",
    "Playlist löschen": "Delete playlist",
    "— Songs von überall auf dieser Seite ablegen, um sie hinzuzufügen": "— drop songs anywhere on this page to add them",
    "Songs hier ablegen": "Drop songs here",
    "Alle abspielen": "Play all",
    "Zufallswiedergabe": "Shuffle",
    "Offline herunterladen": "Download offline",
    "☑️ Auswählen": "☑️ Select",
    "Mehrere Titel für Album-/Cover-Änderung auswählen": "Select multiple tracks to change album/cover",
    "ausgewählt": "selected",
    "Alle auswählen": "Select all",
    "Auswahl aufheben": "Deselect all",
    "Album ändern": "Change album",
    "Cover ändern": "Change cover",
    "Fertig": "Done",
    "Titel": "Title",
    "Album": "Album",
    "Empfohlene Songs für diese Playlist": "Recommended songs for this playlist",

    // ----- Suche -----
    "Suchergebnisse": "Search results",
    "In deiner Bibliothek": "In your library",
    "Gefundene Playlists": "Playlists found",
    "🌐 Online gefunden – zum Herunterladen": "🌐 Found online – to download",
    "Keine Ergebnisse.": "No results.",

    // ----- Papierkorb -----
    "Gelöscht am": "Deleted on",
    "Papierkorb ist leer.": "Trash is empty.",

    // ----- Duplikate -----
    "Keine Duplikate gefunden.": "No duplicates found.",

    // ----- Statistik -----
    "Hörzeit gesamt": "Total listening time",
    "Songs abgespielt": "Songs played",
    "Top-Songs": "Top songs",
    "Top-Interpreten": "Top artists",

    // ----- Health-Check -----
    "Prueft die Bibliothek auf verwaiste Sidecar-Dateien (Cover/Album/ Interpret-Sidecars ohne zugehoerigen Track) und kaputte Papierkorb-Eintraege (Datei fehlt, Wiederherstellen wuerde scheitern).":
      "Checks the library for orphaned sidecar files (cover/album/artist sidecars without a matching track) and broken trash entries (file missing, restoring would fail).",
    "🔍 Erneut scannen": "🔍 Scan again",
    "🧹 Alles bereinigen": "🧹 Clean up everything",
    "✅ Alles sauber - nichts gefunden.": "✅ All clean - nothing found.",
    "Verwaiste Sidecar-Dateien": "Orphaned sidecar files",
    "Kaputte Papierkorb-Eintraege": "Broken trash entries",

    // ----- Einstellungen -----
    "⚙️ Einstellungen": "⚙️ Settings",
    "Darstellung": "Appearance",
    "Sprache": "Language",
    "Sprache der App-Oberfläche": "App interface language",
    "Dynamic Glow": "Dynamic glow",
    "Hintergrund passt sich der Cover-Farbe des Songs an": "Background adapts to the song's cover color",
    "Wiedergabe & Sound": "Playback & sound",
    "Weicher Übergang (Crossfade)": "Smooth transition (crossfade)",
    "Songs blenden sich beim Wechsel sanft ineinander statt hart zu schneiden": "Songs fade smoothly into each other instead of cutting hard",
    "Crossfade-Dauer": "Crossfade duration",
    "Wie lange sich zwei Songs beim Wechsel überlappen": "How long two songs overlap during the transition",
    "DJ-Beat-Übergänge (experimentell)": "DJ beat transitions (experimental)",
    "Erkennt das Tempo (BPM) automatisch und startet den Übergang auf dem nächsten Beat statt an einem beliebigen Punkt":
      "Automatically detects tempo (BPM) and starts the transition on the next beat instead of an arbitrary point",
    "Lautstärke-Normalisierung": "Volume normalization",
    "Gleicht laute/leise Songs beim Wechsel automatisch an, statt selbst nachzuregeln": "Automatically levels loud/quiet songs on transition instead of you adjusting manually",
    "Stille überspringen (Skip-Silence)": "Skip silence",
    "Leise Anfänge/Enden bei jedem Song automatisch überspringen": "Automatically skip quiet starts/ends on every song",
    "Mini-Player (Picture-in-Picture)": "Mini player (Picture-in-Picture)",
    "Beim Minimieren schwebt ein kleines Player-Fenster über allen anderen Programmen": "A small floating player window stays on top of other windows when minimized",
    "Cache & Speicher": "Cache & storage",
    "Songtext-Cache leeren": "Clear lyrics cache",
    "Lokal gespeicherte Songtexte löschen - werden beim nächsten Abspielen neu geladen": "Delete locally cached lyrics - reloaded next time the song plays",
    "Leeren": "Clear",
    "Backup": "Backup",
    "Einstellungen sichern": "Back up settings",
    "Themes, Play-Verlauf & Co. als kleine Datei speichern (z.B. in einen Cloud-Ordner)": "Save themes, play history & co. as a small file (e.g. into a cloud folder)",
    "Sichern": "Back up",
    "Einstellungen wiederherstellen": "Restore settings",
    "Aus einer zuvor gesicherten Datei zurückspielen": "Restore from a previously saved file",
    "Wiederherstellen": "Restore",
    "Komplette Bibliothek exportieren": "Export entire library",
    "Alle Playlists inkl. Musikdateien als ZIP-Archiv sichern": "Back up all playlists incl. music files as a ZIP archive",
    "Als ZIP exportieren": "Export as ZIP",
    "Bibliothek aus ZIP wiederherstellen": "Restore library from ZIP",
    "Fehlende Titel aus einem ZIP-Backup ergänzen (vorhandene Dateien bleiben unangetastet)": "Add missing tracks from a ZIP backup (existing files stay untouched)",
    "Aus ZIP importieren": "Import from ZIP",
    "Sync & Verbindung": "Sync & connection",
    "Handy-Sync beim Start aktivieren": "Enable phone sync on startup",
    "Gerät ist sofort im WLAN sichtbar, ohne den Sync-Popover erst zu öffnen": "Device is immediately visible on the network without opening the sync popover first",
    "Hotkeys": "Hotkeys",
    "Klick auf eine Taste, dann gewünschte Kombination drücken. Esc bricht ab.": "Click a key, then press the desired combination. Esc cancels.",
    "App-Info": "App info",
    "Version": "Version",

    // ----- Tastenkürzel-Übersicht -----
    "⌨️ Tastenkürzel": "⌨️ Keyboard shortcuts",
    "Umbelegen unter Einstellungen → Hotkeys.": "Rebind under Settings → Hotkeys.",

    // ----- Modals -----
    "Bist du sicher?": "Are you sure?",
    "Abbrechen": "Cancel",
    "Löschen": "Delete",
    "Speichern": "Save",
    "Gerät": "Device",
    "An {device} senden": "Send to {device}",
    "Alle Playlists": "All playlists",

    // ----- Songtext-Overlay -----
    "Songtext-Sync feinjustieren, falls er vor- oder nacheilt": "Fine-tune lyrics sync if it's ahead or behind",
    "Zum Zurücksetzen klicken": "Click to reset",
    "Lade Songtext …": "Loading lyrics …",

    // ----- Player-Bar -----
    "Kein Titel ausgewählt": "No track selected",
    "Merken": "Save",
    "Songtext anzeigen": "Show lyrics",
    "Video ansehen": "Watch video",
    "Warteschlange anzeigen": "Show queue",
    "Zurück": "Previous",
    "Abspielen": "Play",
    "Pause": "Pause",
    "Vor": "Next",
    "Wiederholen": "Repeat",
    "Geschwindigkeit & A-B-Loop": "Speed & A-B loop",
    "Geschwindigkeit": "Speed",
    "Zurücksetzen": "Reset",
    "A-B-Loop": "A-B loop",
    "A setzen": "Set A",
    "B setzen": "Set B",
    "Kein Loop aktiv": "No loop active",
    "Equalizer": "Equalizer",
    "Bass": "Bass",
    "Mid": "Mid",
    "Treble": "Treble",

    // ----- Warteschlange -----
    "Warteschlange": "Queue",

    // ----- Sonstiges -----
    "Unbekannter Interpret": "Unknown artist",

    // ----- Hotkey-Aktionen -----
    "Nächster Song": "Next song",
    "Vorheriger Song": "Previous song",
    "Wiedergabe / Pause": "Play / pause",
    "Song merken": "Save song",
    "Dynamic Glow an/aus": "Toggle dynamic glow",
    "Tastenkürzel-Übersicht": "Keyboard shortcut overview",
    "Strg": "Ctrl",
    "Umschalt": "Shift",
    "Leertaste": "Space",

    // ----- Toasts & dynamische Meldungen (player.js) -----
    "Download fehlgeschlagen.": "Download failed.",
    '⬇ „{title}" in „Entdeckt" gespeichert': '⬇ „{title}" saved to „Discovered"',
    "Playlist löschen?": "Delete playlist?",
    '„{name}" mit {count} Titeln wird unwiderruflich gelöscht.': '„{name}" with {count} tracks will be permanently deleted.',
    "Löschen fehlgeschlagen.": "Deletion failed.",
    "🗑 Playlist gelöscht": "🗑 Playlist deleted",
    "Umbenennen fehlgeschlagen.": "Renaming failed.",
    "✏️ Playlist umbenannt": "✏️ Playlist renamed",
    '🗑 „{title}" entfernt': '🗑 „{title}" removed',
    "Bulk-Bearbeitung fehlgeschlagen.": "Bulk edit failed.",
    ", {count} fehlgeschlagen": ", {count} failed",
    "✅ {count} Titel aktualisiert{failedNote}": "✅ {count} tracks updated{failedNote}",
    '👥 Aus der Warteschlange: „{title}"': '👥 From the queue: „{title}"',
    "🔀 Neu gemischt!": "🔀 Reshuffled!",
    "↩ Wiederhergestellt": "↩ Restored",
    "Wiederherstellen fehlgeschlagen.": "Restore failed.",
    "⚠️ Aussetzer im Stream – versuche es erneut …": "⚠️ Stream hiccup – retrying …",
    "⚠️ Mehrere Titel nicht ladbar – Wiedergabe gestoppt": "⚠️ Multiple tracks failed to load – playback stopped",
    "⚠️ Fehler beim Laden des Titels – nächster Song in 3s …": "⚠️ Error loading track – next song in 3s …",
    "⚠️ Stream hängt – lade neu …": "⚠️ Stream stuck – reloading …",
    'Als Nächstes: „{title}"': 'Up next: „{title}"',
    'In Warteschlange: „{title}"': 'Queued: „{title}"',
    "Keine MP3-Dateien gefunden.": "No MP3 files found.",
    "Erst Punkt A setzen.": "Set point A first.",
    "B muss nach A liegen.": "B must come after A.",
    "Loop: {a} – {b}": "Loop: {a} – {b}",
    "A bei {a} – jetzt B setzen": "A at {a} – now set B",
    "Kein Loop aktiv": "No loop active",
    "Gerade wird kein Titel abgespielt.": "No track is currently playing.",
    "Kein passendes Video gefunden.": "No matching video found.",
    '⏳ Lade Video „{title}" …': '⏳ Loading video „{title}" …',
    "Video konnte nicht geladen werden.": "Video could not be loaded.",
    "🧹 {count} zwischengespeicherte Songtexte gelöscht": "🧹 {count} cached lyrics deleted",
    "Cache konnte nicht geleert werden.": "Cache could not be cleared.",
    '⚠️ Kombination schon vergeben für „{label}"': '⚠️ Combination already assigned to „{label}"',
    "Hinzufügen fehlgeschlagen.": "Adding failed.",
    '➕ Zu „{playlist}" hinzugefügt': '➕ Added to „{playlist}"',
    '⬇️ Offline-Download {current}/{total}: „{title}"': '⬇️ Offline download {current}/{total}: „{title}"',
    "✅ {ok} Titel offline gespeichert, {failed} fehlgeschlagen": "✅ {ok} tracks saved offline, {failed} failed",
    "✅ Alle {ok} Titel offline gespeichert": "✅ All {ok} tracks saved offline",
    "🎉 Party-Modus gestartet": "🎉 Party mode started",
    "🎉 Party-Modus beendet": "🎉 Party mode ended",
    "Aktiv – alle Geräte im WLAN hören jetzt synchron mit.": "Active – all devices on the network are now listening in sync.",
    "Gast": "Guest",
    "In dieser Party wurde noch nichts gespielt.": "Nothing has been played in this party yet.",
    "Party vom {date}": "Party from {date}",
    "Name der neuen Playlist:": "Name of the new playlist:",
    '🎉 {ok} von {total} Songs in „{name}" gespeichert': '🎉 {ok} of {total} songs saved to „{name}"',
    "Wiederherstellen": "Restore",
    "Endgültig löschen": "Delete permanently",
    "↩️ Titel wiederhergestellt": "↩️ Track restored",
    "In den Papierkorb verschieben": "Move to trash",
    "🗑 In den Papierkorb verschoben": "🗑 Moved to trash",
    "Bereinigen fehlgeschlagen.": "Cleanup failed.",
    "🧹 {count} Eintrag/Einträge bereinigt": "🧹 {count} item(s) cleaned up",
    "Nichts zu bereinigen.": "Nothing to clean up.",
    "Endgültig löschen?": "Delete permanently?",
    "Diese Datei wird unwiderruflich gelöscht und kann nicht wiederhergestellt werden.": "This file will be permanently deleted and cannot be restored.",
    "🗑 Endgültig gelöscht": "🗑 Permanently deleted",
    "Gerade keine Vorschläge gefunden.": "No suggestions right now.",
    "Rückgängig": "Undo",
    "Leer - über ⋯ bei einem Song füllen.": "Empty - fill via ⋯ on a song.",
    "Nach oben": "Move up",
    "Nach unten": "Move down",
    "Entfernen": "Remove",
    "Als Nächstes": "Up Next",
    "Als Nächstes ({count})": "Up Next ({count})",
    "Von Gästen ({count})": "From guests ({count})",
    "Bereits in deiner Bibliothek - spielt lokal": "Already in your library - plays locally",
    "Nicht lokal vorhanden - wird gestreamt": "Not available locally - will be streamed",
    "Danach: {playlist}": "Next up: {playlist}",
    "Ähnliche Songs": "Similar songs",
    "Taste drücken … (Esc = abbrechen)": "Press a key … (Esc to cancel)",
    "Noch keine Playlist vorhanden": "No playlist yet",
    "Suchverlauf löschen": "Clear search history",
    "Noch keine Wiedergaben.": "No plays yet.",
    "Als nächstes spielen": "Play next",
    "An Warteschlange anhängen": "Add to queue",
    "Warteschlange anzeigen": "Show queue",
    "In Bibliothek herunterladen": "Download to library",
    "Video direkt ansehen (ohne Download)": "Watch video directly (without downloading)",
    "Auf YouTube ansehen": "Watch on YouTube",
    "Optionen": "Options",
    "Zu Playlist hinzufügen": "Add to playlist",
    "Aus Playlist entfernen": "Remove from playlist",
    "Aus der Party entfernen": "Remove from party",
    "Nicht unterstützt auf diesem System": "Not supported on this system",
    "Gute Nacht": "Good night",

    // ----- Downloader-Seite (downloader.html/downloader.js) -----
    "Spotify-, YouTube- oder YouTube-Music-Link einfügen, Titel auswählen und als MP3 oder MP4 in die Bibliothek laden.":
      "Paste a Spotify, YouTube, or YouTube Music link, select tracks, and load them as MP3 or MP4 into your library.",
    "🎧 Zum Player": "🎧 Go to player",
    "⚠️ Downloads funktionieren auf Android noch nicht (yt-dlp gibt es dafür nicht). Lade Musik am PC (Windows/Linux) herunter - sie erscheint dann über Party-Modus/Sync auf dem Handy.":
      "⚠️ Downloads don't work on Android yet (no yt-dlp available there). Download music on PC (Windows/Linux) - it then shows up on your phone via Party mode/Sync.",
    "Spotify- / YouTube- / YouTube-Music-Playlist oder -Link …": "Spotify / YouTube / YouTube Music playlist or link …",
    "MP3-Qualität": "MP3 quality",
    "Video-Qualität": "Video quality",
    "Beste Qualität": "Best quality",
    "Laden": "Load",
    "🎤 Songtext-Ausschnitt eingeben, um den Song zu finden…": "🎤 Enter a lyrics snippet to find the song…",
    "Song finden": "Find song",
    "🎧 Original-Studio-Audio bevorzugen (wie Spotify, ohne Musikvideo-Sound)": "🎧 Prefer original studio audio (like Spotify, without music-video sound)",
    "Landet direkt in der Bibliothek (im": "Goes straight into the library (playable in the",
    "abspielbar)": ")",
    "Fortschritt:": "Progress:",
    "Sammel-Download": "Batch download",
    "Downloads pausieren": "Pause downloads",
    "Vorbereitung …": "Preparing …",
    "Alle": "All",
    "Fehlerbericht": "Error report",
    "Auswahl in Bibliothek laden": "Load selection into library",
    "Nur für Inhalte verwenden, an denen du die Rechte besitzt.": "Only use this for content you own the rights to.",
    "⚠️ Fehlerbericht": "⚠️ Error report",
    "ℹ️ Auf Android wird Audio als M4A gespeichert (statt MP3) und Videos in Standard-Qualität - Abspielen funktioniert ganz normal.":
      "ℹ️ On Android, audio is saved as M4A (instead of MP3) and videos in standard quality - playback works completely normally.",
    "Laden …": "Loading …",
    "Lade Playlist …": "Loading playlist …",
    "{count} Titel": "{count} tracks",
    "{count} Spotify-Titel ohne YouTube-Treffer übersprungen.": "{count} Spotify tracks skipped (no YouTube match).",
    "{count} Titel geladen": "{count} tracks loaded",
    "Suche …": "Searching …",
    "Suche nach passendem Song …": "Searching for matching song …",
    "Kein Song zu diesem Songtext gefunden.": "No song found for this lyrics snippet.",
    "Nichts gefunden - anderen Ausschnitt versuchen.": "Nothing found - try a different snippet.",
    "Songtext-Suche": "Lyrics search",
    "{count} Treffer": "{count} matches",
    "Erneuter Versuch …": "Retrying …",
    "Konvertiere …": "Converting …",
    "noch {eta}": "{eta} left",
    '„{title}" in Bibliothek gespeichert': '„{title}" saved to library',
    "Downloads fortsetzen": "Resume downloads",
    "Bitte mindestens einen Titel auswählen.": "Please select at least one track.",
    "Wird geladen …": "Loading …",
    "⏸ Pausiert": "⏸ Paused",
    "Unbekannter Fehler.": "Unknown error.",
    "Übersprungen: {title}": "Skipped: {title}",
    "✅ Fertig!": "✅ Done!",
    "{ok} Titel geladen, {skipped} übersprungen.": "{ok} tracks loaded, {skipped} skipped.",
    "Fehlerbericht ({count})": "Error report ({count})",
    "{ok} Titel in Bibliothek geladen!": "{ok} tracks loaded into library!",
    "↓ Loslassen zum Aktualisieren": "↓ Release to refresh",
    "⟳ Wird aktualisiert …": "⟳ Refreshing …",
    "💾 Einstellungen gesichert": "💾 Settings backed up",
    "Keine gültige Einstellungs-Backup-Datei.": "Not a valid settings backup file.",
    "💾 Einstellungen wiederhergestellt – App startet neu …": "💾 Settings restored – app is restarting …",
    "Wird gepackt …": "Packing …",
    "📦 Bibliothek als ZIP exportiert": "📦 Library exported as ZIP",
    "Wird entpackt …": "Unpacking …",
    "📦 {count} Datei(en) wiederhergestellt": "📦 {count} file(s) restored",
    "Sichtbar für andere Geräte im WLAN - Liste aktualisiert sich automatisch.": "Visible to other devices on the network - list updates automatically.",
    "Senden": "Send",
    "Lade Playlists …": "Loading playlists …",
    "Keine Playlists in der Bibliothek.": "No playlists in the library.",
    "Bitte mindestens eine Playlist auswählen.": "Please select at least one playlist.",
    "Wird gesendet …": "Sending …",
    "{sent} gesendet, {failed} fehlgeschlagen: {reason}": "{sent} sent, {failed} failed: {reason}",
    "{count} Dateien an {peer} gesendet!": "{count} files sent to {peer}!",
    "Fertig ✓": "Done ✓",
  };

  let currentLang = localStorage.getItem(LANG_KEY) === "en" ? "en" : "de";

  function t(deText, vars) {
    let str = currentLang === "en" && Object.prototype.hasOwnProperty.call(EN, deText) ? EN[deText] : deText;
    if (vars) {
      Object.keys(vars).forEach((k) => {
        str = str.split(`{${k}}`).join(vars[k]);
      });
    }
    return str;
  }

  function applyStaticI18n() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      el.title = t(el.getAttribute("data-i18n-title"));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
    });
    document.documentElement.lang = currentLang;
  }

  function setLanguage(lang) {
    currentLang = lang === "en" ? "en" : "de";
    localStorage.setItem(LANG_KEY, currentLang);
    applyStaticI18n();
    document.dispatchEvent(new CustomEvent("i18n-changed"));
  }

  window.t = t;
  window.setLanguage = setLanguage;
  window.getLanguage = () => currentLang;
  window.applyStaticI18n = applyStaticI18n;

  applyStaticI18n();

  function wireLangSwitch() {
    const wrap = document.getElementById("langSwitch");
    if (!wrap) return;
    const buttons = wrap.querySelectorAll(".lang-switch-btn");
    function refresh() {
      buttons.forEach((b) => b.classList.toggle("active", b.dataset.lang === currentLang));
    }
    buttons.forEach((b) => {
      b.addEventListener("click", () => setLanguage(b.dataset.lang));
    });
    // "i18n-changed" statt nur im Klick-Handler aktualisieren - sonst bleibt
    // der Button auf dem alten Stand stehen, wenn setLanguage() von woanders
    // aufgerufen wird (z.B. window.setLanguage direkt).
    document.addEventListener("i18n-changed", refresh);
    refresh();
  }
  // Settings-Modal ist beim Laden schon im DOM (nur per CSS "hidden"), kein
  // Warten auf ein Oeffnen noetig.
  wireLangSwitch();
})();
