/* ===== DOM Elements ===== */
const playlistList = document.getElementById("playlistList");
const playlistListEmpty = document.getElementById("playlistListEmpty");
const emptyState = document.getElementById("emptyState");
const homeView = document.getElementById("homeView");
const libraryView = document.getElementById("libraryView");
const playlistView = document.getElementById("playlistView");
const homeGreeting = document.getElementById("homeGreeting");
const recentGrid = document.getElementById("recentGrid");
const dailyMixSection = document.getElementById("dailyMixSection");
const dailyMixGrid = document.getElementById("dailyMixGrid");
const libraryGrid = document.getElementById("libraryGrid");
const navBackBtn = document.getElementById("navBackBtn");
const playlistCover = document.getElementById("playlistCover");
const playlistTitle = document.getElementById("playlistTitle");
const playlistTrackCount = document.getElementById("playlistTrackCount");
const trackTableBody = document.getElementById("trackTableBody");
const playAllBtn = document.getElementById("playAllBtn");
const shuffleAllBtn = document.getElementById("shuffleAllBtn");
const recsGrid = document.getElementById("recsGrid");
const recsRefreshBtn = document.getElementById("recsRefreshBtn");
const discoverGrid = document.getElementById("discoverGrid");
const discoverRefreshBtn = document.getElementById("discoverRefreshBtn");
const discoverArtistRows = document.getElementById("discoverArtistRows");

const renamePlaylistBtn = document.getElementById("renamePlaylistBtn");
const deletePlaylistBtn = document.getElementById("deletePlaylistBtn");
const playlistDropzone = document.getElementById("playlistView");
const libraryDropzone = document.getElementById("libraryDropzone");
const libraryFileInput = document.getElementById("libraryFileInput");
const offlineDownloadBtn = document.getElementById("offlineDownloadBtn");
const trackTable = document.getElementById("trackTable");
const bulkSelectBtn = document.getElementById("bulkSelectBtn");
const bulkEditBar = document.getElementById("bulkEditBar");
const bulkEditCount = document.getElementById("bulkEditCount");
const bulkEditSelectAllBtn = document.getElementById("bulkEditSelectAllBtn");
const bulkEditAlbumBtn = document.getElementById("bulkEditAlbumBtn");
const bulkEditCoverBtn = document.getElementById("bulkEditCoverBtn");
const bulkEditCoverInput = document.getElementById("bulkEditCoverInput");
const bulkEditCancelBtn = document.getElementById("bulkEditCancelBtn");

const searchInput = document.getElementById("searchInput");
const searchHistoryDropdown = document.getElementById("searchHistoryDropdown");
const searchView = document.getElementById("searchView");
const searchSongsGrid = document.getElementById("searchSongsGrid");
const searchPlaylistsGrid = document.getElementById("searchPlaylistsGrid");
const searchSongsSection = document.getElementById("searchSongsSection");
const searchPlaylistsSection = document.getElementById("searchPlaylistsSection");
const searchOnlineSection = document.getElementById("searchOnlineSection");
const searchNothingAtAll = document.getElementById("searchNothingAtAll");

const trashView = document.getElementById("trashView");
const trashTableBody = document.getElementById("trashTableBody");
const duplicatesView = document.getElementById("duplicatesView");
const duplicatesList = document.getElementById("duplicatesList");
const duplicatesEmpty = document.getElementById("duplicatesEmpty");
const statsView = document.getElementById("statsView");
const trashEmpty = document.getElementById("trashEmpty");

const qrToggleBtn = document.getElementById("qrToggleBtn");
const qrPopover = document.getElementById("qrPopover");
const qrImage = document.getElementById("qrImage");

const partyPopoverToggleBtn = document.getElementById("partyPopoverToggleBtn");
const partyPopover = document.getElementById("partyPopover");
const partyStatusText = document.getElementById("partyStatusText");
const partyModeBtn = document.getElementById("partyModeBtn");

const themeToggleBtn = document.getElementById("themeToggleBtn");
const themePopover = document.getElementById("themePopover");
const themeOptionBtns = document.querySelectorAll(".theme-option");

const settingsToggleBtn = document.getElementById("settingsToggleBtn");
const settingsModal = document.getElementById("settingsModal");
const settingsModalClose = document.getElementById("settingsModalClose");
const glowToggleSwitch = document.getElementById("glowToggleSwitch");
const crossfadeToggleSwitch = document.getElementById("crossfadeToggleSwitch");
const syncAutoStartToggleSwitch = document.getElementById("syncAutoStartToggleSwitch");
const clearLyricsCacheBtn = document.getElementById("clearLyricsCacheBtn");
const appVersionText = document.getElementById("appVersionText");
const hotkeyList = document.getElementById("hotkeyList");

const pbLyrics = document.getElementById("pbLyrics");
const lyricsOverlay = document.getElementById("lyricsOverlay");
const lyricsTitle = document.getElementById("lyricsTitle");
const lyricsArtist = document.getElementById("lyricsArtist");
const lyricsBody = document.getElementById("lyricsBody");
const lyricsCloseBtn = document.getElementById("lyricsCloseBtn");
const lyricsSyncMinus = document.getElementById("lyricsSyncMinus");
const lyricsSyncPlus = document.getElementById("lyricsSyncPlus");
const lyricsSyncReadout = document.getElementById("lyricsSyncReadout");

const confirmModal = document.getElementById("confirmModal");
const confirmModalTitle = document.getElementById("confirmModalTitle");
const confirmModalText = document.getElementById("confirmModalText");
const confirmModalOk = document.getElementById("confirmModalOk");
const confirmModalCancel = document.getElementById("confirmModalCancel");
const confirmModalClose = document.getElementById("confirmModalClose");

const renameModal = document.getElementById("renameModal");
const renameInput = document.getElementById("renameInput");
const renameModalOk = document.getElementById("renameModalOk");
const renameModalCancel = document.getElementById("renameModalCancel");
const renameModalClose = document.getElementById("renameModalClose");

const uploadToast = document.getElementById("uploadToast");

const pbCover = document.getElementById("pbCover");
const pbTitle = document.getElementById("pbTitle");
const pbArtist = document.getElementById("pbArtist");
const pbLike = document.getElementById("pbLike");
const pbShuffle = document.getElementById("pbShuffle");
const pbPrev = document.getElementById("pbPrev");
const pbPlay = document.getElementById("pbPlay");
const pbNext = document.getElementById("pbNext");
const pbRepeat = document.getElementById("pbRepeat");
const pbTimeCurrent = document.getElementById("pbTimeCurrent");
const pbTimeTotal = document.getElementById("pbTimeTotal");
const pbProgressWrap = document.getElementById("pbProgressWrap");
const pbProgressBar = document.getElementById("pbProgressBar");
const pbProgressHandle = document.getElementById("pbProgressHandle");
const pbVolumeWrap = document.getElementById("pbVolumeWrap");
const pbVolumeBar = document.getElementById("pbVolumeBar");
const pbVolumeHandle = document.getElementById("pbVolumeHandle");
const pbVolIcon = document.getElementById("pbVolIcon");
/* ===== Dual-Audio für echtes Crossfade =====
   Zwei <audio>-Elemente wechseln sich als "aktives" Element ab: während
   die letzten CROSSFADE_SECONDS eines Songs laufen, spielt das jeweils
   andere Element den nächsten Titel schon überlappend an (eigener Gain im
   Web-Audio-Graph rampt hoch, der des sterbenden Songs runter). Beim
   ended-Event wird nur noch die Rolle getauscht - lückenlos.

   `audioEl` bleibt die EINE Variable, über die der gesamte restliche Code
   (Scrubber, Events, Fehler-Retry, nowplaying-native.js, tauri-shim.js)
   das aktive Element anspricht - der Tausch ist für alle transparent.
   Damit Event-Handler nach einem Rollentausch weiter funktionieren,
   registriert der addEventListener-Wrapper unten jeden Handler auf BEIDEN
   Elementen und lässt ihn nur feuern, wenn das Event vom gerade aktiven
   Element kommt. Kein einziger bestehender addEventListener-Aufruf muss
   dafür angefasst werden. */
const audioElA = document.getElementById("audioEl");
const audioElB = document.createElement("audio");
audioElB.preload = "auto";
audioElB.crossOrigin = "anonymous";
document.body.appendChild(audioElB);
let audioEl = audioElA;

{
  const origAddA = audioElA.addEventListener.bind(audioElA);
  const origAddB = audioElB.addEventListener.bind(audioElB);
  const origRemA = audioElA.removeEventListener.bind(audioElA);
  const origRemB = audioElB.removeEventListener.bind(audioElB);
  const wrapMap = new Map();
  const bindBoth = function (type, fn, opts) {
    if (typeof fn !== "function") return;
    // {once:true}-Listener (z.B. der "weiter hören"-Resume-Seek in
    // playTrack, jedes Mal eine neue Closure bei langen Tracks) entfernt
    // der Browser nach dem Feuern selbststaendig von den echten Elementen -
    // ruft dabei aber nie removeBoth() auf, also blieb der fn->wrapped-
    // Eintrag hier fuer immer in der Map (Leak über eine lange Session).
    // Bei jedem Feuern eines once-Listeners sich also selbst austragen.
    const isOnce = !!(opts && typeof opts === "object" && opts.once);
    let wrapped = wrapMap.get(fn);
    if (!wrapped) {
      wrapped = function (e) {
        if (isOnce) wrapMap.delete(fn);
        if (e.currentTarget !== audioEl) return;
        return fn.call(e.currentTarget, e);
      };
      wrapMap.set(fn, wrapped);
    }
    origAddA(type, wrapped, opts);
    origAddB(type, wrapped, opts);
  };
  const removeBoth = function (type, fn, opts) {
    const wrapped = wrapMap.get(fn);
    if (!wrapped) return;
    origRemA(type, wrapped, opts);
    origRemB(type, wrapped, opts);
    wrapMap.delete(fn);
  };
  audioElA.addEventListener = bindBoth;
  audioElB.addEventListener = bindBoth;
  audioElA.removeEventListener = removeBoth;
  audioElB.removeEventListener = removeBoth;
}

const otherAudioEl = () => (audioEl === audioElA ? audioElB : audioElA);

const PLACEHOLDER_COVER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' +
      '<rect width="200" height="200" fill="#282828"/>' +
      '<text x="50%" y="54%" font-size="70" text-anchor="middle" dominant-baseline="middle">🎵</text>' +
      "</svg>"
  );

/* ===== State ===== */
let library = [];
let currentPlaylist = null;
let currentTrackIndex = -1;
let isShuffle = false;
let repeatMode = "off"; // off -> all -> one -> off
let shuffleOrder = [];
let lastShuffleOrder = []; // so a reshuffle never lands on the exact same order twice in a row
let recentlyPlayed = []; // track indices heard lately, oldest first - keeps freshly (re)shuffled order from immediately repeating them
let prefetchedNextForTrack = -1; // guards the 80%-progress re-check below from firing more than once per track
let isLiked = false;
let currentView = "home"; // home | library | playlist
let previousView = "home"; // where the back arrow returns to from playlist view
let nowPlayingMeta = null; // {playlist, file, title, artist, cover, stream_url} - feeds party-mode heartbeat
let liveQueue = []; // collaborative queue from guest phones, kept in sync via SSE
let userQueue = []; // eigene "Als nächstes"-Warteschlange (3-Punkte-Menü pro Track), volle Metadaten-Snapshots
let queueResumeIndex = -1; // Playlist-Position vor dem Abzweig in die Queue - nextTrack() macht dort weiter

/* ===== Play-Counter (Grundlage für "Daily Mix") =====
   Zählt einen Track ab 50% Wiedergabe als "gehört" - reines lokales
   Zählen, kein Server-Roundtrip nötig, dieselbe localStorage-Konvention
   wie Resume-Positionen/Crossfade-Setting usw. */
const PLAY_COUNTS_KEY = "playCounts";

function playCountStorageKey(playlistName, file) {
  return `${playlistName || ""}::${file || ""}`;
}
function loadPlayCounts() {
  try {
    return JSON.parse(localStorage.getItem(PLAY_COUNTS_KEY) || "{}");
  } catch (_) {
    return {};
  }
}
function bumpPlayCount(playlistName, file) {
  if (!playlistName || !file) return;
  const map = loadPlayCounts();
  const key = playCountStorageKey(playlistName, file);
  map[key] = (map[key] || 0) + 1;
  localStorage.setItem(PLAY_COUNTS_KEY, JSON.stringify(map));
}

let playCountedForTrack = null; // verhindert Mehrfachzählung innerhalb desselben Songs
audioEl.addEventListener("timeupdate", () => {
  if (!nowPlayingMeta || !audioEl.duration || !isFinite(audioEl.duration)) return;
  const key = playCountStorageKey(nowPlayingMeta.playlist, nowPlayingMeta.file);
  if (key === playCountedForTrack) return;
  if (audioEl.currentTime / audioEl.duration >= 0.5) {
    playCountedForTrack = key;
    bumpPlayCount(nowPlayingMeta.playlist, nowPlayingMeta.file);
  }
});

/* ===== Hörzeit gesamt (für die Statistik-Seite) =====
   Summiert echte Wiedergabezeit, nicht Wanduhrzeit - "timeupdate" feuert
   nur während tatsächlich abgespielt wird (nicht während Pause), und ein
   Delta > 2s (Seek/Trackwechsel) wird verworfen statt mitgezählt. */
const LISTEN_TIME_KEY = "totalListenSeconds";
let lastListenTick = null;
audioEl.addEventListener("timeupdate", () => {
  if (audioEl.paused) return;
  if (lastListenTick !== null) {
    const delta = audioEl.currentTime - lastListenTick;
    if (delta > 0 && delta < 2) {
      const total = Number(localStorage.getItem(LISTEN_TIME_KEY)) || 0;
      localStorage.setItem(LISTEN_TIME_KEY, String(total + delta));
    }
  }
  lastListenTick = audioEl.currentTime;
});
audioEl.addEventListener("pause", () => { lastListenTick = null; });
audioEl.addEventListener("seeked", () => { lastListenTick = audioEl.currentTime; });

/* ===== Weiter hören =====
   Lange Tracks (Mixes/DJ-Sets/Podcast-artige Downloads) sollen beim
   erneuten Öffnen dort fortsetzen, wo man aufgehört hat, statt bei 0 neu
   zu starten. Kurze normale Songs (der Regelfall) bleiben unangetastet -
   niemand will bei einem 3-Minuten-Song "weiterhören" statt ihn von vorne
   zu hören. */
const RESUME_KEY = "resumePositions";
const RESUME_THRESHOLD_SECONDS = 480; // 8 Minuten

function resumeStorageKey(playlistName, file) {
  return `${playlistName || ""}::${file || ""}`;
}
function loadResumeMap() {
  try {
    return JSON.parse(localStorage.getItem(RESUME_KEY) || "{}");
  } catch (_) {
    return {};
  }
}
function getResumePosition(playlistName, file) {
  return loadResumeMap()[resumeStorageKey(playlistName, file)] || 0;
}
function setResumePosition(playlistName, file, pos) {
  const map = loadResumeMap();
  const key = resumeStorageKey(playlistName, file);
  // Unter 10s oder praktisch durchgelaufen: Eintrag löschen statt einer
  // Position, die beim nächsten Mal sofort wieder "fertig" ist.
  if (pos < 10) delete map[key];
  else map[key] = pos;
  localStorage.setItem(RESUME_KEY, JSON.stringify(map));
}
function clearResumePosition(playlistName, file) {
  const map = loadResumeMap();
  delete map[resumeStorageKey(playlistName, file)];
  localStorage.setItem(RESUME_KEY, JSON.stringify(map));
}

/* ===== Helpers ===== */
function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function coverFor(track) {
  return track && track.cover ? track.cover : PLACEHOLDER_COVER;
}

/* ===== Load Library =====
   refreshLibrary() re-fetches and re-renders in place, without changing
   whatever view the user is currently looking at - loadLibrary() is only
   for the initial page load, which does want to land on Home. */
async function refreshLibrary() {
  try {
    const res = await fetch("/api/library");
    const data = await res.json();
    library = data.playlists || [];
  } catch (_) {
    library = [];
  }
  renderSidebar();
  if (library.length) {
    renderHome();
    renderLibraryGrid();
  }
}

async function loadLibrary() {
  await refreshLibrary();
  showView("home");
  // Songtexte der GESAMTEN Bibliothek im Hintergrund vorladen (Rust-Datei-
  // Cache macht das ab dem zweiten App-Start netzwerkfrei und praktisch
  // kostenlos) - Lyrics sind dann überall sofort da, nicht erst nach dem
  // Öffnen der jeweiligen Playlist. Ein späteres selectPlaylist() bricht
  // diesen Durchlauf ab und priorisiert die geöffnete Playlist.
  const all = { name: "", tracks: [] };
  for (const pl of library) {
    for (const t of pl.tracks || []) {
      all.tracks.push({ ...t, __pl: pl.name });
    }
  }
  if (all.tracks.length) {
    const token = ++playlistPrefetchToken;
    const queue = all.tracks;
    const worker = async () => {
      while (queue.length && token === playlistPrefetchToken) {
        const t = queue.shift();
        if (!t || !t.title) continue;
        try {
          await fetchLyricsData(t.__pl, t.file, t.title, t.artist, t.duration);
        } catch (_) { /* einzelner Fehlschlag stoppt den Rest nicht */ }
      }
    };
    for (let i = 0; i < 2; i++) worker();
  }
}

/* ===== View Switching ===== */
function showView(view) {
  // Trash/Duplikate/Statistik müssen auch bei leerer Bibliothek erreichbar
  // bleiben (Trash: alles könnte im Papierkorb liegen; Statistik/Duplikate:
  // sollen einfach "nichts da" anzeigen statt hinter dem Empty-State
  // verschwinden).
  const alwaysReachable = view === "trash" || view === "duplicates" || view === "stats";
  if (!library.length && !alwaysReachable) {
    emptyState.classList.remove("hidden");
    homeView.classList.add("hidden");
    libraryView.classList.add("hidden");
    playlistView.classList.add("hidden");
    trashView.classList.add("hidden");
    duplicatesView.classList.add("hidden");
    statsView.classList.add("hidden");
    navBackBtn.disabled = true;
    return;
  }

  emptyState.classList.add("hidden");
  homeView.classList.toggle("hidden", view !== "home");
  libraryView.classList.toggle("hidden", view !== "library");
  playlistView.classList.toggle("hidden", view !== "playlist");
  trashView.classList.toggle("hidden", view !== "trash");
  duplicatesView.classList.toggle("hidden", view !== "duplicates");
  statsView.classList.toggle("hidden", view !== "stats");

  document.querySelectorAll(".nav-item[data-view]").forEach((el) => {
    el.classList.toggle("active", el.dataset.view === view);
  });

  if (view !== "playlist") {
    previousView = view;
    playlistList.querySelectorAll(".playlist-item").forEach((el) => el.classList.remove("active"));
  }
  navBackBtn.disabled = view !== "playlist";
  if (view === "trash") loadTrash();
  if (view === "duplicates") loadDuplicates();
  if (view === "stats") renderStats();

  currentView = view;
}

navBackBtn.addEventListener("click", () => showView(previousView));

document.querySelectorAll(".nav-item[data-view]").forEach((el) => {
  el.addEventListener("click", () => showView(el.dataset.view));
});

/* ===== Home View ===== */
function greetingForNow() {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "Guten Morgen";
  if (h >= 11 && h < 18) return "Guten Tag";
  if (h >= 18 && h < 22) return "Guten Abend";
  return "Gute Nacht";
}

function renderHome() {
  homeGreeting.textContent = greetingForNow();

  const allTracks = [];
  library.forEach((pl, plIdx) => {
    pl.tracks.forEach((t, trackIdx) => {
      allTracks.push({ track: t, plIdx, trackIdx });
    });
  });
  allTracks.sort((a, b) => (b.track.added || 0) - (a.track.added || 0));
  const recent = allTracks.slice(0, 12);

  recentGrid.innerHTML = "";
  recent.forEach(({ track, plIdx, trackIdx }) => {
    const card = document.createElement("div");
    card.className = "card";

    const coverWrap = document.createElement("div");
    coverWrap.className = "card-cover-wrap";
    const img = document.createElement("img");
    img.className = "card-cover";
    img.src = coverFor(track);
    img.alt = "";
    const playBtn = document.createElement("button");
    playBtn.className = "card-play-btn";
    playBtn.textContent = "▶";
    playBtn.title = "Abspielen";
    playBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      playTrackIn(plIdx, trackIdx);
    });
    coverWrap.append(img, playBtn);
    attachAddButton(coverWrap, { source_playlist: library[plIdx].name, filename: track.file });

    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = track.title;
    const sub = document.createElement("div");
    sub.className = "card-sub";
    sub.textContent = track.artist || "Unbekannter Interpret";

    card.append(coverWrap, title, sub);
    card.addEventListener("click", () => playTrackIn(plIdx, trackIdx));
    recentGrid.appendChild(card);
  });

  renderDailyMix();
  renderMoodSection();
  loadDiscover();
  loadDiscoverArtistRows();
}

/* ===== Daily Mix (Home) =====
   Top-Titel nach lokalem Play-Counter (bumpPlayCount, siehe oben) - rein
   clientseitig, kein Server-Konzept dahinter. Bewusst nicht "pro Tag neu
   gemischt" (kein Mehrwert ohne echte Hoergeschichte über Zeit) - zeigt
   einfach die aktuell meistgehörten Titel als klickbare Karten, wie die
   anderen Home-Bereiche. */
function renderDailyMix() {
  const counts = loadPlayCounts();
  const entries = Object.keys(counts)
    .map((key) => ({ key, count: counts[key] }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  dailyMixSection.classList.toggle("hidden", !entries.length);
  if (!entries.length) return;

  dailyMixGrid.innerHTML = "";
  entries.forEach(({ key, count }) => {
    const sep = key.lastIndexOf("::");
    const plName = key.slice(0, sep);
    const file = key.slice(sep + 2);
    const plIdx = library.findIndex((pl) => pl.name === plName);
    if (plIdx === -1) return;
    const trackIdx = library[plIdx].tracks.findIndex((t) => t.file === file);
    if (trackIdx === -1) return;
    const track = library[plIdx].tracks[trackIdx];

    const card = document.createElement("div");
    card.className = "card";
    const coverWrap = document.createElement("div");
    coverWrap.className = "card-cover-wrap";
    const img = document.createElement("img");
    img.className = "card-cover";
    img.src = coverFor(track);
    img.alt = "";
    const playBtn = document.createElement("button");
    playBtn.className = "card-play-btn";
    playBtn.textContent = "▶";
    playBtn.title = "Abspielen";
    playBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      playTrackIn(plIdx, trackIdx);
    });
    coverWrap.append(img, playBtn);

    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = track.title;
    const sub = document.createElement("div");
    sub.className = "card-sub";
    sub.textContent = `${count}× gehört`;

    card.append(coverWrap, title, sub);
    card.addEventListener("click", () => playTrackIn(plIdx, trackIdx));
    dailyMixGrid.appendChild(card);
  });
}

/* ===== Statistik-Seite =====
   Nutzt dieselben lokalen Play-Counts wie Daily Mix (loadPlayCounts) plus
   die kumulierte Hörzeit (LISTEN_TIME_KEY, siehe oben) - keine eigene
   Datenquelle, nur eine andere Aufbereitung derselben Zahlen. */
function fmtListenTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function findTrackByPlayCountKey(key) {
  const sep = key.lastIndexOf("::");
  const plName = key.slice(0, sep);
  const file = key.slice(sep + 2);
  const pl = library.find((p) => p.name === plName);
  const track = pl && pl.tracks.find((t) => t.file === file);
  return track || null;
}

function renderStatsList(el, rows) {
  el.innerHTML = "";
  if (!rows.length) {
    el.innerHTML = '<div class="card-sub" style="padding:8px 0;">Noch keine Wiedergaben.</div>';
    return;
  }
  rows.forEach(([label, count], i) => {
    const row = document.createElement("div");
    row.className = "stats-list-row";
    const rank = document.createElement("span");
    rank.className = "stats-list-rank";
    rank.textContent = `${i + 1}.`;
    const labelEl = document.createElement("span");
    labelEl.className = "stats-list-label";
    labelEl.textContent = label;
    const countEl = document.createElement("span");
    countEl.className = "stats-list-count";
    countEl.textContent = `${count}×`;
    row.append(rank, labelEl, countEl);
    el.appendChild(row);
  });
}

function renderStats() {
  const totalSeconds = Number(localStorage.getItem(LISTEN_TIME_KEY)) || 0;
  document.getElementById("statsTotalListenTime").textContent = fmtListenTime(totalSeconds);

  const counts = loadPlayCounts();
  const withTracks = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({ track: findTrackByPlayCountKey(key), count }))
    .filter((e) => e.track);

  document.getElementById("statsTotalPlays").textContent = String(
    withTracks.reduce((sum, e) => sum + e.count, 0)
  );

  const topSongs = withTracks
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((e) => [`${e.track.title} — ${e.track.artist || "Unbekannter Interpret"}`, e.count]);
  renderStatsList(document.getElementById("statsTopSongs"), topSongs);

  const artistCounts = new Map();
  withTracks.forEach((e) => {
    const artist = e.track.artist || "Unbekannter Interpret";
    artistCounts.set(artist, (artistCounts.get(artist) || 0) + e.count);
  });
  const topArtists = [...artistCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  renderStatsList(document.getElementById("statsTopArtists"), topArtists);
}

/* ===== Mood-Playlists (Home) =====
   Keine echte Audio-Analyse (BPM/Energy) - würde einen schweren Decoder
   als neue Rust-Abhängigkeit brauchen (Cross-Compile-Risiko, siehe
   Kommentar bei normalizerCompressor). Stattdessen: Titel/Album-Text nach
   Stimmungs-Stichworten durchsucht, alles ohne Treffer wird deterministisch
   (Hash des Dateinamens, kein Zufall bei jedem Rendern) gleichmäßig auf
   die drei Stimmungen verteilt, damit jede Stimmung auch bei einer
   Bibliothek ohne passende Stichworte im Titel gefüllt ist. */
const MOOD_DEFS = [
  { id: "chill", label: "😌 Chill", keywords: ["chill", "acoustic", "lofi", "lo-fi", "slowed", "piano", "ballad", "unplugged", "relax", "calm", "sad"] },
  { id: "workout", label: "💪 Workout", keywords: ["workout", "gym", "pump", "hardstyle", "phonk", "hard", "energy", "hype", "bass boosted"] },
  { id: "party", label: "🎉 Party", keywords: ["party", "dance", "club", "remix", "edm", "banger", "hits"] },
];

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function buildMoodBuckets() {
  const buckets = { chill: [], workout: [], party: [] };
  const unmatched = [];
  library.forEach((pl, plIdx) => {
    pl.tracks.forEach((t, trackIdx) => {
      const text = `${t.title} ${t.album || ""}`.toLowerCase();
      const hit = MOOD_DEFS.find((m) => m.keywords.some((kw) => text.includes(kw)));
      const entry = { track: t, plIdx, trackIdx };
      if (hit) buckets[hit.id].push(entry);
      else unmatched.push(entry);
    });
  });
  unmatched.forEach((entry) => {
    const mood = MOOD_DEFS[hashStr(entry.track.file) % MOOD_DEFS.length];
    buckets[mood.id].push(entry);
  });
  return buckets;
}

function playMoodPlaylist(entries) {
  if (!entries.length) return;
  const shuffled = entries.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const [first, ...rest] = shuffled;
  playTrackIn(first.plIdx, first.trackIdx);
  userQueue = rest.map((e) => queueEntryForTrack(e.track, library[e.plIdx].name));
  renderQueuePanel();
}

// queueEntryFor() (siehe Warteschlange weiter unten) geht von currentPlaylist
// aus - hier kommen die Tracks aber potenziell aus VIELEN verschiedenen
// Playlists, deshalb eine eigene kleine Variante mit explizitem Playlist-Namen.
function queueEntryForTrack(track, playlistName) {
  return {
    title: track.title,
    artist: track.artist || "",
    cover: track.cover || "",
    stream_url: track.stream_url,
    playlist: playlistName,
    file: track.file || "",
  };
}

function renderMoodSection() {
  const grid = document.getElementById("moodGrid");
  const section = document.getElementById("moodSection");
  if (!grid || !section) return;
  const buckets = buildMoodBuckets();
  const hasAny = MOOD_DEFS.some((m) => buckets[m.id].length);
  section.classList.toggle("hidden", !hasAny);
  if (!hasAny) return;

  grid.innerHTML = "";
  MOOD_DEFS.forEach((m) => {
    const entries = buckets[m.id];
    if (!entries.length) return;
    const card = document.createElement("div");
    card.className = `mood-card mood-card-${m.id}`;
    const title = document.createElement("div");
    title.className = "mood-card-title";
    title.textContent = m.label;
    const count = document.createElement("div");
    count.className = "mood-card-count";
    count.textContent = `${entries.length} Songs`;
    card.append(title, count);
    card.addEventListener("click", () => playMoodPlaylist(entries));
    grid.appendChild(card);
  });
}

/* ===== Discover (Home screen - download straight into the library) ===== */
let currentDiscoverIds = [];

async function loadDiscover(excludeIds) {
  const params = new URLSearchParams();
  if (excludeIds && excludeIds.length) params.set("exclude", excludeIds.join(","));

  let recs = [];
  try {
    const res = await fetch(`/api/library/discover?${params.toString()}`);
    const data = await res.json();
    recs = data.recommendations || [];
  } catch (_) {
    recs = [];
  }
  currentDiscoverIds = recs.map((r) => r.video_id);
  renderDiscover(recs);
}

/* Shared card builder for any "found online, not downloaded yet" result -
   used by the generic Discover row, the per-artist rows, and the search
   view's online results, so all three look and behave identically. */
function buildDiscoverCard(rec) {
  const card = document.createElement("div");
  card.className = "card";
  card.title = `${rec.title}${rec.artist ? " – " + rec.artist : ""}\nAuf YouTube ansehen`;

  const coverWrap = document.createElement("div");
  coverWrap.className = "card-cover-wrap";
  const img = document.createElement("img");
  img.className = "card-cover";
  img.src = rec.cover || PLACEHOLDER_COVER;
  img.alt = "";
  const dlBtn = document.createElement("button");
  dlBtn.className = "card-download-btn";
  dlBtn.textContent = "⬇";
  dlBtn.title = "In Bibliothek herunterladen";
  dlBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    downloadDiscoverTrack(rec, dlBtn);
  });
  const watchBtn = document.createElement("button");
  watchBtn.className = "card-watch-btn";
  watchBtn.textContent = "▶";
  watchBtn.title = "Video direkt ansehen (ohne Download)";
  watchBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openVideoPreview(rec.video_id, rec.title);
  });
  coverWrap.append(img, watchBtn, dlBtn);
  attachAddButton(coverWrap, {
    video_id: rec.video_id,
    title: rec.title,
    uploader: rec.artist,
    duration: rec.duration,
    thumbnail: rec.cover,
  });

  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = rec.title;
  const sub = document.createElement("div");
  sub.className = "card-sub";
  sub.textContent = rec.artist || "Unbekannter Interpret";

  card.append(coverWrap, title, sub);
  card.addEventListener("click", () => window.open(rec.url, "_blank", "noopener"));
  return card;
}

function renderDiscover(recs) {
  discoverGrid.innerHTML = "";
  if (!recs.length) {
    const empty = document.createElement("div");
    empty.className = "card-sub";
    empty.textContent = "Gerade keine Vorschläge gefunden.";
    discoverGrid.appendChild(empty);
    return;
  }
  recs.forEach((rec) => discoverGrid.appendChild(buildDiscoverCard(rec)));
}

/* Per-artist "Mehr von <Artist>" shelves - one row per top artist in the
   library, each with its own grid, in the same visual language as the
   generic Discover row above. */
async function loadDiscoverArtistRows(excludeIds) {
  const params = new URLSearchParams();
  if (excludeIds && excludeIds.length) params.set("exclude", excludeIds.join(","));
  let rows = [];
  try {
    const res = await fetch(`/api/library/discover-rows?${params.toString()}`);
    const data = await res.json();
    rows = data.rows || [];
  } catch (_) {
    rows = [];
  }
  renderDiscoverArtistRows(rows);
}

function renderDiscoverArtistRows(rows) {
  discoverArtistRows.innerHTML = "";
  rows.forEach((row) => {
    const section = document.createElement("section");
    section.className = "home-section";
    const h2 = document.createElement("h2");
    h2.className = "home-section-title";
    h2.textContent = row.title;
    const grid = document.createElement("div");
    grid.className = "card-grid recs-grid";
    row.recommendations.forEach((rec) => grid.appendChild(buildDiscoverCard(rec)));
    section.append(h2, grid);
    discoverArtistRows.appendChild(section);
  });
}

/* Geteilt mit downloader.js über denselben localStorage-Key: die
   Downloader-Seite ist die einzige Stelle mit echter Format/Qualitäts-
   Auswahl - diese Schnell-Download-Wege (Discover-⬇, "Zu Playlist
   hinzufügen" aus der Suche) haben keine eigene UI dafür und übernehmen
   stattdessen automatisch, was der Nutzer dort zuletzt gewählt hat. */
const QUALITY_PRESET_KEY = "downloadQualityPreset";
function getQualityPreset() {
  try {
    const p = JSON.parse(localStorage.getItem(QUALITY_PRESET_KEY) || "null");
    if (p && (p.format === "mp3" || p.format === "mp4")) return p;
  } catch (_) { /* fällt durch auf Standard */ }
  return { format: "mp3", bitrate: "320", quality: "best" };
}

async function downloadDiscoverTrack(rec, btn) {
  btn.disabled = true;
  btn.textContent = "⏳";
  try {
    const preset = getQualityPreset();
    const res = await fetch("/api/library/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: rec.video_id,
        title: rec.title,
        uploader: rec.artist,
        duration: rec.duration,
        thumbnail: rec.cover,
        playlist: "Entdeckt",
        format: preset.format,
        bitrate: preset.bitrate,
        quality: preset.quality,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Download fehlgeschlagen.");
    btn.textContent = "✓";
    btn.classList.add("done");
    showToast(`⬇ „${rec.title}" in „Entdeckt" gespeichert`);
    await refreshLibrary();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "⬇";
    showToast(err.message || "Download fehlgeschlagen.");
  }
}

discoverRefreshBtn.addEventListener("click", async () => {
  discoverRefreshBtn.classList.add("spinning");
  discoverGrid.classList.add("swapping");
  await loadDiscover(currentDiscoverIds);
  discoverGrid.classList.remove("swapping");
  setTimeout(() => discoverRefreshBtn.classList.remove("spinning"), 600);
});

/* ===== Library View ===== */
function renderLibraryGrid() {
  // libraryDropzone lives inside this same grid as a static element in the
  // HTML - clearing the whole container would delete it, so only the
  // dynamically-added playlist cards get removed and re-inserted.
  libraryGrid.querySelectorAll(".card:not(.card-dropzone)").forEach((el) => el.remove());
  library.forEach((pl, idx) => {
    const card = document.createElement("div");
    card.className = "card";

    const coverWrap = document.createElement("div");
    coverWrap.className = "card-cover-wrap";
    const img = document.createElement("img");
    img.className = "card-cover";
    img.src = pl.cover || PLACEHOLDER_COVER;
    img.alt = "";
    const playBtn = document.createElement("button");
    playBtn.className = "card-play-btn";
    playBtn.textContent = "▶";
    playBtn.title = "Abspielen";
    playBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      selectPlaylist(idx);
      if (pl.tracks.length) playTrack(0);
    });
    coverWrap.append(img, playBtn);

    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = pl.name;
    const sub = document.createElement("div");
    sub.className = "card-sub";
    sub.textContent = `${pl.tracks.length} Titel`;

    card.append(coverWrap, title, sub);
    card.addEventListener("click", () => selectPlaylist(idx));
    libraryGrid.insertBefore(card, libraryDropzone);
  });
}

/* Play a track that lives in a specific playlist, keeping next/prev in that playlist's context. */
function playTrackIn(plIdx, trackIdx) {
  // Gleicher Track wie der gerade geladene: pausieren/fortsetzen statt
  // neu starten (Karten auf Home/Suche + Suchergebnisse laufen hierüber).
  const target = library[plIdx] && library[plIdx].tracks[trackIdx];
  if (target && nowPlayingMeta && nowPlayingMeta.stream_url === target.stream_url) {
    togglePlayPause();
    return;
  }
  currentPlaylist = library[plIdx];
  playlistList.querySelectorAll(".playlist-item").forEach((el, i) => {
    el.classList.toggle("active", i === plIdx);
  });
  playTrack(trackIdx);
  // Shuffle order still describes the previous playlist's indices at this
  // point - rebuild it against the new context (with the just-started
  // track up front) so next/prev can't jump to stale positions or replay
  // songs twice.
  if (isShuffle) buildShuffleOrder();
}

/* ===== Sidebar ===== */
function renderSidebar() {
  playlistList.innerHTML = "";
  if (!library.length) {
    playlistListEmpty.classList.remove("hidden");
    return;
  }
  playlistListEmpty.classList.add("hidden");
  library.forEach((pl, idx) => {
    const btn = document.createElement("button");
    btn.className = "playlist-item";
    btn.dataset.index = idx;

    const img = document.createElement("img");
    img.className = "playlist-item-cover";
    img.src = pl.cover || PLACEHOLDER_COVER;
    img.alt = "";

    const info = document.createElement("div");
    info.className = "playlist-item-info";
    const name = document.createElement("div");
    name.className = "playlist-item-name";
    name.textContent = pl.name;
    const count = document.createElement("div");
    count.className = "playlist-item-count";
    count.textContent = `${pl.tracks.length} Titel`;
    info.append(name, count);

    btn.append(img, info);
    btn.addEventListener("click", () => selectPlaylist(idx));
    playlistList.appendChild(btn);
  });
}

function selectPlaylist(idx) {
  currentPlaylist = library[idx];
  if (!currentPlaylist) return;
  if (bulkSelectMode) setBulkSelectMode(false);

  const cameFrom = currentView === "playlist" ? previousView : currentView;
  showView("playlist");
  previousView = cameFrom;

  playlistList.querySelectorAll(".playlist-item").forEach((el, i) => {
    el.classList.toggle("active", i === idx);
  });

  playlistCover.src = currentPlaylist.cover || PLACEHOLDER_COVER;
  playlistTitle.textContent = currentPlaylist.name;
  playlistTrackCount.textContent = `${currentPlaylist.tracks.length} Titel`;
  // Keep the shuffle *setting* across playlist switches, but regenerate
  // the order for the new playlist - the old order's indices belong to a
  // different track list and would freeze/duplicate the queue. Same for
  // recentlyPlayed: those indices belong to the OLD playlist's track
  // list too and would otherwise steer the new shuffle by coincidence.
  recentlyPlayed = [];
  if (isShuffle) buildShuffleOrder();
  renderTrackTable();
  loadRecommendations();
  // Alle Songtexte dieser Playlist sofort im Hintergrund vorladen - beim
  // Mikro-Klick kommen sie dann verzögerungsfrei aus dem Memory-Cache.
  prefetchPlaylistLyrics(currentPlaylist);
}

/* ===== Confirm / Rename Modals ===== */
let confirmCallback = null;
function showConfirmModal(title, text, onConfirm) {
  confirmModalTitle.textContent = title;
  confirmModalText.textContent = text;
  confirmCallback = onConfirm;
  confirmModal.classList.remove("hidden");
}
function hideConfirmModal() {
  confirmModal.classList.add("hidden");
  confirmCallback = null;
}
confirmModalOk.addEventListener("click", () => {
  const cb = confirmCallback;
  hideConfirmModal();
  if (cb) cb();
});
confirmModalCancel.addEventListener("click", hideConfirmModal);
confirmModalClose.addEventListener("click", hideConfirmModal);
confirmModal.addEventListener("click", (e) => {
  if (e.target === confirmModal) hideConfirmModal();
});

let renameCallback = null;
function showRenameModal(currentName, onSave) {
  renameInput.value = currentName;
  renameCallback = onSave;
  renameModal.classList.remove("hidden");
  renameInput.focus();
  renameInput.select();
}
function hideRenameModal() {
  renameModal.classList.add("hidden");
  renameCallback = null;
}
renameModalOk.addEventListener("click", () => {
  const value = renameInput.value.trim();
  const cb = renameCallback;
  hideRenameModal();
  if (cb && value) cb(value);
});
renameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") renameModalOk.click();
  if (e.key === "Escape") hideRenameModal();
});
renameModalCancel.addEventListener("click", hideRenameModal);
renameModalClose.addEventListener("click", hideRenameModal);
renameModal.addEventListener("click", (e) => {
  if (e.target === renameModal) hideRenameModal();
});

/* ===== Playlist Delete / Rename ===== */
deletePlaylistBtn.addEventListener("click", () => {
  if (!currentPlaylist) return;
  showConfirmModal(
    "Playlist löschen?",
    `„${currentPlaylist.name}" mit ${currentPlaylist.tracks.length} Titeln wird unwiderruflich gelöscht.`,
    async () => {
      try {
        const res = await fetch(`/api/library/playlist/${encodeURIComponent(currentPlaylist.name)}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Löschen fehlgeschlagen.");
        showToast("🗑 Playlist gelöscht");
        await refreshLibrary();
        showView("library");
      } catch (err) {
        showToast(err.message || "Löschen fehlgeschlagen.");
      }
    }
  );
});

renamePlaylistBtn.addEventListener("click", () => {
  if (!currentPlaylist) return;
  showRenameModal(currentPlaylist.name, async (newName) => {
    const oldName = currentPlaylist.name;
    try {
      const res = await fetch(`/api/library/playlist/${encodeURIComponent(oldName)}/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_name: newName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Umbenennen fehlgeschlagen.");
      showToast("✏️ Playlist umbenannt");
      await refreshLibrary();
      const idx = library.findIndex((p) => p.name === data.name);
      if (idx !== -1) selectPlaylist(idx);
    } catch (err) {
      showToast(err.message || "Umbenennen fehlgeschlagen.");
    }
  });
});

/* ===== Track Removal ===== */
async function deleteTrack(index) {
  if (!currentPlaylist || !currentPlaylist.tracks[index]) return;
  const track = currentPlaylist.tracks[index];
  const playlistName = currentPlaylist.name;
  try {
    const res = await fetch(
      `/api/library/track/${encodeURIComponent(playlistName)}/${encodeURIComponent(track.file)}`,
      { method: "DELETE" }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Löschen fehlgeschlagen.");
    showToast(`🗑 „${track.title}" entfernt`);
    if (index === currentTrackIndex) {
      audioEl.pause();
      audioEl.removeAttribute("src");
      currentTrackIndex = -1;
      nowPlayingMeta = null;
      updatePlayButton(false);
      pbTitle.textContent = "Kein Titel ausgewählt";
      pbArtist.textContent = "—";
      updateVideoButtonVisibility();
      closeVideoViewIfOpenForTrackChange();
    } else if (index < currentTrackIndex) {
      currentTrackIndex -= 1; // still-playing track shifted down by one
    }
    await refreshLibrary();
    const idx = library.findIndex((p) => p.name === playlistName);
    if (idx !== -1) {
      selectPlaylist(idx);
    } else {
      showView("library"); // that was the last track - the playlist folder is gone
    }
  } catch (err) {
    showToast(err.message || "Löschen fehlgeschlagen.");
  }
}

/* ===== Recommendations ===== */
let currentRecIds = [];

async function loadRecommendations(excludeIds) {
  if (!currentPlaylist) return;
  const playlistName = currentPlaylist.name;
  const params = new URLSearchParams({ playlist: playlistName });
  if (excludeIds && excludeIds.length) params.set("exclude", excludeIds.join(","));

  let recs = [];
  try {
    const res = await fetch(`/api/library/recommendations?${params.toString()}`);
    const data = await res.json();
    recs = data.recommendations || [];
  } catch (_) {
    recs = [];
  }

  // The user may have already clicked into a different playlist by the time
  // this resolves - drop stale results instead of rendering them.
  if (!currentPlaylist || currentPlaylist.name !== playlistName) return;

  currentRecIds = recs.map((r) => r.video_id);
  renderRecommendations(recs);
}

function renderRecommendations(recs) {
  recsGrid.innerHTML = "";
  if (!recs.length) {
    const empty = document.createElement("div");
    empty.className = "card-sub";
    empty.textContent = "Gerade keine Vorschläge gefunden.";
    recsGrid.appendChild(empty);
    return;
  }
  recs.forEach((rec) => {
    const card = document.createElement("div");
    card.className = "card";
    card.title = "Auf YouTube ansehen";

    const coverWrap = document.createElement("div");
    coverWrap.className = "card-cover-wrap";
    const img = document.createElement("img");
    img.className = "card-cover";
    img.src = rec.cover || PLACEHOLDER_COVER;
    img.alt = "";
    coverWrap.appendChild(img);

    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = rec.title;
    const sub = document.createElement("div");
    sub.className = "card-sub";
    sub.textContent = rec.artist || "Unbekannter Interpret";

    card.append(coverWrap, title, sub);
    card.addEventListener("click", () => window.open(rec.url, "_blank", "noopener"));
    recsGrid.appendChild(card);
  });
}

recsRefreshBtn.addEventListener("click", async () => {
  recsRefreshBtn.classList.add("spinning");
  recsGrid.classList.add("swapping");
  await loadRecommendations(currentRecIds);
  recsGrid.classList.remove("swapping");
  setTimeout(() => recsRefreshBtn.classList.remove("spinning"), 600);
});

/* ===== Bulk-Edit =====
   Mehrere Titel markieren, dann Album/Cover für alle auf einmal ändern
   (statt jeden Track einzeln). Checkboxen leben in der bestehenden
   .col-index-Zelle jeder Zeile, per CSS nur im Auswahlmodus sichtbar - kein
   Re-Render der Tabelle beim Umschalten nötig. */
let bulkSelectMode = false;
let bulkSelectedFiles = new Set();
let lastBulkClickedIndex = -1;

function toggleTrackSelection(file, selected) {
  if (selected) bulkSelectedFiles.add(file);
  else bulkSelectedFiles.delete(file);
  updateBulkEditBar();
}

// Shift-Klick: alle Zeilen zwischen dem zuletzt angeklickten Index und dem
// aktuellen markieren - die naheliegendste Antwort auf "wie wähle ich
// mehrere aus", ohne jede Zeile einzeln anklicken zu müssen.
function selectTrackRange(fromIndex, toIndex) {
  if (!currentPlaylist) return;
  const [lo, hi] = fromIndex < toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
  for (let i = lo; i <= hi; i++) {
    const t = currentPlaylist.tracks[i];
    if (t) bulkSelectedFiles.add(t.file);
  }
  trackTable.querySelectorAll(".track-row").forEach((row) => {
    const i = Number(row.dataset.index);
    const cb = row.querySelector(".track-select-checkbox");
    if (cb && i >= lo && i <= hi) cb.checked = true;
  });
  updateBulkEditBar();
}

function updateBulkEditBar() {
  const count = bulkSelectedFiles.size;
  bulkEditCount.textContent = `${count} ausgewählt`;
  bulkEditAlbumBtn.disabled = count === 0;
  bulkEditCoverBtn.disabled = count === 0;
  const total = currentPlaylist ? currentPlaylist.tracks.length : 0;
  bulkEditSelectAllBtn.textContent = total > 0 && count >= total ? "Auswahl aufheben" : "Alle auswählen";
}

function setBulkSelectMode(enabled) {
  bulkSelectMode = enabled;
  bulkSelectedFiles.clear();
  lastBulkClickedIndex = -1;
  trackTable.classList.toggle("bulk-select-active", enabled);
  bulkSelectBtn.classList.toggle("active", enabled);
  bulkEditBar.classList.toggle("hidden", !enabled);
  trackTable.querySelectorAll(".track-select-checkbox").forEach((cb) => { cb.checked = false; });
  updateBulkEditBar();
}

bulkEditSelectAllBtn.addEventListener("click", () => {
  if (!currentPlaylist) return;
  const allSelected = bulkSelectedFiles.size >= currentPlaylist.tracks.length;
  if (allSelected) {
    bulkSelectedFiles.clear();
    trackTable.querySelectorAll(".track-select-checkbox").forEach((cb) => { cb.checked = false; });
  } else {
    currentPlaylist.tracks.forEach((t) => bulkSelectedFiles.add(t.file));
    trackTable.querySelectorAll(".track-select-checkbox").forEach((cb) => { cb.checked = true; });
  }
  updateBulkEditBar();
});

async function submitBulkUpdate(payload) {
  if (!currentPlaylist || !bulkSelectedFiles.size) return;
  const playlistName = currentPlaylist.name;
  try {
    const res = await fetch("/api/library/bulk-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playlist_name: playlistName,
        filenames: [...bulkSelectedFiles],
        ...payload,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Bulk-Bearbeitung fehlgeschlagen.");
    const failedNote = data.failed ? `, ${data.failed} fehlgeschlagen` : "";
    showToast(`✅ ${data.updated} Titel aktualisiert${failedNote}`);
    setBulkSelectMode(false);
    await refreshLibrary();
    const idx = library.findIndex((p) => p.name === playlistName);
    if (idx !== -1) selectPlaylist(idx);
  } catch (err) {
    showToast(err.message || "Bulk-Bearbeitung fehlgeschlagen.");
  }
}

bulkSelectBtn.addEventListener("click", () => setBulkSelectMode(!bulkSelectMode));
bulkEditCancelBtn.addEventListener("click", () => setBulkSelectMode(false));
bulkEditAlbumBtn.addEventListener("click", () => {
  const value = window.prompt(`Neues Album für ${bulkSelectedFiles.size} Titel:`, "");
  if (value === null) return;
  submitBulkUpdate({ album: value });
});
bulkEditCoverBtn.addEventListener("click", () => bulkEditCoverInput.click());
bulkEditCoverInput.addEventListener("change", async () => {
  const file = bulkEditCoverInput.files[0];
  bulkEditCoverInput.value = "";
  if (!file) return;
  const buf = await file.arrayBuffer();
  await submitBulkUpdate({
    cover_data: Array.from(new Uint8Array(buf)),
    cover_mime: file.type || "image/jpeg",
  });
});

/* ===== Track Table =====
   Lazy-Loading fuer grosse Playlists: der erste Batch rendert synchron
   (Ansicht steht sofort da), der Rest folgt haeppchenweise ueber
   requestAnimationFrame statt den Main-Thread mit tausenden DOM-Knoten +
   Event-Listenern am Stueck zu blockieren. Fuer normal grosse Playlists
   (< CHUNK_SIZE Titel) unveraendertes Verhalten - ein einziger Batch. */
const TRACK_TABLE_CHUNK_SIZE = 150;

function buildTrackRow(t, i) {
    const tr = document.createElement("tr");
    tr.className = "track-row";
    tr.dataset.index = i;

    const tdIndex = document.createElement("td");
    tdIndex.className = "col-index";
    tdIndex.innerHTML = `<span class="track-num">${i + 1}</span><span class="track-play-icon">▶</span>`;
    const selectCb = document.createElement("input");
    selectCb.type = "checkbox";
    selectCb.className = "track-select-checkbox";
    selectCb.checked = bulkSelectedFiles.has(t.file);
    selectCb.addEventListener("click", (e) => {
      e.stopPropagation();
      if (e.shiftKey && lastBulkClickedIndex !== -1) {
        selectCb.checked = true;
        selectTrackRange(lastBulkClickedIndex, i);
      } else {
        toggleTrackSelection(t.file, selectCb.checked);
      }
      lastBulkClickedIndex = i;
    });
    tdIndex.prepend(selectCb);

    const tdTitle = document.createElement("td");
    const cell = document.createElement("div");
    cell.className = "track-title-cell";
    const img = document.createElement("img");
    img.className = "track-thumb";
    img.src = coverFor(t);
    img.alt = "";
    const text = document.createElement("div");
    text.className = "track-text";
    const title = document.createElement("div");
    title.className = "track-title";
    title.textContent = t.title;
    const artist = document.createElement("div");
    artist.className = "track-artist";
    artist.textContent = t.artist || "Unbekannter Interpret";
    text.append(title, artist);
    cell.append(img, text);
    tdTitle.appendChild(cell);

    const tdAlbum = document.createElement("td");
    tdAlbum.textContent = t.album || "—";

    const tdDuration = document.createElement("td");
    tdDuration.className = "col-duration";
    tdDuration.textContent = t.duration ? fmtTime(t.duration) : "—";

    // ⋯ (U+22EF, reines Textzeichen - kein Emoji-Risiko wie bei 🔀/⏸):
    // Menü mit "Als nächstes spielen" / "An Warteschlange anhängen".
    const tdMore = document.createElement("td");
    tdMore.className = "col-more";
    const moreBtn = document.createElement("button");
    moreBtn.type = "button";
    moreBtn.className = "track-more-btn";
    moreBtn.textContent = "⋯";
    moreBtn.title = "Optionen";
    moreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openTrackMoreMenu(moreBtn, t);
    });
    tdMore.appendChild(moreBtn);

    const tdAdd = document.createElement("td");
    tdAdd.className = "col-add";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "track-add-btn";
    addBtn.textContent = "➕";
    addBtn.title = "Zu Playlist hinzufügen";
    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openAddMenu(addBtn, { source_playlist: currentPlaylist.name, filename: t.file });
    });
    tdAdd.appendChild(addBtn);

    const tdRemove = document.createElement("td");
    tdRemove.className = "col-remove";
    const removeBtn = document.createElement("button");
    removeBtn.className = "track-remove-btn";
    removeBtn.textContent = "🗑";
    removeBtn.title = "Aus Playlist entfernen";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteTrack(i);
    });
    tdRemove.appendChild(removeBtn);

    tr.append(tdIndex, tdTitle, tdAlbum, tdDuration, tdMore, tdAdd, tdRemove);
    tr.addEventListener("click", (e) => {
      if (bulkSelectMode) {
        if (e.shiftKey && lastBulkClickedIndex !== -1) {
          selectTrackRange(lastBulkClickedIndex, i);
        } else {
          selectCb.checked = !selectCb.checked;
          toggleTrackSelection(t.file, selectCb.checked);
        }
        lastBulkClickedIndex = i;
        return;
      }
      // Klick auf den bereits laufenden Track: pausieren bzw. fortsetzen
      // statt von vorne zu starten.
      if (i === currentTrackIndex && nowPlayingMeta && nowPlayingMeta.stream_url === t.stream_url) {
        togglePlayPause();
      } else {
        playTrack(i);
      }
    });
    return tr;
}

let trackTableRenderToken = 0;
function renderTrackTable() {
  trackTableBody.innerHTML = "";
  const tracks = currentPlaylist.tracks;
  const token = ++trackTableRenderToken; // Playlist-Wechsel mitten im Chunking bricht den alten Lauf sauber ab
  let i = 0;
  function renderChunk() {
    if (token !== trackTableRenderToken) return;
    const end = Math.min(i + TRACK_TABLE_CHUNK_SIZE, tracks.length);
    const fragment = document.createDocumentFragment();
    for (; i < end; i++) {
      fragment.appendChild(buildTrackRow(tracks[i], i));
    }
    trackTableBody.appendChild(fragment);
    highlightPlayingRow();
    if (i < tracks.length) requestAnimationFrame(renderChunk);
  }
  renderChunk();
}

function highlightPlayingRow() {
  trackTableBody.querySelectorAll(".track-row").forEach((row) => {
    row.classList.toggle("playing", Number(row.dataset.index) === currentTrackIndex);
  });
}

/* ===== Playback ===== */
function buildShuffleOrder(keepCurrentFirst = true) {
  let order;
  let attempts = 0;
  // Real Fisher-Yates is already unbiased, but for small playlists it can
  // land on the same order (or even the identity order) often enough that
  // a reshuffle reads as "nothing happened". Regenerate until it differs
  // from the last shuffle - capped so this can never loop forever.
  do {
    order = currentPlaylist.tracks.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    attempts++;
  } while (
    attempts < 8 &&
    order.length > 2 &&
    order.length === lastShuffleOrder.length &&
    order.every((v, i) => v === lastShuffleOrder[i])
  );
  lastShuffleOrder = order.slice();

  // keepCurrentFirst: move the currently playing track to the front so
  // toggling shuffle mid-song (bar button) never interrupts or repeats
  // it - nextTrack() walks on from position 0. The big "shuffle-play"
  // button passes false instead: it restarts playback anyway and should
  // begin with a genuinely random track, not the one already playing.
  if (keepCurrentFirst && currentTrackIndex >= 0 && currentTrackIndex < order.length) {
    const pos = order.indexOf(currentTrackIndex);
    if (pos > 0) {
      order.splice(pos, 1);
      order.unshift(currentTrackIndex);
    }
  }

  // Uniform Fisher-Yates is mathematically fine but still "feels" barely
  // shuffled when a song heard a minute ago lands right at the front
  // again - the actual complaint behind "richtig krass shuffeln". Push
  // any track from the recently-played history out of the first few
  // upcoming slots (right after the kept current track), swapping it for
  // a later slot that ISN'T recently played. Only runs with enough spare
  // tracks to make a real swap possible.
  const startPos = keepCurrentFirst && order[0] === currentTrackIndex ? 1 : 0;
  const windowSize = Math.min(recentlyPlayed.length, order.length - startPos - 1);
  for (let i = startPos; i < startPos + windowSize; i++) {
    if (!recentlyPlayed.includes(order[i])) continue;
    const swapWith = order.findIndex((v, idx) => idx > i && !recentlyPlayed.includes(v));
    if (swapWith !== -1) {
      [order[i], order[swapWith]] = [order[swapWith], order[i]];
    }
  }

  shuffleOrder = order;
}

// Called whenever a track actually starts playing - keeps a short rolling
// history so the next (re)shuffle can steer away from repeating it too
// soon. Capped relative to playlist length so tiny playlists don't end up
// with "recently played" covering the whole thing (which would leave
// buildShuffleOrder's swap loop nothing to work with).
function trackRecentlyPlayed(index) {
  if (index < 0) return;
  recentlyPlayed = recentlyPlayed.filter((i) => i !== index);
  recentlyPlayed.push(index);
  const cap = currentPlaylist ? Math.max(1, Math.min(10, currentPlaylist.tracks.length - 2)) : 10;
  if (recentlyPlayed.length > cap) recentlyPlayed = recentlyPlayed.slice(-cap);
}

function playTrack(index, opts = {}) {
  if (!currentPlaylist || !currentPlaylist.tracks[index]) return;
  currentTrackIndex = index;
  trackRecentlyPlayed(index);
  const track = currentPlaylist.tracks[index];

  initAudioGraph();
  // A-B-Loop gehört an die Zeitachse EINES Songs - bei jedem Trackwechsel
  // (auch per Crossfade-Handoff, sonst erbt der neue Song die alten Punkte
  // und springt scheinbar zufällig zurück) muss er verworfen werden.
  clearAbLoop();
  // handoff = Crossfade-Rollentausch: das Element spielt den Titel schon
  // mit vollem Pegel - nur UI/Metadaten nachziehen, nicht neu laden.
  if (!opts.handoff) {
    resetFadeForNewTrack();
    playCountedForTrack = null; // frischer Start - auch bei sofortigem Replay wieder zählbar
    audioEl.src = track.stream_url;
    audioEl.play().catch(() => {});
    applySkipSilenceStart(track.stream_url);
    // Weiter hören: nur bei langen Tracks (Mixes/Sets), und erst sobald die
    // Metadaten da sind - currentTime vor loadedmetadata zu setzen wird von
    // manchen Browsern schlicht ignoriert.
    if ((track.duration || 0) > RESUME_THRESHOLD_SECONDS) {
      const resumeAt = getResumePosition(currentPlaylist.name, track.file);
      if (resumeAt > 10) {
        audioEl.addEventListener(
          "loadedmetadata",
          () => {
            if (resumeAt < audioEl.duration - 10) audioEl.currentTime = resumeAt;
          },
          { once: true }
        );
      }
    }
  }

  pbCover.src = coverFor(track);
  pbTitle.textContent = track.title;
  pbArtist.textContent = track.artist || "Unbekannter Interpret";
  isLiked = false;
  pbLike.classList.remove("active");
  pbLike.textContent = "♡";

  highlightPlayingRow();
  updatePlayButton(true);
  updateMediaSessionMetadata(track);
  updateAmbientGlow(track.cover);
  nowPlayingMeta = {
    playlist: currentPlaylist.name,
    file: track.file,
    title: track.title,
    artist: track.artist,
    cover: track.cover,
    stream_url: track.stream_url,
  };

  prefetchLyrics(track);
  prefetchLyrics(peekNextTrack());
  prefetchedNextForTrack = -1;
  // ruft intern auch updateNextUpPreview() auf - hält "Danach"/"Ähnliche
  // Songs" im Queue-Panel aktuell, falls es beim normalen Trackwechsel
  // (nicht nur beim Abspielen aus der Warteschlange) offen bleibt.
  renderQueuePanel();
  updateVideoButtonVisibility();
  resetSilenceSkipState();
  closeVideoViewIfOpenForTrackChange();
  refreshLyricsIfOpen();
  refreshVisualizerIfOpen();
}

/* Plays a track handed over from a queue (own "Als nächstes"-Warteschlange
   oder Gast-Handys der Party). Not tied to currentPlaylist/
   currentTrackIndex - it has its own full metadata already, so this
   bypasses the indexed playTrack() path entirely instead of trying to
   force it into a playlist context it doesn't belong to. */
function playQueuedEntry(entry, source = "guest", opts = {}) {
  // Merken, wo die Playlist gerade stand - nach Abarbeiten der Queue
  // macht nextTrack() dort weiter statt wieder bei Track 0 anzufangen.
  if (currentTrackIndex >= 0) queueResumeIndex = currentTrackIndex;

  initAudioGraph();
  clearAbLoop(); // siehe playTrack - Loop-Punkte gehören nie zu einem neuen Song
  // handoff: siehe playTrack - Element spielt schon, nichts neu laden.
  if (!opts.handoff) {
    resetFadeForNewTrack();
    playCountedForTrack = null;
    audioEl.src = entry.stream_url;
    audioEl.play().catch(() => {});
    applySkipSilenceStart(entry.stream_url);
  }

  pbCover.src = entry.cover || PLACEHOLDER_COVER;
  pbTitle.textContent = entry.title;
  pbArtist.textContent = entry.artist || "Unbekannter Interpret";
  isLiked = false;
  pbLike.classList.remove("active");
  pbLike.textContent = "♡";

  currentTrackIndex = -1;
  highlightPlayingRow();
  updatePlayButton(true);
  updateMediaSessionMetadata({ title: entry.title, artist: entry.artist, album: "" });
  updateAmbientGlow(entry.cover);
  nowPlayingMeta = {
    playlist: entry.playlist || "",
    file: entry.file || "",
    title: entry.title,
    artist: entry.artist,
    cover: entry.cover,
    stream_url: entry.stream_url,
  };

  if (source === "guest") {
    fetch(`/api/queue/${entry.id}`, { method: "DELETE" }).catch(() => {});
    showToast(`👥 Aus der Warteschlange: „${entry.title}"`);
  }
  updateVideoButtonVisibility();
  resetSilenceSkipState();
  closeVideoViewIfOpenForTrackChange();
  renderQueuePanel();
  refreshLyricsIfOpen();
  refreshVisualizerIfOpen();
}

function updatePlayButton(playing) {
  // Kein Emoji-Text mehr - ⏸ rendert auf Android als bunte Emoji-Grafik
  // ("immer noch dieser Emoji Stop"), die neben dem flachen Design aus dem
  // Rahmen fiel. Das flache Mask-Icon in styles.css (SHUFFLE / REPEAT
  // ICONS-Abschnitt) schaltet anhand dieses Attributs zwischen Play-
  // Dreieck und Pause-Balken um.
  pbPlay.dataset.state = playing ? "pause" : "play";
  pbPlay.title = playing ? "Pause" : "Abspielen";
}

function togglePlayPause() {
  // currentTrackIndex stays -1 while a guest-queued track is playing (it
  // isn't part of currentPlaylist), so only treat -1 as "nothing loaded
  // yet" when audioEl genuinely has no src.
  if (currentTrackIndex === -1 && !audioEl.src) {
    if (currentPlaylist && currentPlaylist.tracks.length) playTrack(0);
    return;
  }
  initAudioGraph();
  if (audioEl.paused) {
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    audioEl.play().catch(() => {});
  } else {
    audioEl.pause();
  }
}

function nextTrack() {
  // Eigene "Als nächstes"-Warteschlange hat höchste Priorität, danach die
  // Gast-Queue der Party - wie das "Up next" jeder Musik-App.
  if (userQueue.length) {
    playQueuedEntry(userQueue.shift(), "user");
    return;
  }
  if (liveQueue.length) {
    const entry = liveQueue.shift();
    playQueuedEntry(entry);
    return;
  }
  if (!currentPlaylist || !currentPlaylist.tracks.length) return;
  // Queue ist leer und der letzte Song kam aus der Queue (Index -1):
  // an der gemerkten Playlist-Position weitermachen statt bei 0.
  let fromIndex = currentTrackIndex;
  if (fromIndex === -1 && queueResumeIndex >= 0) {
    fromIndex = queueResumeIndex;
    queueResumeIndex = -1;
  }
  if (isShuffle) {
    const pos = shuffleOrder.indexOf(fromIndex);
    const nextPos = (pos + 1) % shuffleOrder.length;
    if (nextPos === 0 && repeatMode !== "all" && pos !== -1) {
      updatePlayButton(false);
      return;
    }
    playTrack(shuffleOrder[nextPos]);
    return;
  }
  let next = fromIndex + 1;
  if (next >= currentPlaylist.tracks.length) {
    if (repeatMode !== "all") {
      updatePlayButton(false);
      return;
    }
    next = 0;
  }
  playTrack(next);
}

function prevTrack() {
  if (!currentPlaylist || !currentPlaylist.tracks.length) return;
  // Restart the current track if we're more than 3s in (Spotify-like behaviour).
  if (audioEl.currentTime > 3) {
    audioEl.currentTime = 0;
    return;
  }
  if (isShuffle) {
    const pos = shuffleOrder.indexOf(currentTrackIndex);
    const prevPos = (pos - 1 + shuffleOrder.length) % shuffleOrder.length;
    playTrack(shuffleOrder[prevPos]);
    return;
  }
  let prev = currentTrackIndex - 1;
  if (prev < 0) prev = currentPlaylist.tracks.length - 1;
  playTrack(prev);
}

/* ===== Controls Wiring ===== */
playAllBtn.addEventListener("click", () => {
  if (currentPlaylist && currentPlaylist.tracks.length) playTrack(0);
});

/* The big shuffle button in the playlist view is a "Zufallswiedergabe
   STARTEN" button: turning it on always kicks off playback immediately
   with a fresh random order (no keep-current-first - a genuinely random
   opener). Turning it off just disables the mode without touching
   playback. The small bar toggle (pbShuffle) stays a pure mode switch
   that never interrupts the running song. */
shuffleAllBtn.addEventListener("click", () => {
  if (suppressShuffleClick) return;
  if (!currentPlaylist || !currentPlaylist.tracks.length) return;
  if (!isShuffle) {
    isShuffle = true;
    pbShuffle.classList.add("active");
    shuffleAllBtn.classList.add("active");
    buildShuffleOrder(false);
    playTrack(shuffleOrder[0]);
  } else {
    isShuffle = false;
    pbShuffle.classList.remove("active");
    shuffleAllBtn.classList.remove("active");
  }
});

pbPlay.addEventListener("click", togglePlayPause);
pbNext.addEventListener("click", nextTrack);
pbPrev.addEventListener("click", prevTrack);

function toggleShuffle() {
  if (suppressShuffleClick) return;
  isShuffle = !isShuffle;
  pbShuffle.classList.toggle("active", isShuffle);
  shuffleAllBtn.classList.toggle("active", isShuffle);
  if (isShuffle && currentPlaylist) buildShuffleOrder();
}
pbShuffle.addEventListener("click", toggleShuffle);

/* Shuffle+: right-click re-rolls the shuffle order AND starts playing the
   fresh mix right away - one gesture, instant new random playback. */
function reshuffleNow(btn) {
  if (!currentPlaylist || !currentPlaylist.tracks.length) return;
  isShuffle = true;
  pbShuffle.classList.add("active");
  shuffleAllBtn.classList.add("active");
  buildShuffleOrder(false);
  playTrack(shuffleOrder[0]);
  showToast("🔀 Neu gemischt!");
  if (btn) {
    btn.classList.remove("shuffle-pulse");
    // Force reflow so the animation restarts on rapid repeat clicks.
    void btn.offsetWidth;
    btn.classList.add("shuffle-pulse");
  }
}

[pbShuffle, shuffleAllBtn].forEach((btn) => {
  btn.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    reshuffleNow(btn);
  });
});

/* Touch has no right-click - long-press is the mobile equivalent for
   Shuffle+. Sets suppressShuffleClick briefly so the synthetic "click"
   every touchend fires afterward doesn't immediately undo the reshuffle
   by also running toggleShuffle()/the shuffleAllBtn handler. */
let suppressShuffleClick = false;
[pbShuffle, shuffleAllBtn].forEach((btn) => {
  let pressTimer = null;
  let longPressed = false;
  btn.addEventListener(
    "touchstart",
    () => {
      longPressed = false;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        longPressed = true;
        reshuffleNow(btn);
      }, 450);
    },
    { passive: true }
  );
  const endPress = () => {
    clearTimeout(pressTimer);
    if (longPressed) {
      suppressShuffleClick = true;
      setTimeout(() => { suppressShuffleClick = false; }, 500);
    }
  };
  btn.addEventListener("touchend", endPress);
  btn.addEventListener("touchcancel", endPress);
});

/* ===== Toast ===== */
let toastTimer = null;
function showToast(message) {
  let toast = document.getElementById("playerToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "playerToast";
    toast.className = "player-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.remove("show");
  void toast.offsetWidth;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
}

pbRepeat.addEventListener("click", () => {
  repeatMode = repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off";
  pbRepeat.classList.toggle("active", repeatMode !== "off");
  // Kein Emoji-Text mehr (siehe pbShuffle/pbPlay) - das flache Mask-Icon
  // in styles.css (SHUFFLE / REPEAT ICONS) schaltet anhand dieses
  // Attributs zwischen Loop- und Loop+1-Icon um.
  pbRepeat.dataset.mode = repeatMode;
});

function toggleLike() {
  isLiked = !isLiked;
  pbLike.classList.toggle("active", isLiked);
  pbLike.textContent = isLiked ? "♥" : "♡";
}
pbLike.addEventListener("click", toggleLike);

/* ===== Audio Element Events ===== */
audioEl.addEventListener("play", () => {
  updatePlayButton(true);
  if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
});
audioEl.addEventListener("pause", () => {
  updatePlayButton(false);
  if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
});

audioEl.addEventListener("timeupdate", () => {
  if (!audioEl.duration) return;
  const pct = (audioEl.currentTime / audioEl.duration) * 100;
  pbProgressBar.style.width = `${pct}%`;
  pbProgressHandle.style.left = `${pct}%`;
  pbTimeCurrent.textContent = fmtTime(audioEl.currentTime);
  maybeStartFadeOut();

  if ("mediaSession" in navigator && "setPositionState" in navigator.mediaSession) {
    try {
      navigator.mediaSession.setPositionState({
        duration: audioEl.duration,
        playbackRate: audioEl.playbackRate,
        position: audioEl.currentTime,
      });
    } catch (_) {
      // Fails if duration is Infinity/NaN momentarily during a seek - harmless.
    }
  }
});

audioEl.addEventListener("loadedmetadata", () => {
  pbTimeTotal.textContent = fmtTime(audioEl.duration);
});

/* Weiter hören: Position alle paar Sekunden sichern (nur lange Tracks),
   nahe des Endes stattdessen löschen (gilt als durchgelaufen - sonst
   würde ein erneutes Abspielen kurz vor Schluss wieder fortsetzen). */
let lastResumeSaveAt = 0;
audioEl.addEventListener("timeupdate", () => {
  if (!nowPlayingMeta || !audioEl.duration || audioEl.duration <= RESUME_THRESHOLD_SECONDS) return;
  const now = performance.now();
  if (now - lastResumeSaveAt < 5000) return;
  lastResumeSaveAt = now;
  const remaining = audioEl.duration - audioEl.currentTime;
  if (remaining < 15) clearResumePosition(nowPlayingMeta.playlist, nowPlayingMeta.file);
  else setResumePosition(nowPlayingMeta.playlist, nowPlayingMeta.file, audioEl.currentTime);
});

audioEl.addEventListener("ended", () => {
  if (repeatMode === "one") {
    // resetFadeForNewTrack räumt auch einen evtl. noch laufenden
    // Crossfade-Ghost ab (Repeat-One wurde mitten in der Ausblendphase
    // eingeschaltet) - sonst liefe der nächste Song parallel weiter.
    resetFadeForNewTrack();
    audioEl.currentTime = 0;
    audioEl.play().catch(() => {});
    return;
  }
  if (completeCrossfadeHandoff()) return;
  nextTrack();
});

/* ===== Stream error recovery (flaky mobile networks) =====
   A failed/aborted MP3 load must not freeze the player: toast, wait 3s,
   auto-advance. The consecutive-error counter stops the auto-advance
   after a whole string of failures (server unreachable, WLAN gone) -
   otherwise repeat-all would cycle a dead playlist with a toast every
   3 seconds forever. Any successfully playing track resets the counter. */
let audioErrorRetryTimer = null;
let consecutiveAudioErrors = 0;
const MAX_CONSECUTIVE_AUDIO_ERRORS = 5;

let retriedForSrc = null; // pro Quelle genau EIN Sofort-Retry, bevor übersprungen wird

audioEl.addEventListener("playing", () => {
  consecutiveAudioErrors = 0;
  retriedForSrc = null;
});

audioEl.addEventListener("error", () => {
  // deleteTrack() intentionally clears src, which also fires an error
  // event - that's not a stream failure, so ignore it.
  if (!audioEl.getAttribute("src")) return;

  // Erststrategie: derselbe Titel, ein Sofort-Retry mit Positions-Restore.
  // Fängt kurze Netz-/Stream-Aussetzer ab, ohne den Song zu verlieren -
  // erst wenn dieselbe Quelle direkt nochmal scheitert, wird übersprungen.
  const src = audioEl.getAttribute("src");
  if (retriedForSrc !== src) {
    retriedForSrc = src;
    const pos = audioEl.currentTime || 0;
    showToast("⚠️ Aussetzer im Stream – versuche es erneut …");
    audioEl.load();
    const restore = () => {
      audioEl.removeEventListener("canplay", restore);
      if (pos > 0 && isFinite(audioEl.duration) && pos < audioEl.duration) {
        audioEl.currentTime = pos;
      }
      audioEl.play().catch(() => {});
    };
    audioEl.addEventListener("canplay", restore);
    return;
  }

  consecutiveAudioErrors += 1;
  updatePlayButton(false);
  if (consecutiveAudioErrors >= MAX_CONSECUTIVE_AUDIO_ERRORS) {
    showToast("⚠️ Mehrere Titel nicht ladbar – Wiedergabe gestoppt");
    return;
  }
  showToast("⚠️ Fehler beim Laden des Titels – nächster Song in 3s …");
  clearTimeout(audioErrorRetryTimer);
  audioErrorRetryTimer = setTimeout(() => nextTrack(), 3000);
});

/* Hänger-Watchdog: "stalled"/"waiting" heißt der Browser bekommt gerade
   keine Daten. Kurzes Puffern ist normal - erst wenn 10s lang trotz
   play-Absicht nichts weitergeht, greift dieselbe Retry-Logik wie beim
   harten error-Event (load + Positions-Restore). */
let stallTimer = null;
function armStallWatchdog() {
  clearTimeout(stallTimer);
  stallTimer = setTimeout(() => {
    if (audioEl.paused || !audioEl.getAttribute("src")) return;
    const pos = audioEl.currentTime || 0;
    showToast("⚠️ Stream hängt – lade neu …");
    audioEl.load();
    const restore = () => {
      audioEl.removeEventListener("canplay", restore);
      if (pos > 0 && isFinite(audioEl.duration) && pos < audioEl.duration) {
        audioEl.currentTime = pos;
      }
      audioEl.play().catch(() => {});
    };
    audioEl.addEventListener("canplay", restore);
  }, 10000);
}
audioEl.addEventListener("stalled", armStallWatchdog);
audioEl.addEventListener("waiting", armStallWatchdog);
["playing", "timeupdate", "pause", "ended", "emptied"].forEach((ev) =>
  audioEl.addEventListener(ev, () => clearTimeout(stallTimer))
);

/* Nächsten Titel vorwärmen: sobald der laufende Song zu 85% durch ist,
   die ersten ~256KB des nächsten anfordern - wärmt Datei-Cache/HTTP-Pfad,
   damit der Wechsel (gerade bei Offline-Dateien) verzögerungsfrei ist. */
let warmedNextForTrack = -1;
audioEl.addEventListener("timeupdate", () => {
  if (!audioEl.duration || !isFinite(audioEl.duration)) return;
  if (currentTrackIndex === warmedNextForTrack) return;
  if (audioEl.currentTime / audioEl.duration >= 0.85) {
    warmedNextForTrack = currentTrackIndex;
    const next = userQueue[0] || liveQueue[0] || peekNextTrack();
    if (next && next.stream_url) {
      fetch(next.stream_url, { headers: { Range: "bytes=0-262143" } }).catch(() => {});
    }
  }
});

/* ===== Warteschlange (eigene "Als nächstes"-Queue + Panel) =====
   userQueue = volle Metadaten-Snapshots (nicht Indizes) - überlebt damit
   Playlist-Wechsel und Umsortieren der Quell-Playlist. Panel zeigt drei
   Abschnitte: eigene Queue (umsortierbar per Drag-Drop und ↑/↓-Buttons,
   löschbar), Gast-Queue der Party (löschbar, Server-synchronisiert via
   SSE queue_update) und eine Read-only-Vorschau der danach folgenden
   Playlist-Titel. */
const pbQueue = document.getElementById("pbQueue");
const queuePanel = document.getElementById("queuePanel");
const queuePanelBody = document.getElementById("queuePanelBody");
const queuePanelClose = document.getElementById("queuePanelClose");

function queueEntryFor(track) {
  return {
    title: track.title,
    artist: track.artist || "",
    cover: track.cover || "",
    stream_url: track.stream_url,
    playlist: currentPlaylist ? currentPlaylist.name : "",
    file: track.file || "",
  };
}

function enqueueNext(track) {
  userQueue.unshift(queueEntryFor(track));
  showToast(`Als Nächstes: „${track.title}"`);
  renderQueuePanel();
}

function enqueueLast(track) {
  userQueue.push(queueEntryFor(track));
  showToast(`In Warteschlange: „${track.title}"`);
  renderQueuePanel();
}

let trackMoreMenuEl = null;
function closeTrackMoreMenu() {
  if (trackMoreMenuEl) {
    trackMoreMenuEl.remove();
    trackMoreMenuEl = null;
  }
}
function openTrackMoreMenu(anchorBtn, track) {
  closeTrackMoreMenu();
  const menu = document.createElement("div");
  menu.className = "add-to-playlist-menu track-more-menu";
  const mkItem = (label, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "add-to-playlist-item";
    b.textContent = label;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      closeTrackMoreMenu();
      fn();
    });
    menu.appendChild(b);
  };
  mkItem("Als nächstes spielen", () => enqueueNext(track));
  mkItem("An Warteschlange anhängen", () => enqueueLast(track));
  mkItem("Warteschlange anzeigen", () => openQueuePanel());
  document.body.appendChild(menu);
  const rect = anchorBtn.getBoundingClientRect();
  const top = Math.min(rect.bottom + 4, window.innerHeight - menu.offsetHeight - 8);
  const left = Math.min(rect.left, window.innerWidth - 250);
  menu.style.top = `${Math.max(8, top)}px`;
  menu.style.left = `${Math.max(8, left)}px`;
  trackMoreMenuEl = menu;
}
document.addEventListener("click", () => closeTrackMoreMenu());

function openQueuePanel() {
  renderQueuePanel();
  queuePanel.classList.remove("hidden");
  pbQueue.classList.add("active");
}
function closeQueuePanel() {
  queuePanel.classList.add("hidden");
  pbQueue.classList.remove("active");
}
pbQueue.addEventListener("click", () => {
  if (queuePanel.classList.contains("hidden")) openQueuePanel();
  else closeQueuePanel();
});
queuePanelClose.addEventListener("click", closeQueuePanel);

/* Nicht-destruktive Vorschau: welche Playlist-Titel kommen nach den
   Queues dran. Spiegelt exakt die nextTrack()-Logik (inkl. Resume-Index
   und Shuffle-Reihenfolge), verändert aber nichts. */
function upcomingPlaylistTracks(maxCount) {
  if (!currentPlaylist || !currentPlaylist.tracks.length) return [];
  let fromIndex = currentTrackIndex;
  if (fromIndex === -1 && queueResumeIndex >= 0) fromIndex = queueResumeIndex;
  const out = [];
  if (isShuffle && shuffleOrder.length) {
    let pos = shuffleOrder.indexOf(fromIndex);
    for (let step = 1; step <= shuffleOrder.length - 1 && out.length < maxCount; step++) {
      const p = pos + step;
      if (p >= shuffleOrder.length && repeatMode !== "all") break;
      const t = currentPlaylist.tracks[shuffleOrder[p % shuffleOrder.length]];
      if (t) out.push(t);
    }
    return out;
  }
  for (let step = 1; step <= currentPlaylist.tracks.length - 1 && out.length < maxCount; step++) {
    let idx = fromIndex + step;
    if (idx >= currentPlaylist.tracks.length) {
      if (repeatMode !== "all") break;
      idx %= currentPlaylist.tracks.length;
    }
    const t = currentPlaylist.tracks[idx];
    if (t) out.push(t);
  }
  return out;
}

let dragQIndex = null;

/* Ähnliche Songs: alles vom selben Interpreten in der GESAMTEN Bibliothek
   (nicht nur der aktuellen Playlist), reiner Client-Abgleich gegen die
   schon geladene `library` - kein Server-Request nötig. Bewusst simpel
   (nur Interpret-Gleichheit) statt eines eigenen Empfehlungs-Backends. */
function similarTracks(maxCount) {
  if (!nowPlayingMeta || !nowPlayingMeta.artist) return [];
  const artist = nowPlayingMeta.artist.trim().toLowerCase();
  if (!artist) return [];
  const out = [];
  for (const pl of library) {
    for (let trackIdx = 0; trackIdx < pl.tracks.length; trackIdx++) {
      if (out.length >= maxCount) return out;
      const t = pl.tracks[trackIdx];
      if ((t.artist || "").trim().toLowerCase() !== artist) continue;
      if (pl.name === nowPlayingMeta.playlist && t.file === nowPlayingMeta.file) continue;
      const plIdx = library.indexOf(pl);
      out.push({ track: t, plIdx, trackIdx });
    }
  }
  return out;
}

/* Kompakte "Als nächstes"-Vorschau in der Player-Leiste, ohne dafür das
   Queue-Panel öffnen zu müssen - spiegelt exakt peekNextEntry() (siehe
   Crossfade weiter unten), zeigt also immer denselben Titel, der bei
   Songende auch tatsächlich als nächstes drankäme. */
const pbNextUp = document.getElementById("pbNextUp");
function updateNextUpPreview() {
  if (!pbNextUp) return;
  const next = peekNextEntry();
  let title = "";
  let artist = "";
  if (next && next.kind === "playlist") {
    const t = currentPlaylist && currentPlaylist.tracks[next.index];
    if (t) {
      title = t.title;
      artist = t.artist;
    }
  } else if (next && next.entry) {
    title = next.entry.title;
    artist = next.entry.artist;
  }
  if (!title) {
    pbNextUp.textContent = "";
    pbNextUp.classList.add("hidden");
    return;
  }
  pbNextUp.textContent = `Weiter: ${title}${artist ? " – " + artist : ""}`;
  pbNextUp.classList.remove("hidden");
}

function isTrackAvailableLocally(title, artist) {
  const t = (title || "").trim().toLowerCase();
  if (!t) return false;
  const a = (artist || "").trim().toLowerCase();
  return library.some((pl) =>
    pl.tracks.some((tr) => (tr.title || "").trim().toLowerCase() === t && (tr.artist || "").trim().toLowerCase() === a)
  );
}

function queueSectionHeading(text) {
  const h = document.createElement("div");
  h.className = "queue-section-title";
  h.textContent = text;
  return h;
}

function queueRowBase(entry) {
  const row = document.createElement("div");
  row.className = "queue-row";
  const img = document.createElement("img");
  img.className = "queue-row-cover";
  img.src = entry.cover || PLACEHOLDER_COVER;
  img.alt = "";
  const text = document.createElement("div");
  text.className = "queue-row-text";
  const title = document.createElement("div");
  title.className = "queue-row-title";
  title.textContent = entry.title;
  const artist = document.createElement("div");
  artist.className = "queue-row-artist";
  artist.textContent = entry.artist || "Unbekannter Interpret";
  text.append(title, artist);
  row.append(img, text);
  return row;
}

function renderQueuePanel() {
  updateNextUpPreview();
  if (!queuePanelBody) return;
  queuePanelBody.innerHTML = "";

  // --- Eigene Queue ---
  queuePanelBody.appendChild(queueSectionHeading(userQueue.length ? `Als Nächstes (${userQueue.length})` : "Als Nächstes"));
  if (!userQueue.length) {
    const empty = document.createElement("div");
    empty.className = "queue-empty";
    empty.textContent = "Leer - über ⋯ bei einem Song füllen.";
    queuePanelBody.appendChild(empty);
  }
  userQueue.forEach((entry, idx) => {
    const row = queueRowBase(entry);
    row.draggable = true;
    row.addEventListener("dragstart", (e) => {
      dragQIndex = idx;
      row.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    row.addEventListener("dragend", () => {
      dragQIndex = null;
      renderQueuePanel();
    });
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      row.classList.add("drag-over");
    });
    row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      if (dragQIndex === null || dragQIndex === idx) return;
      const [moved] = userQueue.splice(dragQIndex, 1);
      userQueue.splice(idx, 0, moved);
      dragQIndex = null;
      renderQueuePanel();
    });

    const actions = document.createElement("div");
    actions.className = "queue-row-actions";
    // ↑/↓ zusätzlich zu Drag-Drop: auf Touch-Geräten gibt es kein HTML5-DnD.
    const up = document.createElement("button");
    up.type = "button";
    up.className = "queue-row-btn";
    up.textContent = "↑";
    up.title = "Nach oben";
    up.disabled = idx === 0;
    up.addEventListener("click", () => {
      const [moved] = userQueue.splice(idx, 1);
      userQueue.splice(idx - 1, 0, moved);
      renderQueuePanel();
    });
    const down = document.createElement("button");
    down.type = "button";
    down.className = "queue-row-btn";
    down.textContent = "↓";
    down.title = "Nach unten";
    down.disabled = idx === userQueue.length - 1;
    down.addEventListener("click", () => {
      const [moved] = userQueue.splice(idx, 1);
      userQueue.splice(idx + 1, 0, moved);
      renderQueuePanel();
    });
    const del = document.createElement("button");
    del.type = "button";
    del.className = "queue-row-btn queue-row-del";
    del.textContent = "✕";
    del.title = "Entfernen";
    del.addEventListener("click", () => {
      userQueue.splice(idx, 1);
      renderQueuePanel();
    });
    actions.append(up, down, del);
    row.appendChild(actions);
    queuePanelBody.appendChild(row);
  });

  // --- Gast-Queue (Party) ---
  if (liveQueue.length) {
    queuePanelBody.appendChild(queueSectionHeading(`Von Gästen (${liveQueue.length})`));
    liveQueue.forEach((entry) => {
      const row = queueRowBase(entry);
      // Offline-Indikator: liegt der Song schon lokal in der Bibliothek
      // (spielt sofort ohne Netzwerk) oder muss er von der Quelle des
      // Gasts gestreamt werden (braucht eine Verbindung)?
      const local = isTrackAvailableLocally(entry.title, entry.artist);
      const badge = document.createElement("span");
      badge.className = "queue-row-source-badge";
      badge.textContent = local ? "📀" : "🌐";
      badge.title = local ? "Bereits in deiner Bibliothek - spielt lokal" : "Nicht lokal vorhanden - wird gestreamt";
      row.appendChild(badge);
      const actions = document.createElement("div");
      actions.className = "queue-row-actions";
      const del = document.createElement("button");
      del.type = "button";
      del.className = "queue-row-btn queue-row-del";
      del.textContent = "✕";
      del.title = "Entfernen";
      del.addEventListener("click", () => {
        // Server broadcastet queue_update - liveQueue + Panel syncen darüber.
        fetch(`/api/queue/${entry.id}`, { method: "DELETE" }).catch(() => {});
      });
      actions.appendChild(del);
      row.appendChild(actions);
      queuePanelBody.appendChild(row);
    });
  }

  // --- Danach: Playlist-Vorschau ---
  const upcoming = upcomingPlaylistTracks(8);
  if (upcoming.length) {
    queuePanelBody.appendChild(
      queueSectionHeading(`Danach: ${currentPlaylist ? currentPlaylist.name : ""}`)
    );
    upcoming.forEach((t) => {
      const row = queueRowBase({ title: t.title, artist: t.artist, cover: coverFor(t) });
      row.classList.add("queue-row-upcoming");
      queuePanelBody.appendChild(row);
    });
  }

  // --- Ähnliche Songs (gleicher Interpret, ganze Bibliothek) ---
  const similar = similarTracks(8);
  if (similar.length) {
    queuePanelBody.appendChild(queueSectionHeading("Ähnliche Songs"));
    similar.forEach(({ track, plIdx, trackIdx }) => {
      const row = queueRowBase({ title: track.title, artist: track.artist, cover: coverFor(track) });
      row.classList.add("queue-row-clickable");
      row.addEventListener("click", () => {
        playTrackIn(plIdx, trackIdx);
        closeQueuePanel();
      });
      queuePanelBody.appendChild(row);
    });
  }
}

/* ===== Scrubber (click + drag) ===== */
function seekFromEvent(e) {
  const rect = pbProgressWrap.querySelector(".pb-progress-track").getBoundingClientRect();
  const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
  const pct = rect.width ? x / rect.width : 0;
  if (audioEl.duration) {
    audioEl.currentTime = pct * audioEl.duration;
  }
}
let scrubbing = false;
pbProgressWrap.addEventListener("mousedown", (e) => {
  scrubbing = true;
  seekFromEvent(e);
});
window.addEventListener("mousemove", (e) => {
  if (scrubbing) seekFromEvent(e);
});
window.addEventListener("mouseup", () => {
  scrubbing = false;
});

/* ===== Volume ===== */
function setVolumeFromEvent(e) {
  const rect = pbVolumeWrap.querySelector(".pb-volume-track").getBoundingClientRect();
  const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
  const pct = rect.width ? x / rect.width : 0;
  // Beide Elemente: nach einem Crossfade-Rollentausch soll die Lautstärke
  // nicht plötzlich auf einem alten Wert stehen.
  audioElA.volume = pct;
  audioElB.volume = pct;
  pbVolumeBar.style.width = `${pct * 100}%`;
  pbVolumeHandle.style.left = `${pct * 100}%`;
  pbVolIcon.textContent = pct === 0 ? "🔇" : pct < 0.5 ? "🔉" : "🔊";
}
let scrubbingVolume = false;
pbVolumeWrap.addEventListener("mousedown", (e) => {
  scrubbingVolume = true;
  setVolumeFromEvent(e);
});
window.addEventListener("mousemove", (e) => {
  if (scrubbingVolume) setVolumeFromEvent(e);
});
window.addEventListener("mouseup", () => {
  scrubbingVolume = false;
});

/* ===== Drag & Drop: add a playlist / add tracks by dropping a folder ===== */

// A dropped folder gives us FileSystemDirectoryEntry objects, not File
// objects directly - webkitGetAsEntry() + a recursive reader is the only
// way to walk into it and pull out the actual .mp3 files.
function readAllDirectoryEntries(reader) {
  return new Promise((resolve) => {
    let all = [];
    function readBatch() {
      reader.readEntries((entries) => {
        if (!entries.length) {
          resolve(all);
          return;
        }
        all = all.concat(entries);
        readBatch(); // readEntries only hands back a batch at a time
      }, () => resolve(all));
    }
    readBatch();
  });
}

function fileFromEntry(entry) {
  return new Promise((resolve) => entry.file(resolve, () => resolve(null)));
}

async function collectFilesFromEntry(entry, out) {
  if (!entry) return;
  if (entry.isFile) {
    const file = await fileFromEntry(entry);
    if (file && file.name.toLowerCase().endsWith(".mp3")) out.push(file);
  } else if (entry.isDirectory) {
    const entries = await readAllDirectoryEntries(entry.createReader());
    for (const child of entries) await collectFilesFromEntry(child, out);
  }
}

async function collectFilesFromDataTransfer(dataTransfer) {
  const out = [];
  const items = dataTransfer.items;
  if (items && items.length && items[0].webkitGetAsEntry) {
    const entries = [...items].map((item) => item.webkitGetAsEntry()).filter(Boolean);
    for (const entry of entries) await collectFilesFromEntry(entry, out);
  } else {
    // Browser without folder-entry support - fall back to whatever files came through.
    for (const file of dataTransfer.files) {
      if (file.name.toLowerCase().endsWith(".mp3")) out.push(file);
    }
  }
  return out;
}

function folderNameFromDataTransfer(dataTransfer) {
  const items = dataTransfer.items;
  if (items && items.length && items[0].webkitGetAsEntry) {
    const entry = items[0].webkitGetAsEntry();
    if (entry && entry.isDirectory) return entry.name;
  }
  return null;
}

function showUploadToast(msg) {
  uploadToast.textContent = msg;
  uploadToast.classList.remove("hidden");
}

async function uploadFiles(playlistName, files, onDone) {
  if (!files.length) {
    showToast("Keine MP3-Dateien gefunden.");
    return;
  }
  showUploadToast(`⏳ Lade ${files.length} Titel hoch …`);
  const formData = new FormData();
  formData.set("playlist", playlistName);
  files.forEach((f) => formData.append("files", f, f.name));
  try {
    const res = await fetch("/api/library/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Hochladen fehlgeschlagen.");
    const skippedNote = data.skipped ? `, ${data.skipped} übersprungen` : "";
    showUploadToast(`✅ ${data.saved} Titel zu „${data.playlist}" hinzugefügt${skippedNote}`);
    await refreshLibrary();
    if (onDone) onDone(data.playlist);
  } catch (err) {
    showUploadToast(`❌ ${err.message || "Hochladen fehlgeschlagen."}`);
  } finally {
    setTimeout(() => uploadToast.classList.add("hidden"), 3000);
  }
}

function jumpToPlaylistByName(name) {
  const idx = library.findIndex((p) => p.name === name);
  if (idx !== -1) selectPlaylist(idx);
}

// Library view: dropping (or picking) a folder here creates a NEW playlist.
["dragenter", "dragover"].forEach((evt) =>
  libraryDropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    libraryDropzone.classList.add("drag-over");
  })
);
["dragleave", "drop"].forEach((evt) =>
  libraryDropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    libraryDropzone.classList.remove("drag-over");
  })
);
libraryDropzone.addEventListener("drop", async (e) => {
  const folderName = folderNameFromDataTransfer(e.dataTransfer) || "Neue Playlist";
  const files = await collectFilesFromDataTransfer(e.dataTransfer);
  await uploadFiles(folderName, files, jumpToPlaylistByName);
});
libraryDropzone.addEventListener("click", () => libraryFileInput.click());
libraryFileInput.addEventListener("change", async () => {
  const all = [...libraryFileInput.files];
  const mp3s = all.filter((f) => f.name.toLowerCase().endsWith(".mp3"));
  const folderName = (all[0] && all[0].webkitRelativePath && all[0].webkitRelativePath.split("/")[0]) || "Neue Playlist";
  await uploadFiles(folderName, mp3s, jumpToPlaylistByName);
  libraryFileInput.value = "";
});

// Playlist detail view: dropping here adds tracks to the CURRENTLY open playlist.
["dragenter", "dragover"].forEach((evt) =>
  playlistDropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    playlistDropzone.classList.add("drag-over");
  })
);
["dragleave", "drop"].forEach((evt) =>
  playlistDropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    playlistDropzone.classList.remove("drag-over");
  })
);
playlistDropzone.addEventListener("drop", async (e) => {
  if (!currentPlaylist) return;
  const playlistName = currentPlaylist.name;
  const files = await collectFilesFromDataTransfer(e.dataTransfer);
  await uploadFiles(playlistName, files, jumpToPlaylistByName);
});

// Safety net: if a drag slips off a real dropzone, stop the browser from
// navigating away to open the dropped file as a page.
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());

/* ===== Web Audio graph: Equalizer + soft fade in/out =====
   createMediaElementSource() can only ever be called once per <audio>
   element (it throws on a second call) and, once called, ALL of that
   element's audio only reaches the speakers through whatever this graph
   connects to - so the chain below must end at audioContext.destination or
   playback goes silent. Built lazily on first user-gesture play, since
   AudioContext starts suspended until a real click/tap resumes it. */
let audioCtx = null;
let eqBass, eqMid, eqTreble, masterGain, normalizerCompressor;
let visualizerAnalyser = null;
let gainA = null, gainB = null; // ein Gain pro <audio>-Element - die beiden Crossfade-Rampen
let audioGraphReady = false;
const eqSettings = { bass: 0, mid: 0, treble: 0 };

const activeGain = () => (audioEl === audioElA ? gainA : gainB);
const otherGain = () => (audioEl === audioElA ? gainB : gainA);

/* Lautstärke-Normalisierung zwischen Tracks: echtes per-Track-ReplayGain
   (vorab die ganze Datei analysieren) würde einen schweren Audio-Decoder
   als neue Rust-Abhängigkeit brauchen (Cross-Compile-Risiko fürs Android-
   NDK, siehe Cargo.toml-Kommentare zu reqwest/rustls-tls). Der schon
   vorhandene DynamicsCompressorNode (broadcast-artiges Leveling in
   Echtzeit) liefert denselben praktischen Nutzen - Downloads aus
   unterschiedlichsten YouTube-Quellen klingen nicht mehr sprunghaft
   lauter/leiser - ganz ohne Vorab-Analyse. Standardmäßig an (war vorher
   fest verdrahtet, jetzt nur zusätzlich abschaltbar).*/
const NORMALIZE_ENABLED_KEY = "loudnessNormalize";
let normalizeEnabled = localStorage.getItem(NORMALIZE_ENABLED_KEY) !== "0";
function applyNormalizerSettings() {
  if (!normalizerCompressor) return;
  if (normalizeEnabled) {
    normalizerCompressor.threshold.value = -24;
    normalizerCompressor.knee.value = 30;
    normalizerCompressor.ratio.value = 12;
  } else {
    normalizerCompressor.threshold.value = 0;
    normalizerCompressor.knee.value = 0;
    normalizerCompressor.ratio.value = 1;
  }
}
function setNormalizeEnabled(enabled) {
  normalizeEnabled = enabled;
  localStorage.setItem(NORMALIZE_ENABLED_KEY, enabled ? "1" : "0");
  applyNormalizerSettings();
}

/* ===== Skip-Silence =====
   Leise Anfänge/Enden bei jedem Song automatisch überspringen.

   Anfang: EIN sauberer Sprung statt laufendem Stottern. Die alte Version
   pollte live und rückte bei anhaltender Stille alle ~400ms um 1s vor -
   hörte sich wie ein hakender Plattenspieler an ("skippt immer nur so 2
   Sekunden"). Jetzt wird beim Songstart einmalig ein kleines Stück vom
   Dateianfang geholt (Byte-Range, Datei liegt eh lokal), offline decodiert
   und die erste nicht-stille Stelle direkt angesprungen - ein Sprung,
   fertig, bevor man's überhaupt hört.

   Ende: laufende RMS-Prüfung bleibt nötig (wo der Song endet, weiß man erst
   während der Wiedergabe), springt aber ebenfalls in einem Schritt an den
   Rand des Crossfade-/Gapless-Übernahmefensters statt schrittweise. */
const SKIP_SILENCE_KEY = "skipSilenceEnabled";
let skipSilenceEnabled = localStorage.getItem(SKIP_SILENCE_KEY) === "1";
function setSkipSilenceEnabled(enabled) {
  skipSilenceEnabled = enabled;
  localStorage.setItem(SKIP_SILENCE_KEY, enabled ? "1" : "0");
}

const SILENCE_RMS_THRESHOLD = 0.02;
const SILENCE_END_LOOKAHEAD_SECONDS = 40; // vor Songende geprüftes Fenster
let silenceEndStreak = 0;
let silenceCheckBuf = null;
let silenceStartSkipToken = 0;

function currentSignalRms() {
  if (!visualizerAnalyser) return 1; // kein Audio-Graph (uralter Browser) - lieber normal abspielen
  if (!silenceCheckBuf) silenceCheckBuf = new Uint8Array(visualizerAnalyser.fftSize);
  visualizerAnalyser.getByteTimeDomainData(silenceCheckBuf);
  let sumSq = 0;
  for (let i = 0; i < silenceCheckBuf.length; i++) {
    const v = (silenceCheckBuf[i] - 128) / 128;
    sumSq += v * v;
  }
  return Math.sqrt(sumSq / silenceCheckBuf.length);
}

function resetSilenceSkipState() {
  silenceEndStreak = 0;
}

/* Holt nur die ersten ~1MB der Datei (reicht für mehrere Sekunden Audio in
   jeder gängigen Bitrate) und decodiert sie in einem eigenen, kurzlebigen
   OfflineAudioContext - berührt die eigentliche Wiedergabe nicht, liefert
   nur die Startzeit des ersten echten Tons. */
async function findAudioStartOffset(streamUrl) {
  try {
    const res = await fetch(streamUrl, { headers: { Range: "bytes=0-1048575" } });
    const buf = await res.arrayBuffer();
    const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Ctx) return 0;
    const scratchCtx = new Ctx(2, 44100 * 30, 44100);
    const decoded = await scratchCtx.decodeAudioData(buf);
    const data = decoded.getChannelData(0);
    const sr = decoded.sampleRate;
    const windowSize = Math.max(1, Math.floor(sr * 0.05)); // 50ms-Fenster
    for (let i = 0; i < data.length - windowSize; i += windowSize) {
      let sumSq = 0;
      for (let j = 0; j < windowSize; j++) sumSq += data[i + j] * data[i + j];
      if (Math.sqrt(sumSq / windowSize) > SILENCE_RMS_THRESHOLD) {
        const t = i / sr;
        return t > 0.4 ? Math.max(0, t - 0.2) : 0; // kleiner Puffer vor dem Einsatz
      }
    }
    return 0; // ganzes Prefix still (oder Decode fehlgeschlagen) - lieber nichts tun
  } catch (_) {
    return 0;
  }
}

async function applySkipSilenceStart(streamUrl) {
  if (!skipSilenceEnabled) return;
  const token = ++silenceStartSkipToken;
  const offset = await findAudioStartOffset(streamUrl);
  // Falls der Track inzwischen gewechselt hat (Token) oder schon weiter
  // ist (z.B. "Weiter hören" sprang schon auf eine spätere Position) -
  // nicht rückwärts springen, nur vorwärts über echte Stille hinweg.
  if (token !== silenceStartSkipToken || offset <= 0) return;
  if (audioEl.src === streamUrl && audioEl.currentTime < offset) {
    audioEl.currentTime = offset;
  }
}

setInterval(() => {
  if (!skipSilenceEnabled || audioEl.paused || crossfadeOverlapActive) return;
  const dur = audioEl.duration;
  if (!isFinite(dur) || dur <= 0) return;
  const t = audioEl.currentTime;

  // Nur außerhalb des Crossfade-/Gapless-Übernahmefensters aktiv - das
  // kümmert sich ab da schon selbst um den nahtlosen Wechsel. Bei
  // anhaltender Stille direkt an den Rand dieses Fensters springen, statt
  // tote Luft abzuspielen; Crossfade/Gapless übernimmt den Rest wie gewohnt.
  const handoffPoint = crossfadeSeconds + GAPLESS_PRELOAD_SECONDS + 0.5;
  const remaining = dur - t;
  if (remaining > handoffPoint && remaining <= SILENCE_END_LOOKAHEAD_SECONDS) {
    if (currentSignalRms() < SILENCE_RMS_THRESHOLD) {
      silenceEndStreak++;
      if (silenceEndStreak >= 7) { // ~1.4s durchgehend still
        audioEl.currentTime = dur - handoffPoint;
        silenceEndStreak = 0;
      }
    } else {
      silenceEndStreak = 0;
    }
  } else {
    silenceEndStreak = 0;
  }
}, 200);

function initAudioGraph() {
  if (audioGraphReady) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return; // very old browser - playback still works, just no EQ/fade
  audioCtx = new Ctx();
  const sourceA = audioCtx.createMediaElementSource(audioElA);
  const sourceB = audioCtx.createMediaElementSource(audioElB);
  gainA = audioCtx.createGain();
  gainA.gain.value = 1;
  gainB = audioCtx.createGain();
  gainB.gain.value = 0; // B startet stumm - wird erst als Crossfade-Partner hochgerampt

  eqBass = audioCtx.createBiquadFilter();
  eqBass.type = "lowshelf";
  eqBass.frequency.value = 200;
  eqBass.gain.value = eqSettings.bass;

  eqMid = audioCtx.createBiquadFilter();
  eqMid.type = "peaking";
  eqMid.frequency.value = 1000;
  eqMid.Q.value = 0.9;
  eqMid.gain.value = eqSettings.mid;

  eqTreble = audioCtx.createBiquadFilter();
  eqTreble.type = "highshelf";
  eqTreble.frequency.value = 3000;
  eqTreble.gain.value = eqSettings.treble;

  // Audio-Normalisierung: downloads from all over YouTube swing wildly in
  // loudness (a quiet acoustic rip next to a hot-mastered pop track). A
  // compressor evens that out automatically instead of everyone having to
  // ride the volume knob per song - fairly aggressive "broadcast leveling"
  // settings so quiet tracks get pulled up close to loud ones.
  normalizerCompressor = audioCtx.createDynamicsCompressor();
  normalizerCompressor.attack.value = 0.003;
  normalizerCompressor.release.value = 0.25;
  applyNormalizerSettings();

  masterGain = audioCtx.createGain();
  masterGain.gain.value = 1;

  // Analyser NACH masterGain abgegriffen: erfasst so das kombinierte
  // Signal beider Crossfade-Elemente (egal welches gerade aktiv ist oder
  // ob gerade überblendet wird), nicht nur eines davon einzeln.
  visualizerAnalyser = audioCtx.createAnalyser();
  visualizerAnalyser.fftSize = 128;
  visualizerAnalyser.smoothingTimeConstant = 0.8;

  sourceA.connect(gainA).connect(eqBass);
  sourceB.connect(gainB).connect(eqBass);
  eqBass.connect(eqMid).connect(eqTreble).connect(normalizerCompressor).connect(masterGain);
  masterGain.connect(visualizerAnalyser).connect(audioCtx.destination);
  audioGraphReady = true;
}

[
  ["eqBassSlider", "bass", () => eqBass],
  ["eqMidSlider", "mid", () => eqMid],
  ["eqTrebleSlider", "treble", () => eqTreble],
].forEach(([id, key, getFilter]) => {
  document.getElementById(id).addEventListener("input", (e) => {
    const val = Number(e.target.value);
    eqSettings[key] = val;
    const filter = getFilter();
    if (filter) filter.gain.value = val;
  });
});

const eqToggleBtn = document.getElementById("eqToggleBtn");
const eqPopover = document.getElementById("eqPopover");
eqToggleBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  eqPopover.classList.toggle("hidden");
  eqToggleBtn.classList.toggle("active", !eqPopover.classList.contains("hidden"));
});
document.addEventListener("click", (e) => {
  if (!eqPopover.classList.contains("hidden") && !eqPopover.contains(e.target) && e.target !== eqToggleBtn) {
    eqPopover.classList.add("hidden");
    eqToggleBtn.classList.remove("active");
  }
});

/* ===== Wiedergabegeschwindigkeit + A-B-Loop ===== */
const pbToolsToggleBtn = document.getElementById("pbToolsToggleBtn");
const pbToolsPopover = document.getElementById("pbToolsPopover");
const playbackRateSlider = document.getElementById("playbackRateSlider");
const playbackRateReadout = document.getElementById("playbackRateReadout");
const playbackRateResetBtn = document.getElementById("playbackRateResetBtn");
const abLoopSetABtn = document.getElementById("abLoopSetABtn");
const abLoopSetBBtn = document.getElementById("abLoopSetBBtn");
const abLoopClearBtn = document.getElementById("abLoopClearBtn");
const abLoopStatus = document.getElementById("abLoopStatus");

pbToolsToggleBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  pbToolsPopover.classList.toggle("hidden");
  pbToolsToggleBtn.classList.toggle("active", !pbToolsPopover.classList.contains("hidden"));
});
document.addEventListener("click", (e) => {
  if (!pbToolsPopover.classList.contains("hidden") && !pbToolsPopover.contains(e.target) && e.target !== pbToolsToggleBtn) {
    pbToolsPopover.classList.add("hidden");
    pbToolsToggleBtn.classList.remove("active");
  }
});

// playbackRate ist eine Eigenschaft des <audio>-Elements selbst, nicht der
// geladenen Datei - einmal auf beide Crossfade-Elemente gesetzt, bleibt sie
// über jeden folgenden Songwechsel (src-Wechsel) hinweg automatisch erhalten.
const PLAYBACK_RATE_KEY = "playbackRate";
let playbackRate = Number(localStorage.getItem(PLAYBACK_RATE_KEY)) || 1;
function setPlaybackRate(rate) {
  playbackRate = Math.min(Math.max(rate, 0.5), 2);
  localStorage.setItem(PLAYBACK_RATE_KEY, String(playbackRate));
  audioElA.playbackRate = playbackRate;
  audioElB.playbackRate = playbackRate;
  playbackRateReadout.textContent = `${playbackRate.toFixed(2)}x`;
  playbackRateSlider.value = String(playbackRate);
}
setPlaybackRate(playbackRate);
playbackRateSlider.addEventListener("input", () => setPlaybackRate(Number(playbackRateSlider.value)));
playbackRateResetBtn.addEventListener("click", () => setPlaybackRate(1));

// A-B-Loop: zwei Zeitpunkte im aktuellen Track, zwischen denen wiederholt
// wird - zum Mitsingen/Üben eines Abschnitts. Wird bei jedem echten
// Songwechsel zurückgesetzt (siehe playTrack/playQueuedEntry).
let loopPointA = null;
let loopPointB = null;
function updateAbLoopStatus() {
  if (loopPointA != null && loopPointB != null) {
    abLoopStatus.textContent = `Loop: ${fmtTime(loopPointA)} – ${fmtTime(loopPointB)}`;
  } else if (loopPointA != null) {
    abLoopStatus.textContent = `A bei ${fmtTime(loopPointA)} – jetzt B setzen`;
  } else {
    abLoopStatus.textContent = "Kein Loop aktiv";
  }
}
function clearAbLoop() {
  loopPointA = null;
  loopPointB = null;
  updateAbLoopStatus();
}
abLoopSetABtn.addEventListener("click", () => {
  loopPointA = audioEl.currentTime;
  if (loopPointB != null && loopPointB <= loopPointA) loopPointB = null;
  updateAbLoopStatus();
});
abLoopSetBBtn.addEventListener("click", () => {
  if (loopPointA == null) {
    showToast("Erst Punkt A setzen.");
    return;
  }
  if (audioEl.currentTime <= loopPointA) {
    showToast("B muss nach A liegen.");
    return;
  }
  loopPointB = audioEl.currentTime;
  updateAbLoopStatus();
});
abLoopClearBtn.addEventListener("click", clearAbLoop);
audioEl.addEventListener("timeupdate", () => {
  if (loopPointA != null && loopPointB != null && audioEl.currentTime >= loopPointB) {
    audioEl.currentTime = loopPointA;
  }
});

/* ===== Echtes Dual-Audio-Crossfade =====
   In den letzten CROSSFADE_SECONDS eines Songs startet das INAKTIVE
   <audio>-Element den nächsten Titel bereits überlappend (sein Gain rampt
   0 -> 1, der des laufenden 1 -> FADE_FLOOR). Beim ended-Event wird nur
   noch die Rolle getauscht (completeCrossfadeHandoff) - kein Neuladen,
   keine Lücke. Kennt der Player keinen nächsten Titel, bleibt es beim
   weichen Ausblenden wie bisher. Manuelle Aktionen (Klick auf anderen
   Song, next/prev, Seek zurück) brechen die Vorbereitung sauber ab. */
const CROSSFADE_SECONDS_KEY = "crossfadeSeconds";
let crossfadeSeconds = Number(localStorage.getItem(CROSSFADE_SECONDS_KEY)) || 4;
function setCrossfadeSeconds(seconds) {
  crossfadeSeconds = Math.min(Math.max(seconds, 1), 10);
  localStorage.setItem(CROSSFADE_SECONDS_KEY, String(crossfadeSeconds));
}
// Gapless (Crossfade AUS): der naechste Titel wird trotzdem schon kurz vor
// Songende im Hintergrund geladen/gepuffert, damit "ended" -> Start ohne
// Netzwerk-/Buffering-Luecke moeglich ist - nur eben ohne hoerbaren Fade.
const GAPLESS_PRELOAD_SECONDS = 3;
const FADE_IN_SECONDS = 1.2;
const FADE_FLOOR = 0.02;
let fadingOut = false;
let crossfadePrepared = null; // {kind: "user"|"guest"|"playlist", entry?, index?, streamUrl}
// true nur waehrend das Ghost-Element WIRKLICH ueberlappend mitspielt
// (echter Crossfade) - unterscheidet das vom Gapless-Fall, wo der Ghost nur
// vorab geladen, aber noch stumm/pausiert ist (siehe pause/play-Listener).
let crossfadeOverlapActive = false;

function cancelCrossfadePrep() {
  if (!crossfadePrepared) return;
  crossfadePrepared = null;
  crossfadeOverlapActive = false;
  const o = otherAudioEl();
  o.pause();
  if (audioGraphReady) {
    const og = otherGain();
    const now = audioCtx.currentTime;
    og.gain.cancelScheduledValues(now);
    og.gain.setValueAtTime(0, now);
  }
}

function resetFadeForNewTrack() {
  fadingOut = false;
  cancelCrossfadePrep();
  if (!audioGraphReady) return;
  const g = activeGain();
  const now = audioCtx.currentTime;
  g.gain.cancelScheduledValues(now);
  if (!crossfadeEnabled) {
    g.gain.setValueAtTime(1, now);
    return;
  }
  g.gain.setValueAtTime(FADE_FLOOR, now);
  g.gain.linearRampToValueAtTime(1, now + FADE_IN_SECONDS);
}

/* Welcher Titel käme als nächstes? Spiegelt exakt die nextTrack()-
   Prioritäten (eigene Queue > Gast-Queue > Playlist inkl. Shuffle/Repeat/
   Resume-Index), ohne irgendetwas zu konsumieren. */
function peekNextEntry() {
  if (userQueue.length) return { kind: "user", entry: userQueue[0], streamUrl: userQueue[0].stream_url };
  if (liveQueue.length) return { kind: "guest", entry: liveQueue[0], streamUrl: liveQueue[0].stream_url };
  if (!currentPlaylist || !currentPlaylist.tracks.length) return null;
  let fromIndex = currentTrackIndex;
  if (fromIndex === -1 && queueResumeIndex >= 0) fromIndex = queueResumeIndex;
  let idx;
  if (isShuffle && shuffleOrder.length) {
    const pos = shuffleOrder.indexOf(fromIndex);
    const nextPos = (pos + 1) % shuffleOrder.length;
    if (nextPos === 0 && repeatMode !== "all" && pos !== -1) return null;
    idx = shuffleOrder[nextPos];
  } else {
    idx = fromIndex + 1;
    if (idx >= currentPlaylist.tracks.length) {
      if (repeatMode !== "all") return null;
      idx = 0;
    }
  }
  const t = currentPlaylist.tracks[idx];
  return t ? { kind: "playlist", index: idx, streamUrl: t.stream_url } : null;
}

function maybeStartFadeOut() {
  if (!audioGraphReady || fadingOut) return;
  if (repeatMode === "one") return;
  if (!audioEl.duration || !isFinite(audioEl.duration)) return;
  const remaining = audioEl.duration - audioEl.currentTime;

  if (!crossfadeEnabled) {
    // Gapless: kein hoerbarer Fade, aber der naechste Titel wird trotzdem
    // rechtzeitig vorgeladen (nur src+load, noch stumm/pausiert), damit
    // "ended" den Ghost ohne Netzwerk-Luecke sofort starten kann.
    if (crossfadePrepared || remaining > GAPLESS_PRELOAD_SECONDS || remaining <= 0) return;
    const next = peekNextEntry();
    if (!next || !next.streamUrl) return;
    const o = otherAudioEl();
    o.pause();
    o.src = next.streamUrl;
    o.currentTime = 0;
    o.load();
    crossfadePrepared = next;
    return;
  }

  if (remaining <= crossfadeSeconds && remaining > 0) {
    fadingOut = true;
    const now = audioCtx.currentTime;
    const g = activeGain();
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(FADE_FLOOR, now + remaining);

    const next = peekNextEntry();
    if (next && next.streamUrl) {
      const o = otherAudioEl();
      const og = otherGain();
      o.volume = audioEl.volume;
      o.src = next.streamUrl;
      o.currentTime = 0;
      og.gain.cancelScheduledValues(now);
      og.gain.setValueAtTime(0.0001, now);
      og.gain.linearRampToValueAtTime(1, now + remaining);
      o.play()
        .then(() => {
          crossfadePrepared = next;
          crossfadeOverlapActive = true;
        })
        .catch(() => {
          // Ghost konnte nicht starten (Ladefehler o.ä.) - ended-Event
          // nimmt dann einfach den normalen nextTrack()-Weg.
          if (audioGraphReady) og.gain.setValueAtTime(0, audioCtx.currentTime);
        });
    }
  }
}

/* Rollentausch am Songende: das vorbereitete Element spielt bereits mit
   vollem Gain - hier wird nur noch audioEl umgezeigt, der Alte gestoppt
   und die UI/Metadaten-Seite über den handoff-Modus von playTrack/
   playQueuedEntry nachgezogen (die dann NICHT neu laden). */
function completeCrossfadeHandoff() {
  const prepared = crossfadePrepared;
  if (!prepared) return false;
  crossfadePrepared = null;
  const ghost = otherAudioEl();
  if (!ghost.getAttribute("src")) return false;

  if (ghost.paused) {
    // Gapless-Vorbereitung (Crossfade aus): Ghost war nur vorgeladen, noch
    // nicht gestartet - jetzt sofort starten. War rechtzeitig gepuffert,
    // also faktisch ohne Verzoegerung. Gain wird gleich unten (nach dem
    // Rollentausch) ohnehin hart auf 1 gesetzt, kein Fade noetig.
    ghost.currentTime = 0;
    ghost.play().catch(() => {});
  }

  const old = audioEl;
  audioEl = ghost;
  fadingOut = false;
  crossfadeOverlapActive = false;
  if (audioGraphReady) {
    const now = audioCtx.currentTime;
    activeGain().gain.cancelScheduledValues(now);
    activeGain().gain.setValueAtTime(1, now);
    otherGain().gain.cancelScheduledValues(now);
    otherGain().gain.setValueAtTime(0, now);
  }
  old.pause();

  if (prepared.kind === "user") {
    const i = userQueue.findIndex((e) => e.stream_url === prepared.entry.stream_url);
    if (i >= 0) userQueue.splice(i, 1);
    playQueuedEntry(prepared.entry, "user", { handoff: true });
  } else if (prepared.kind === "guest") {
    const i = liveQueue.findIndex((e) => e.id === prepared.entry.id);
    if (i >= 0) liveQueue.splice(i, 1);
    playQueuedEntry(prepared.entry, "guest", { handoff: true });
  } else {
    playTrack(prepared.index, { handoff: true });
  }

  // Das echte "play"-Event des neuen aktiven Elements feuerte, als es noch
  // inaktiver Ghost war - also unterdrückt. Synthetisch nachreichen, damit
  // play/pause-Konsumenten (Android-Notification in nowplaying-native.js,
  // MediaSession-Status, Play-Button) den neuen Titel mitbekommen.
  audioEl.dispatchEvent(new Event("play"));
  return true;
}

/* Seek zurück während der Ausblendphase: Fade + Ghost abbrechen, voller
   Pegel zurück - sonst liefe der nächste Song mitten im aktuellen los. */
audioEl.addEventListener("seeked", () => {
  if (!audioGraphReady || !fadingOut) return;
  const remaining = (audioEl.duration || 0) - audioEl.currentTime;
  if (remaining > crossfadeSeconds + 0.25) {
    fadingOut = false;
    cancelCrossfadePrep();
    const g = activeGain();
    const now = audioCtx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(1, now);
  }
});

/* Pause/Play während der Überlappung gilt für beide Elemente - sonst
   spielt der schon angezählte nächste Song alleine weiter. Nur bei
   crossfadeOverlapActive (Ghost spielt schon wirklich mit) - ein nur fürs
   Gapless-Preload vorgeladener, noch pausierter Ghost darf hier NICHT
   angestoßen werden, sonst liefen zwei Titel gleichzeitig. Wichtig: Chrome
   feuert beim NATÜRLICHEN Songende erst "pause", dann "ended" - dieses
   End-Pause darf den Ghost nicht stoppen, sonst platzt genau in dem Moment
   die Übergabe (audioEl.ended unterscheidet die Fälle). */
audioEl.addEventListener("pause", () => {
  if (crossfadeOverlapActive && !audioEl.ended) otherAudioEl().pause();
});
audioEl.addEventListener("play", () => {
  if (crossfadeOverlapActive) otherAudioEl().play().catch(() => {});
});

/* ===== Media Session API =====
   Wires the lock screen / notification shade / Windows media overlay to
   the same controls as the in-page player bar. */
function updateMediaSessionMetadata(track) {
  if (!("mediaSession" in navigator)) return;
  const artwork = track.cover
    ? [{ src: track.cover, sizes: "512x512", type: "image/png" }]
    : [];
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist || "Unbekannter Interpret",
    album: track.album || "",
    artwork,
  });
}

if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("play", () => togglePlayPause());
  navigator.mediaSession.setActionHandler("pause", () => togglePlayPause());
  navigator.mediaSession.setActionHandler("previoustrack", () => prevTrack());
  navigator.mediaSession.setActionHandler("nexttrack", () => nextTrack());
  try {
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime != null && audioEl.duration) {
        audioEl.currentTime = details.seekTime;
      }
    });
  } catch (_) {
    // Not every browser supports the seekto action - fine to skip.
  }
}

/* ===== Ambient Glow =====
   Samples the currently playing track's cover on an offscreen canvas and
   sets the blurred background blob (#ambientGlow) to its average color.
   Library covers are same-origin data: URIs (embedded APIC art read back
   through /api/library), so this never hits a canvas CORS taint - it's
   only ever called with the current track's own cover. */
const ambientGlowEl = document.getElementById("ambientGlow");
let lastCoverSrc = null; // re-sampled when Dynamic Glow gets switched back on

function updateAmbientGlow(coverSrc) {
  if (coverSrc) lastCoverSrc = coverSrc;
  if (!glowEnabled || !coverSrc) return;
  const img = new Image();
  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      const size = 24;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);
      // Zwei dominante Farben statt nur einem Durchschnitt: alle Pixel
      // per Helligkeit in eine helle und eine dunkle Hälfte teilen und
      // beide getrennt mitteln. Ergibt ein echtes Farbpaar fürs Cover
      // (z.B. Himmelblau + Schattenviolett) statt eines matschigen
      // Einheits-Mittelwerts - Grundlage für den Spotify-artigen
      // Player/Playlist-Verlauf (CSS-Vars --dyn-c1/--dyn-c2).
      const pixels = [];
      let avgLum = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        pixels.push([r, g, b, lum]);
        avgLum += lum;
      }
      avgLum /= pixels.length;
      const acc = { bright: [0, 0, 0, 0], dark: [0, 0, 0, 0] };
      for (const [r, g, b, lum] of pixels) {
        const bucket = lum >= avgLum ? acc.bright : acc.dark;
        bucket[0] += r; bucket[1] += g; bucket[2] += b; bucket[3]++;
      }
      const mix = (bucket) =>
        bucket[3]
          ? [Math.round(bucket[0] / bucket[3]), Math.round(bucket[1] / bucket[3]), Math.round(bucket[2] / bucket[3])]
          : null;
      const bright = mix(acc.bright);
      const dark = mix(acc.dark);
      const avg = mix([
        acc.bright[0] + acc.dark[0],
        acc.bright[1] + acc.dark[1],
        acc.bright[2] + acc.dark[2],
        acc.bright[3] + acc.dark[3],
      ]);
      if (avg) ambientGlowEl.style.backgroundColor = `rgb(${avg[0]}, ${avg[1]}, ${avg[2]})`;
      const root = document.documentElement;
      if (bright) root.style.setProperty("--dyn-c1", `${bright[0]}, ${bright[1]}, ${bright[2]}`);
      if (dark) root.style.setProperty("--dyn-c2", `${dark[0]}, ${dark[1]}, ${dark[2]}`);
      document.body.classList.add("has-dynamic-colors");
    } catch (_) {
      // Cross-origin or decode failure - just keep the previous glow color.
    }
  };
  img.src = coverSrc;
}

/* ===== Settings: Dynamic Glow toggle ===== */
const GLOW_ENABLED_KEY = "glowEnabled";
let glowEnabled = localStorage.getItem(GLOW_ENABLED_KEY) !== "0";

function setGlowEnabled(enabled) {
  glowEnabled = enabled;
  localStorage.setItem(GLOW_ENABLED_KEY, enabled ? "1" : "0");
  glowToggleSwitch.classList.toggle("active", enabled);
  glowToggleSwitch.setAttribute("aria-checked", String(enabled));
  if (enabled) {
    ambientGlowEl.classList.remove("glow-off");
    updateAmbientGlow(lastCoverSrc);
  } else {
    ambientGlowEl.classList.add("glow-off");
    // Cover-Farbverlauf auf Player/Playlist gehört zum selben Feature -
    // aus heißt komplett aus, zurück zur reinen Theme-Optik.
    document.body.classList.remove("has-dynamic-colors");
  }
}

function toggleGlow() {
  setGlowEnabled(!glowEnabled);
}

glowToggleSwitch.addEventListener("click", () => setGlowEnabled(!glowEnabled));
glowToggleSwitch.classList.toggle("active", glowEnabled);
glowToggleSwitch.setAttribute("aria-checked", String(glowEnabled));
if (!glowEnabled) ambientGlowEl.classList.add("glow-off");

/* ===== Vollbild-Visualizer =====
   AnalyserNode sitzt im initAudioGraph()-Graph (nach masterGain, vor
   audioCtx.destination) - erfasst also automatisch beide Crossfade-
   Elemente. Reines Canvas-2D, kein extra Rendering-Framework nötig für
   einen simplen Frequenzbalken-Look. */
const visualizerOverlay = document.getElementById("visualizerOverlay");
const visualizerCanvas = document.getElementById("visualizerCanvas");
const visualizerCover = document.getElementById("visualizerCover");
const visualizerTitle = document.getElementById("visualizerTitle");
const visualizerArtist = document.getElementById("visualizerArtist");
const visualizerCloseBtn = document.getElementById("visualizerCloseBtn");
const visualizerCtx = visualizerCanvas.getContext("2d");
let visualizerRafId = null;

function drawVisualizerFrame() {
  const w = visualizerCanvas.width;
  const h = visualizerCanvas.height;
  visualizerCtx.clearRect(0, 0, w, h);

  if (visualizerAnalyser) {
    const data = new Uint8Array(visualizerAnalyser.frequencyBinCount);
    visualizerAnalyser.getByteFrequencyData(data);
    const barCount = data.length;
    const gap = 4;
    const barWidth = w / barCount - gap;
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--sp-green").trim() || "#1db954";
    for (let i = 0; i < barCount; i++) {
      const pct = data[i] / 255;
      const barHeight = Math.max(3, pct * h * 0.85);
      const x = i * (barWidth + gap);
      const grad = visualizerCtx.createLinearGradient(0, h - barHeight, 0, h);
      grad.addColorStop(0, accent);
      grad.addColorStop(1, "rgba(255,255,255,0.15)");
      visualizerCtx.fillStyle = grad;
      visualizerCtx.fillRect(x, h - barHeight, barWidth, barHeight);
    }
  }

  visualizerRafId = visualizerOverlay.classList.contains("hidden")
    ? null
    : requestAnimationFrame(drawVisualizerFrame);
}

function resizeVisualizerCanvas() {
  visualizerCanvas.width = visualizerCanvas.clientWidth * (window.devicePixelRatio || 1);
  visualizerCanvas.height = visualizerCanvas.clientHeight * (window.devicePixelRatio || 1);
}

function setVisualizerMeta() {
  visualizerTitle.textContent = nowPlayingMeta.title;
  visualizerArtist.textContent = nowPlayingMeta.artist || "Unbekannter Interpret";
  visualizerCover.src = coverFor({ cover: nowPlayingMeta.cover });
}

function openVisualizer() {
  if (!nowPlayingMeta) {
    showToast("Gerade wird kein Titel abgespielt.");
    return;
  }
  initAudioGraph();
  setVisualizerMeta();
  visualizerOverlay.classList.remove("hidden");
  resizeVisualizerCanvas();
  if (visualizerRafId === null) visualizerRafId = requestAnimationFrame(drawVisualizerFrame);
}

// Songwechsel bei offenem Vollbild-Visualizer - die Balken laufen (Analyser
// ist live) weiter, aber Titel/Interpret/Cover blieben bisher auf dem Song
// stehen, der beim Öffnen lief. Gleicher Fix wie beim Songtext-Overlay.
function refreshVisualizerIfOpen() {
  if (visualizerOverlay.classList.contains("hidden") || !nowPlayingMeta) return;
  setVisualizerMeta();
}

function closeVisualizer() {
  visualizerOverlay.classList.add("hidden");
  if (visualizerRafId !== null) {
    cancelAnimationFrame(visualizerRafId);
    visualizerRafId = null;
  }
}

pbCover.addEventListener("click", openVisualizer);
visualizerCloseBtn.addEventListener("click", closeVisualizer);
visualizerOverlay.addEventListener("click", (e) => {
  if (e.target === visualizerOverlay) closeVisualizer();
});
window.addEventListener("resize", () => {
  if (!visualizerOverlay.classList.contains("hidden")) resizeVisualizerCanvas();
});

/* ===== Video-Ansicht fuer mp4-Downloads =====
   Normalerweise laeuft auch ein mp4-Download einfach ueber das <audio>-
   Element (Browser koennen die Audiospur eines Videos problemlos darueber
   abspielen) - nur ohne sichtbares Bild. Diese Ansicht schaltet kurz auf
   ein eigenes <video>-Element um (Position uebernommen, audioEl pausiert,
   damit nicht beides gleichzeitig Ton ausgibt) und beim Schliessen wieder
   zurueck. */
const pbVideo = document.getElementById("pbVideo");
const videoOverlay = document.getElementById("videoOverlay");
const videoPlayerEl = document.getElementById("videoPlayerEl");
const videoCloseBtn = document.getElementById("videoCloseBtn");
let videoWasPlaying = false;
// true waehrend ein Video aus der Suche/Discover ohne Download angesehen
// wird (openVideoPreview) - dann gehoert videoPlayerEl zu keinem lokalen
// Track, closeVideoView() darf currentTime also NICHT auf audioEl
// zurueckschreiben (wuerde die Position des laufenden Songs verstellen).
let videoIsPreview = false;

function isCurrentTrackVideo() {
  return !!(nowPlayingMeta && nowPlayingMeta.file && nowPlayingMeta.file.toLowerCase().endsWith(".mp4"));
}
// Button gilt jetzt für JEDEN laufenden Track, nicht nur lokale mp4-
// Downloads: ohne lokales Video wird stattdessen live nach dem passenden
// YouTube-Video gesucht (siehe openVideoView) - "auch bei heruntergeladenen
// [MP3s]" sollte der Button funktionieren, nicht nur verschwinden.
function updateVideoButtonVisibility() {
  pbVideo.classList.toggle("hidden", !nowPlayingMeta);
}

/* Bei einem lokalen mp4-Download: sofort umschalten, kein Netzwerk nötig
   (bestehendes Verhalten). Bei jedem anderen Track (z.B. als MP3
   heruntergeladen): Titel+Interpret über dieselbe Online-Suche wie die
   Suchleiste jagen und das erste Ergebnis als Live-Vorschau öffnen -
   dieselbe Stream-Auflösung wie bei den Discover-/Suchergebnis-Karten. */
async function openVideoView() {
  if (!nowPlayingMeta) return;
  if (isCurrentTrackVideo()) {
    videoIsPreview = false;
    videoWasPlaying = !audioEl.paused;
    audioEl.pause();
    videoPlayerEl.src = nowPlayingMeta.stream_url;
    videoPlayerEl.currentTime = audioEl.currentTime;
    videoOverlay.classList.remove("hidden");
    videoPlayerEl.play().catch(() => {});
    return;
  }
  try {
    const q = `${nowPlayingMeta.title} ${nowPlayingMeta.artist || ""}`.trim();
    const res = await fetch(`/api/library/search-online?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    const hit = (data.results || [])[0];
    if (!hit) throw new Error("Kein passendes Video gefunden.");
    await openVideoPreview(hit.video_id, nowPlayingMeta.title);
  } catch (err) {
    showToast(err.message || "Kein passendes Video gefunden.");
  }
}

/* Video direkt aus Suche/Discover ansehen, ohne es vorher über den
   Downloader herunterzuladen: holt sich eine kurzlebige, direkt
   abspielbare Stream-URL von yt-dlp (-g, kein Download) und spielt sie im
   selben Overlay wie lokale mp4-Tracks ab. Desktop-only (siehe
   get_stream_url in commands.rs). */
async function openVideoPreview(videoId, title) {
  showToast(`⏳ Lade Video „${title}" …`);
  try {
    const res = await fetch("/api/library/video-stream-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: videoId }),
    });
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data.error || "Video konnte nicht geladen werden.");
    videoIsPreview = true;
    videoWasPlaying = !audioEl.paused;
    audioEl.pause();
    videoPlayerEl.src = data.url;
    videoOverlay.classList.remove("hidden");
    videoPlayerEl.play().catch(() => {});
  } catch (err) {
    showToast(err.message || "Video konnte nicht geladen werden.");
  }
}

function closeVideoView() {
  if (!videoIsPreview) audioEl.currentTime = videoPlayerEl.currentTime;
  videoPlayerEl.pause();
  videoPlayerEl.removeAttribute("src");
  videoPlayerEl.load();
  videoOverlay.classList.add("hidden");
  if (videoWasPlaying) audioEl.play().catch(() => {});
  videoIsPreview = false;
}

// Songwechsel bei offener Video-Ansicht (lokales mp4 ODER Live-Vorschau aus
// der Suche) - das Overlay zeigte bisher stur das alte Video weiter, und ein
// spaeteres Schliessen haette sogar closeVideoView()'s
// "audioEl.currentTime = videoPlayerEl.currentTime" die Position des NEUEN,
// laengst eigenstaendig laufenden Tracks mit der alten Video-Abspielzeit
// ueberschrieben. Einfach schliessen, ohne audioEl anzufassen.
function closeVideoViewIfOpenForTrackChange() {
  if (videoOverlay.classList.contains("hidden")) return;
  videoPlayerEl.pause();
  videoPlayerEl.removeAttribute("src");
  videoPlayerEl.load();
  videoOverlay.classList.add("hidden");
  videoIsPreview = false;
}

pbVideo.addEventListener("click", openVideoView);
videoCloseBtn.addEventListener("click", closeVideoView);
videoOverlay.addEventListener("click", (e) => {
  if (e.target === videoOverlay) closeVideoView();
});

/* ===== Settings: Crossfade toggle ===== */
const CROSSFADE_ENABLED_KEY = "crossfadeEnabled";
let crossfadeEnabled = localStorage.getItem(CROSSFADE_ENABLED_KEY) !== "0";

function setCrossfadeEnabled(enabled) {
  crossfadeEnabled = enabled;
  localStorage.setItem(CROSSFADE_ENABLED_KEY, enabled ? "1" : "0");
  crossfadeToggleSwitch.classList.toggle("active", enabled);
  crossfadeToggleSwitch.setAttribute("aria-checked", String(enabled));
  if (!enabled) {
    // Mitten in einer laufenden Überblendung abgeschaltet: Ghost stoppen
    // und den aktiven Song sofort auf vollen Pegel zurückholen.
    cancelCrossfadePrep();
    fadingOut = false;
    if (audioGraphReady) {
      const g = activeGain();
      const now = audioCtx.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(1, now);
    }
  }
}

crossfadeToggleSwitch.addEventListener("click", () => setCrossfadeEnabled(!crossfadeEnabled));
crossfadeToggleSwitch.classList.toggle("active", crossfadeEnabled);
crossfadeToggleSwitch.setAttribute("aria-checked", String(crossfadeEnabled));

const normalizeToggleSwitch = document.getElementById("normalizeToggleSwitch");
normalizeToggleSwitch.classList.toggle("active", normalizeEnabled);
normalizeToggleSwitch.setAttribute("aria-checked", String(normalizeEnabled));
normalizeToggleSwitch.addEventListener("click", () => {
  setNormalizeEnabled(!normalizeEnabled);
  normalizeToggleSwitch.classList.toggle("active", normalizeEnabled);
  normalizeToggleSwitch.setAttribute("aria-checked", String(normalizeEnabled));
});

const skipSilenceToggleSwitch = document.getElementById("skipSilenceToggleSwitch");
skipSilenceToggleSwitch.classList.toggle("active", skipSilenceEnabled);
skipSilenceToggleSwitch.setAttribute("aria-checked", String(skipSilenceEnabled));
skipSilenceToggleSwitch.addEventListener("click", () => {
  setSkipSilenceEnabled(!skipSilenceEnabled);
  skipSilenceToggleSwitch.classList.toggle("active", skipSilenceEnabled);
  skipSilenceToggleSwitch.setAttribute("aria-checked", String(skipSilenceEnabled));
});

const crossfadeSecondsSlider = document.getElementById("crossfadeSecondsSlider");
const crossfadeSecondsReadout = document.getElementById("crossfadeSecondsReadout");
crossfadeSecondsSlider.value = String(crossfadeSeconds);
crossfadeSecondsReadout.textContent = `${crossfadeSeconds}s`;
crossfadeSecondsSlider.addEventListener("input", () => {
  setCrossfadeSeconds(Number(crossfadeSecondsSlider.value));
  crossfadeSecondsReadout.textContent = `${crossfadeSeconds}s`;
});

/* ===== Mini-Player (Document Picture-in-Picture) =====
   Nur Chromium-WebViews (Windows/Linux via WebView2/webkitgtk+Chromium)
   unterstuetzen documentPictureInPicture - Toggle bleibt in Settings
   einfach wirkungslos/versteckt, wenn die API fehlt. */
const pipToggleSwitch = document.getElementById("pipToggleSwitch");
const PIP_ENABLED_KEY = "pipOnMinimize";
let pipEnabled = localStorage.getItem(PIP_ENABLED_KEY) === "1";
const pipSupported = "documentPictureInPicture" in window;
if (!pipSupported) {
  pipToggleSwitch.disabled = true;
  pipToggleSwitch.title = "Nicht unterstützt auf diesem System";
}
function setPipEnabled(enabled) {
  pipEnabled = enabled && pipSupported;
  localStorage.setItem(PIP_ENABLED_KEY, pipEnabled ? "1" : "0");
  pipToggleSwitch.classList.toggle("active", pipEnabled);
  pipToggleSwitch.setAttribute("aria-checked", String(pipEnabled));
}
pipToggleSwitch.addEventListener("click", () => {
  if (!pipSupported) return;
  setPipEnabled(!pipEnabled);
});
setPipEnabled(pipEnabled);

let pipWindow = null;
// Schutz gegen doppeltes Oeffnen: blur UND visibilitychange koennen beide
// feuern, bevor das await unten aufgeloest und pipWindow zugewiesen ist -
// der simple "pipWindow"-Check allein greift da zu spaet.
let pipOpening = false;
// Entfernt die play/pause-Listener + den Refresh-Timer von genau DIESEM
// PiP-Fenster - vorher wurden bei jedem Minimieren/Zurueckholen neue
// Listener auf audioEl gehaengt, ohne die alten je zu entfernen (Leak bei
// haeufigem Alt-Tab). Auf null gesetzt nach Ausfuehrung, damit ein
// doppelter Aufruf (closeMiniPlayer() UND das eigene pagehide) harmlos ist.
let pipCleanup = null;
async function openMiniPlayer() {
  if (!pipSupported || pipWindow || pipOpening) return;
  pipOpening = true;
  let win;
  try {
    win = await window.documentPictureInPicture.requestWindow({ width: 320, height: 130 });
  } catch (_) {
    pipOpening = false;
    return;
  }
  pipOpening = false;
  if (pipWindow) {
    // Waehrend des awaits ist schon ein anderes PiP-Fenster entstanden -
    // dieses hier sofort wieder schliessen statt zwei parallel laufen zu
    // lassen.
    win.close();
    return;
  }
  pipWindow = win;
  const style = pipWindow.document.createElement("style");
  style.textContent = `
    body { margin: 0; background: #101014; color: #fff; font-family: inherit; display: flex; align-items: center; gap: 12px; padding: 14px; box-sizing: border-box; height: 100%; }
    img { width: 64px; height: 64px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
    .mp-info { min-width: 0; flex: 1; }
    .mp-title { font-weight: 700; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mp-artist { font-size: 0.8rem; opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mp-controls { display: flex; gap: 10px; align-items: center; flex-shrink: 0; }
    button { background: none; border: none; color: #fff; font-size: 1.4rem; cursor: pointer; padding: 4px; }
    button:hover { opacity: 0.7; }
  `;
  pipWindow.document.head.appendChild(style);
  const cover = pipWindow.document.createElement("img");
  const info = pipWindow.document.createElement("div");
  info.className = "mp-info";
  const titleEl = pipWindow.document.createElement("div");
  titleEl.className = "mp-title";
  const artistEl = pipWindow.document.createElement("div");
  artistEl.className = "mp-artist";
  info.append(titleEl, artistEl);
  const controls = pipWindow.document.createElement("div");
  controls.className = "mp-controls";
  const prevBtn = pipWindow.document.createElement("button");
  prevBtn.textContent = "⏮";
  const playBtn = pipWindow.document.createElement("button");
  const nextBtn = pipWindow.document.createElement("button");
  nextBtn.textContent = "⏭";
  controls.append(prevBtn, playBtn, nextBtn);
  pipWindow.document.body.append(cover, info, controls);

  function refresh() {
    cover.src = pbCover.src;
    titleEl.textContent = pbTitle.textContent;
    artistEl.textContent = pbArtist.textContent;
    playBtn.textContent = audioEl.paused ? "▶" : "⏸";
  }
  refresh();
  prevBtn.addEventListener("click", () => pbPrev.click());
  nextBtn.addEventListener("click", () => pbNext.click());
  playBtn.addEventListener("click", () => pbPlay.click());
  audioEl.addEventListener("play", refresh);
  audioEl.addEventListener("pause", refresh);
  const metaTimer = setInterval(refresh, 1000);

  pipCleanup = () => {
    audioEl.removeEventListener("play", refresh);
    audioEl.removeEventListener("pause", refresh);
    clearInterval(metaTimer);
    pipCleanup = null;
  };
  pipWindow.addEventListener("pagehide", () => {
    if (pipCleanup) pipCleanup();
    pipWindow = null;
  });
}
function closeMiniPlayer() {
  if (pipCleanup) pipCleanup();
  if (pipWindow) pipWindow.close();
  pipWindow = null;
}
window.addEventListener("blur", () => {
  if (pipEnabled && nowPlayingMeta && document.visibilityState === "hidden") openMiniPlayer();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && pipEnabled && nowPlayingMeta) openMiniPlayer();
  else if (document.visibilityState === "visible") closeMiniPlayer();
});

/* ===== Settings: Handy-Sync beim Start ===== */
const SYNC_AUTO_START_KEY = "syncAutoStart";
let syncAutoStart = localStorage.getItem(SYNC_AUTO_START_KEY) === "1";

function setSyncAutoStart(enabled) {
  syncAutoStart = enabled;
  localStorage.setItem(SYNC_AUTO_START_KEY, enabled ? "1" : "0");
  syncAutoStartToggleSwitch.classList.toggle("active", enabled);
  syncAutoStartToggleSwitch.setAttribute("aria-checked", String(enabled));
}

syncAutoStartToggleSwitch.addEventListener("click", () => setSyncAutoStart(!syncAutoStart));
syncAutoStartToggleSwitch.classList.toggle("active", syncAutoStart);
syncAutoStartToggleSwitch.setAttribute("aria-checked", String(syncAutoStart));
// sync.js reads this flag itself once on load (see there) - just persisting
// the toggle here keeps all Handy-Sync logic in its own file.

/* ===== Settings: Cache & Speicher ===== */
clearLyricsCacheBtn.addEventListener("click", async () => {
  clearLyricsCacheBtn.disabled = true;
  const original = clearLyricsCacheBtn.textContent;
  try {
    const res = await fetch("/api/settings/clear-lyrics-cache", { method: "POST" });
    const data = await res.json();
    showToast(`🧹 ${data.removed || 0} zwischengespeicherte Songtexte gelöscht`);
  } catch (_) {
    showToast("Cache konnte nicht geleert werden.");
  } finally {
    clearLyricsCacheBtn.disabled = false;
    clearLyricsCacheBtn.textContent = original;
  }
});

/* ===== Settings: App-Info ===== */
fetch("/api/settings/version")
  .then((res) => res.json())
  .then((data) => {
    appVersionText.textContent = data.version ? `v${data.version}` : "—";
  })
  .catch(() => {});

/* ===== Fully configurable hotkeys =====
   Every action below gets its own combo, freely reassignable in the
   Settings modal and persisted to localStorage - no action is hardcoded
   to a fixed key anymore. Combos are plain {ctrl,alt,shift,key} objects;
   `key` is always e.key.toLowerCase() (" " for Space, "arrowright" etc.)
   so comparisons in the single keydown listener stay a straight equality
   check. True system-wide hotkeys (works even minimized) come from
   desktop.py's separate OS-level keyboard hook, which relays here as
   "remote_command" SSE events - those call the same action functions
   directly and are unaffected by whatever combo is configured here. */
const HOTKEYS_STORAGE_KEY = "hotkeyBindings";
const HOTKEY_ACTIONS = [
  { id: "next", label: "Nächster Song", default: { ctrl: true, alt: true, shift: false, key: "arrowright" }, fn: () => nextTrack() },
  { id: "prev", label: "Vorheriger Song", default: { ctrl: true, alt: true, shift: false, key: "arrowleft" }, fn: () => prevTrack() },
  { id: "playpause", label: "Wiedergabe / Pause", default: { ctrl: true, alt: true, shift: false, key: " " }, fn: () => togglePlayPause() },
  { id: "like", label: "Song merken", default: { ctrl: true, alt: true, shift: false, key: "l" }, fn: () => toggleLike() },
  { id: "glow", label: "Dynamic Glow an/aus", default: { ctrl: true, alt: true, shift: false, key: "g" }, fn: () => toggleGlow() },
];

let hotkeyBindings = {};
function loadHotkeyBindings() {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(HOTKEYS_STORAGE_KEY) || "{}") || {};
  } catch (_) {
    stored = {};
  }
  hotkeyBindings = {};
  HOTKEY_ACTIONS.forEach((action) => {
    const combo = stored[action.id];
    hotkeyBindings[action.id] = combo && combo.key ? combo : { ...action.default };
  });
}
loadHotkeyBindings();

function saveHotkeyBindings() {
  localStorage.setItem(HOTKEYS_STORAGE_KEY, JSON.stringify(hotkeyBindings));
}

function formatHotkey(combo) {
  const parts = [];
  if (combo.ctrl) parts.push("Strg");
  if (combo.alt) parts.push("Alt");
  if (combo.shift) parts.push("Umschalt");
  let keyLabel = combo.key;
  if (keyLabel === " ") keyLabel = "Leertaste";
  else if (keyLabel === "arrowright") keyLabel = "→";
  else if (keyLabel === "arrowleft") keyLabel = "←";
  else if (keyLabel === "arrowup") keyLabel = "↑";
  else if (keyLabel === "arrowdown") keyLabel = "↓";
  else keyLabel = keyLabel.toUpperCase();
  parts.push(keyLabel);
  return parts.join(" + ");
}

function hotkeysEqual(a, b) {
  return !!a.ctrl === !!b.ctrl && !!a.alt === !!b.alt && !!a.shift === !!b.shift && a.key === b.key;
}

function matchesHotkey(e, combo) {
  const key = e.key === " " ? " " : e.key.toLowerCase();
  return (
    e.ctrlKey === !!combo.ctrl &&
    e.altKey === !!combo.alt &&
    e.shiftKey === !!combo.shift &&
    key === combo.key
  );
}

let recordingActionId = null;

function renderHotkeyList() {
  hotkeyList.innerHTML = "";
  HOTKEY_ACTIONS.forEach((action) => {
    const row = document.createElement("div");
    row.className = "hotkey-row hotkey-configurable";

    const label = document.createElement("span");
    label.textContent = action.label;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hotkey-combo";
    btn.dataset.actionId = action.id;
    if (recordingActionId === action.id) {
      btn.textContent = "Taste drücken … (Esc = abbrechen)";
      btn.classList.add("listening");
    } else {
      btn.textContent = formatHotkey(hotkeyBindings[action.id]);
    }
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      recordingActionId = action.id;
      renderHotkeyList();
    });

    row.append(label, btn);
    hotkeyList.appendChild(row);
  });
}

/* Single capture point for hotkey recording, kept completely separate from
   the playback keydown listener below so a key pressed while recording
   never also triggers whatever action currently owns that combo. */
document.addEventListener("keydown", (e) => {
  if (!recordingActionId) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.key === "Escape") {
    recordingActionId = null;
    renderHotkeyList();
    return;
  }
  if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
  const combo = {
    ctrl: e.ctrlKey,
    alt: e.altKey,
    shift: e.shiftKey,
    key: e.key === " " ? " " : e.key.toLowerCase(),
  };
  const clash = HOTKEY_ACTIONS.find(
    (a) => a.id !== recordingActionId && hotkeysEqual(hotkeyBindings[a.id], combo)
  );
  if (clash) {
    showToast(`⚠️ Kombination schon vergeben für „${clash.label}"`);
    recordingActionId = null;
    renderHotkeyList();
    return;
  }
  hotkeyBindings[recordingActionId] = combo;
  saveHotkeyBindings();
  recordingActionId = null;
  renderHotkeyList();
}, true);

function openSettingsModal() {
  recordingActionId = null;
  renderHotkeyList();
  settingsModal.classList.remove("hidden");
}
function closeSettingsModal() {
  recordingActionId = null;
  settingsModal.classList.add("hidden");
}
settingsToggleBtn.addEventListener("click", openSettingsModal);
settingsModalClose.addEventListener("click", closeSettingsModal);
settingsModal.addEventListener("click", (e) => {
  if (e.target === settingsModal) closeSettingsModal();
});

/* ===== Add to Playlist =====
   Shared dropdown used by every "add a song somewhere" entry point (Home
   recent/discover cards, search results, playlist track rows). Posts to
   /api/playlists/add-track, which handles both an already-downloaded
   library track (source_playlist + filename, just copies the file) and a
   not-yet-downloaded video_id (downloads + tags it straight into the
   target playlist). */
let addMenuEl = null;
function closeAddMenu() {
  if (addMenuEl) {
    addMenuEl.remove();
    addMenuEl = null;
  }
}
document.addEventListener("click", closeAddMenu);

async function addTrackToPlaylist(targetPlaylist, trackData) {
  try {
    const preset = trackData.video_id ? getQualityPreset() : null;
    const res = await fetch("/api/playlists/add-track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_playlist: targetPlaylist, ...trackData, ...(preset || {}) }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Hinzufügen fehlgeschlagen.");
    showToast(`➕ Zu „${targetPlaylist}" hinzugefügt`);
    await refreshLibrary();
  } catch (err) {
    showToast(err.message || "Hinzufügen fehlgeschlagen.");
  }
}

function openAddMenu(anchorBtn, trackData) {
  closeAddMenu();
  const menu = document.createElement("div");
  menu.className = "add-to-playlist-menu";

  if (!library.length) {
    const empty = document.createElement("div");
    empty.className = "add-to-playlist-empty";
    empty.textContent = "Noch keine Playlist vorhanden";
    menu.appendChild(empty);
  }
  library.forEach((pl) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "add-to-playlist-item";
    item.textContent = pl.name;
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAddMenu();
      addTrackToPlaylist(pl.name, trackData);
    });
    menu.appendChild(item);
  });

  const newRow = document.createElement("div");
  newRow.className = "add-to-playlist-new";
  const newInput = document.createElement("input");
  newInput.type = "text";
  newInput.placeholder = "Neue Playlist …";
  newInput.maxLength = 180;
  newInput.addEventListener("click", (e) => e.stopPropagation());
  newInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") newBtn.click();
  });
  const newBtn = document.createElement("button");
  newBtn.type = "button";
  newBtn.textContent = "+";
  newBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const name = newInput.value.trim();
    if (!name) return;
    closeAddMenu();
    addTrackToPlaylist(name, trackData);
  });
  newRow.append(newInput, newBtn);
  menu.appendChild(newRow);

  document.body.appendChild(menu);
  const rect = anchorBtn.getBoundingClientRect();
  const top = Math.min(rect.bottom + 4, window.innerHeight - menu.offsetHeight - 8);
  const left = Math.min(rect.left, window.innerWidth - 232);
  menu.style.top = `${Math.max(8, top)}px`;
  menu.style.left = `${Math.max(8, left)}px`;
  addMenuEl = menu;
}

function attachAddButton(coverWrap, trackData, className = "card-add-btn") {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.textContent = "➕";
  btn.title = "Zu Playlist hinzufügen";
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    openAddMenu(btn, trackData);
  });
  coverWrap.appendChild(btn);
  return btn;
}

/* ===== PWA: Service Worker Registration ===== */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  });
}

/* ===== Global Search =====
   Runs entirely against the already-loaded `library` array - no round trip
   to the server needed, so results render instantly on every keystroke.
   Kept independent of showView()'s home/library/playlist state machine:
   entering search just hides those sections and shows searchView, leaving
   `currentView` untouched so clearing the query can restore it exactly. */
function setSearchActive(active) {
  [emptyState, homeView, libraryView, playlistView, trashView, duplicatesView, statsView].forEach((el) => {
    if (active) el.classList.add("hidden");
  });
  searchView.classList.toggle("hidden", !active);
  if (!active) {
    showView(currentView);
  }
}

function renderSearchSongs(matches) {
  searchSongsGrid.innerHTML = "";
  searchSongsSection.classList.toggle("hidden", !matches.length);
  if (!matches.length) return;
  matches.forEach(({ track, plIdx, trackIdx }) => {
    const card = document.createElement("div");
    card.className = "card";

    const coverWrap = document.createElement("div");
    coverWrap.className = "card-cover-wrap";
    const img = document.createElement("img");
    img.className = "card-cover";
    img.src = coverFor(track);
    img.alt = "";
    const playBtn = document.createElement("button");
    playBtn.className = "card-play-btn";
    playBtn.textContent = "▶";
    playBtn.title = "Abspielen";
    playBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      exitSearchAndPlay(plIdx, trackIdx);
    });
    coverWrap.append(img, playBtn);
    attachAddButton(coverWrap, { source_playlist: library[plIdx].name, filename: track.file });

    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = track.title;
    const sub = document.createElement("div");
    sub.className = "card-sub";
    sub.textContent = `${track.artist || "Unbekannter Interpret"} · ${library[plIdx].name}`;

    card.append(coverWrap, title, sub);
    card.addEventListener("click", () => exitSearchAndPlay(plIdx, trackIdx));
    searchSongsGrid.appendChild(card);
  });
}

function renderSearchPlaylists(matches) {
  searchPlaylistsGrid.innerHTML = "";
  searchPlaylistsSection.classList.toggle("hidden", !matches.length);
  if (!matches.length) return;
  matches.forEach(({ pl, plIdx }) => {
    const card = document.createElement("div");
    card.className = "card";

    const coverWrap = document.createElement("div");
    coverWrap.className = "card-cover-wrap";
    const img = document.createElement("img");
    img.className = "card-cover";
    img.src = pl.cover || PLACEHOLDER_COVER;
    img.alt = "";
    coverWrap.appendChild(img);

    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = pl.name;
    const sub = document.createElement("div");
    sub.className = "card-sub";
    sub.textContent = `${pl.tracks.length} Titel`;

    card.append(coverWrap, title, sub);
    card.addEventListener("click", () => exitSearchAndOpenPlaylist(plIdx));
    searchPlaylistsGrid.appendChild(card);
  });
}

function exitSearchAndPlay(plIdx, trackIdx) {
  searchInput.value = "";
  setSearchActive(false);
  playTrackIn(plIdx, trackIdx);
}

function exitSearchAndOpenPlaylist(plIdx) {
  searchInput.value = "";
  setSearchActive(false);
  selectPlaylist(plIdx);
}

/* Online part of the search: hits YT Music via the backend, so it can
   find ANY song - not just what's already downloaded. Debounced (the
   local part stays instant per keystroke), and token-guarded so a slow
   response for an old query can't overwrite newer results. Cards reuse
   the Discover download flow: ⬇ saves straight into the "Entdeckt"
   playlist. */
const searchOnlineGrid = document.getElementById("searchOnlineGrid");
let onlineSearchTimer = null;
let onlineSearchToken = 0;

/* ===== Suchverlauf =====
   Zuletzt gesuchte Begriffe (nicht jeder Tastendruck - erst wenn die
   Online-Suche wirklich feuert, also der Nutzer beim Tippen kurz
   innegehalten hat) als Vorschläge, sobald die Suchleiste fokussiert und
   noch leer ist. */
const SEARCH_HISTORY_KEY = "searchHistory";
const SEARCH_HISTORY_MAX = 8;

function getSearchHistory() {
  try {
    const arr = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

function saveSearchHistoryEntry(q) {
  const query = q.trim();
  if (!query) return;
  let history = getSearchHistory().filter((h) => h.toLowerCase() !== query.toLowerCase());
  history.unshift(query);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, SEARCH_HISTORY_MAX)));
}

function removeSearchHistoryEntry(q) {
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(getSearchHistory().filter((h) => h !== q)));
  renderSearchHistoryDropdown();
}

function hideSearchHistoryDropdown() {
  searchHistoryDropdown.classList.add("hidden");
}

function renderSearchHistoryDropdown() {
  const history = getSearchHistory();
  searchHistoryDropdown.innerHTML = "";
  if (!history.length) {
    hideSearchHistoryDropdown();
    return;
  }
  history.forEach((q) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "search-history-item";
    const icon = document.createElement("span");
    icon.className = "search-history-icon";
    icon.textContent = "🕐";
    const text = document.createElement("span");
    text.className = "search-history-text";
    text.textContent = q;
    const remove = document.createElement("span");
    remove.className = "search-history-remove";
    remove.textContent = "✕";
    remove.addEventListener("click", (e) => {
      e.stopPropagation();
      removeSearchHistoryEntry(q);
    });
    item.append(icon, text, remove);
    item.addEventListener("click", () => {
      searchInput.value = q;
      performSearch();
      hideSearchHistoryDropdown();
    });
    searchHistoryDropdown.appendChild(item);
  });
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "search-history-clear";
  clearBtn.textContent = "Suchverlauf löschen";
  clearBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    hideSearchHistoryDropdown();
  });
  searchHistoryDropdown.appendChild(clearBtn);
  searchHistoryDropdown.classList.remove("hidden");
}

searchInput.addEventListener("focus", () => {
  if (!searchInput.value.trim()) renderSearchHistoryDropdown();
});
document.addEventListener("click", (e) => {
  if (e.target !== searchInput && !searchHistoryDropdown.contains(e.target)) hideSearchHistoryDropdown();
});

function updateSearchNothingState() {
  const anySectionVisible = !searchSongsSection.classList.contains("hidden") ||
    !searchPlaylistsSection.classList.contains("hidden") ||
    !searchOnlineSection.classList.contains("hidden");
  searchNothingAtAll.classList.toggle("hidden", anySectionVisible);
}

function renderOnlineResults(results) {
  searchOnlineGrid.innerHTML = "";
  searchOnlineSection.classList.toggle("hidden", !results.length);
  updateSearchNothingState();
  if (!results.length) return;
  results.forEach((rec) => searchOnlineGrid.appendChild(buildDiscoverCard(rec)));
}

async function runOnlineSearch(q, token) {
  try {
    const res = await fetch(`/api/library/search-online?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (token !== onlineSearchToken) return; // stale response for an older query
    renderOnlineResults(data.results || []);
  } catch (_) {
    if (token === onlineSearchToken) renderOnlineResults([]);
  }
}

function performSearch() {
  const q = searchInput.value.trim().toLowerCase();
  hideSearchHistoryDropdown();
  if (!q) {
    setSearchActive(false);
    clearTimeout(onlineSearchTimer);
    onlineSearchToken++;
    return;
  }
  // No library.length guard: with an empty library the local sections just
  // come up empty, but the online search still has to work.
  setSearchActive(true);

  const matchedTracks = [];
  const matchedPlaylists = [];
  library.forEach((pl, plIdx) => {
    if (pl.name.toLowerCase().includes(q)) matchedPlaylists.push({ pl, plIdx });
    pl.tracks.forEach((t, trackIdx) => {
      const haystack = `${t.title} ${t.artist || ""} ${t.album || ""}`.toLowerCase();
      if (haystack.includes(q)) matchedTracks.push({ track: t, plIdx, trackIdx });
    });
  });

  renderSearchSongs(matchedTracks);
  renderSearchPlaylists(matchedPlaylists);

  // Keep the online section visible with a loading hint while its request
  // is in flight, rather than hiding it and popping back in a moment
  // later - avoids the "did my search do anything?" flash, especially
  // when nothing local matched (the common "search a creator I haven't
  // downloaded yet" case this section exists for).
  searchOnlineGrid.innerHTML = "";
  searchOnlineSection.classList.remove("hidden");
  const loading = document.createElement("div");
  loading.className = "card-sub";
  loading.textContent = "🌐 Suche online …";
  searchOnlineGrid.appendChild(loading);
  updateSearchNothingState();
  clearTimeout(onlineSearchTimer);
  const token = ++onlineSearchToken;
  onlineSearchTimer = setTimeout(() => {
    saveSearchHistoryEntry(searchInput.value.trim());
    runOnlineSearch(searchInput.value.trim(), token);
  }, 450);
}

searchInput.addEventListener("input", performSearch);

/* ===== Offline Download (WLAN/Handy) =====
   Fetches every track's stream_url as a blob and triggers a real browser
   download via a throwaway <a download> - works over the same WLAN once
   the server is reachable at the PC's LAN IP (server already binds
   0.0.0.0). Sequential with a short pause between tracks so the browser
   doesn't treat a burst of programmatic downloads as spam and block them. */
function safeClientFilename(name) {
  return (name || "track").replace(/[\\/:*?"<>|]/g, "_").trim() || "track";
}

async function downloadPlaylistOffline() {
  if (!currentPlaylist || !currentPlaylist.tracks.length) return;
  const tracks = currentPlaylist.tracks;
  offlineDownloadBtn.disabled = true;
  let failed = 0;
  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i];
    showToast(`⬇️ Offline-Download ${i + 1}/${tracks.length}: „${t.title}"`);
    try {
      const res = await fetch(t.stream_url);
      if (!res.ok) throw new Error("Stream fehlgeschlagen");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeClientFilename(t.title)}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      await new Promise((resolve) => setTimeout(resolve, 400));
    } catch (err) {
      failed += 1;
    }
  }
  offlineDownloadBtn.disabled = false;
  const okCount = tracks.length - failed;
  showToast(
    failed
      ? `✅ ${okCount} Titel offline gespeichert, ${failed} fehlgeschlagen`
      : `✅ Alle ${okCount} Titel offline gespeichert`
  );
}

offlineDownloadBtn.addEventListener("click", downloadPlaylistOffline);

/* ===== Lyrics cache & prefetch =====
   get_lyrics_cached (Rust, via /api/lyrics in tauri-shim.js) reads a
   <file>.lyrics.json sidecar next to the actual track first - a song
   whose lyrics were ever looked up before opens with zero network
   requests, on any device, even after a reinstall (it's a real file next
   to the track, not browser storage). Prefetching the current + upcoming
   track's lyrics in the background as soon as playback starts (plus again
   once a track is 80% through, in case shuffle/queue changed what's
   actually next) means even a first-time view is usually already cached
   by the time someone taps the lyrics button. */
/* In-Memory-Cache vor dem Rust-Datei-Cache: der Datei-Cache macht das
   zweite Öffnen netzwerkfrei, aber immer noch einen IPC-Roundtrip + Datei-
   Lesen. Diese Map hält das fertige Ergebnis (als Promise, damit parallele
   Anfragen für denselben Song dedupliziert werden) direkt im JS-Heap -
   Mikro-Klick zeigt dann ohne jede messbare Verzögerung an. Gefüllt wird
   sie vom Playlist-weiten Prefetch unten, sobald eine Playlist geöffnet
   oder die Bibliothek geladen wird. */
const lyricsMemCache = new Map();
function lyricsCacheKey(playlist, file, title, artist) {
  return file ? `${playlist}\u0000${file}` : `${title}\u0000${artist}`;
}

async function fetchLyricsData(playlist, file, title, artist, duration, force = false) {
  const key = lyricsCacheKey(playlist, file, title, artist);
  // force=true (Retry-Button) ignoriert einen im-Memory gecachten
  // "nicht gefunden"-Treffer bewusst und fragt garantiert frisch an -
  // sonst wuerde dieselbe alte Antwort einfach nochmal zurueckgegeben.
  if (!force && lyricsMemCache.has(key)) return lyricsMemCache.get(key);
  const promise = (async () => {
    const params = new URLSearchParams({
      playlist: playlist || "",
      file: file || "",
      title: title || "",
      artist: artist || "",
    });
    if (duration && isFinite(duration) && duration > 0) params.set("duration", Math.round(duration));
    if (force) params.set("force", "1");
    const res = await fetch(`/api/lyrics?${params.toString()}`);
    return res.json();
  })();
  lyricsMemCache.set(key, promise);
  try {
    return await promise;
  } catch (err) {
    lyricsMemCache.delete(key); // Fehlschläge nicht einfrieren - nächster Versuch darf neu laden
    throw err;
  }
}

function prefetchLyrics(track) {
  if (!track || !track.title || !currentPlaylist) return;
  fetchLyricsData(currentPlaylist.name, track.file, track.title, track.artist, track.duration).catch(() => {});
}

/* Playlist-weiter Hintergrund-Prefetch: sobald eine Playlist geöffnet (oder
   die Bibliothek geladen) wird, werden ALLE Songtexte vorgeladen - erst in
   den Rust-Datei-Cache (einmalig übers Netz, danach nie wieder), dann in
   die Memory-Map oben. 3 Worker parallel, damit weder lrclib gehämmert
   noch der Main-Thread blockiert wird. Ein neuer Aufruf bricht den alten
   Durchlauf über das Token ab (Playlist-Wechsel). */
let playlistPrefetchToken = 0;
function prefetchPlaylistLyrics(pl) {
  if (!pl || !Array.isArray(pl.tracks) || !pl.tracks.length) return;
  const token = ++playlistPrefetchToken;
  const queue = pl.tracks.slice();
  const worker = async () => {
    while (queue.length && token === playlistPrefetchToken) {
      const t = queue.shift();
      if (!t || !t.title) continue;
      try {
        await fetchLyricsData(pl.name, t.file, t.title, t.artist, t.duration);
      } catch (_) { /* einzelner Fehlschlag stoppt den Rest nicht */ }
    }
  };
  for (let i = 0; i < 3; i++) worker();
}

/* Mirrors nextTrack()'s index selection (shuffle order / repeat mode)
   without touching playback - used purely to figure out which track to
   prefetch lyrics for. Guest-queue entries aren't playlist tracks with
   stable metadata to prefetch against, so those are skipped. */
function peekNextTrack() {
  if (userQueue.length || liveQueue.length || !currentPlaylist || !currentPlaylist.tracks.length) return null;
  if (isShuffle && shuffleOrder.length) {
    const pos = shuffleOrder.indexOf(currentTrackIndex);
    const nextPos = (pos + 1) % shuffleOrder.length;
    if (nextPos === 0 && repeatMode !== "all") return null;
    return currentPlaylist.tracks[shuffleOrder[nextPos]] || null;
  }
  let next = currentTrackIndex + 1;
  if (next >= currentPlaylist.tracks.length) {
    if (repeatMode !== "all") return null;
    next = 0;
  }
  return currentPlaylist.tracks[next] || null;
}

// Re-check once a track is most of the way through - covers shuffle/repeat
// getting toggled mid-song, which changes what peekNextTrack() returns
// compared to when playTrack() first fired its prefetch.
audioEl.addEventListener("timeupdate", () => {
  if (!audioEl.duration || !isFinite(audioEl.duration)) return;
  if (currentTrackIndex === prefetchedNextForTrack) return;
  if (audioEl.currentTime / audioEl.duration >= 0.8) {
    prefetchedNextForTrack = currentTrackIndex;
    prefetchLyrics(peekNextTrack());
  }
});

/* ===== Lyrics Overlay (karaoke-style synced highlighting) =====
   /api/lyrics returns `synced` (an LRC string with [mm:ss.xx] timestamps
   per line) when lrclib has the song, else just plain text. With synced
   lyrics every line becomes its own div and a timeupdate listener lights
   up whatever is being sung right now, keeps it vertically centered, and
   dims lines differently before/after. All text lands via textContent -
   lyrics come from external APIs and could contain arbitrary markup. */
let lyricsSyncLines = null; // [{t, el, words:[{start,end,el}]}] sorted by t, or null when unsynced
let lyricsActiveIdx = -1;
let lyricsRequestToken = 0; // drops stale responses after a quick track change
let lyricsShownForKey = null; // playlist::file, das das offene Overlay gerade zeigt

/* ===== Manuelle Sync-Justierung =====
   lrclib-Zeitstempel sind community-eingereicht und nicht immer exakt auf
   JEDE Version/jeden Rip abgestimmt - eine kleine, pro Song gemerkte
   Korrektur (+/- Sekunden) gleicht das aus, wenn der Songtext trotz der
   Silben-/Lücken-Verbesserung oben noch spürbar vor- oder nacheilt. */
const LYRICS_SYNC_KEY = "lyricsSyncOffsets";
let lyricsSyncOffset = 0;

function lyricsSyncStorageKey(title, artist) {
  return `${(artist || "").trim().toLowerCase()}::${(title || "").trim().toLowerCase()}`;
}

function loadLyricsSyncOffsets() {
  try {
    return JSON.parse(localStorage.getItem(LYRICS_SYNC_KEY) || "{}");
  } catch (_) {
    return {};
  }
}

function loadLyricsSyncOffsetFor(title, artist) {
  const all = loadLyricsSyncOffsets();
  return all[lyricsSyncStorageKey(title, artist)] || 0;
}

function saveLyricsSyncOffsetFor(title, artist, value) {
  const all = loadLyricsSyncOffsets();
  const key = lyricsSyncStorageKey(title, artist);
  if (Math.abs(value) < 0.05) delete all[key];
  else all[key] = value;
  localStorage.setItem(LYRICS_SYNC_KEY, JSON.stringify(all));
}

function updateLyricsSyncReadout() {
  if (!lyricsSyncReadout) return;
  const sign = lyricsSyncOffset > 0 ? "+" : "";
  lyricsSyncReadout.textContent = `${sign}${lyricsSyncOffset.toFixed(1)}s`;
}

function adjustLyricsSyncOffset(delta) {
  lyricsSyncOffset = Math.max(-10, Math.min(10, lyricsSyncOffset + delta));
  updateLyricsSyncReadout();
  if (nowPlayingMeta) saveLyricsSyncOffsetFor(nowPlayingMeta.title, nowPlayingMeta.artist, lyricsSyncOffset);
  updateLyricsHighlight();
}

function parseLrc(lrc) {
  const out = [];
  lrc.split("\n").forEach((raw) => {
    const times = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    if (!times.length) return;
    const text = raw.replace(/\[\d+:\d+(?:\.\d+)?\]/g, "").trim();
    times.forEach((m) => out.push({ t: Number(m[1]) * 60 + Number(m[2]), text }));
  });
  return out.sort((a, b) => a.t - b.t);
}

/* Grobe Silbenschätzung (Vokalgruppen zählen) statt reiner Zeichenlänge -
   "geschätzten" ist besser als "genau falsch": kurze Wörter mit vielen
   Vokalen ("eau") bekommen realistischer Gewicht als bei purer
   Zeichenzählung, und umgekehrt lange konsonantenlastige Wörter nicht
   übermäßig viel Zeit. */
function estimateSyllables(word) {
  const w = word.toLowerCase().replace(/[^a-zäöüß]/g, "");
  if (!w) return 1;
  const groups = w.match(/[aeiouyäöü]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

function textWeight(text) {
  return (
    text
      .split(/\s+/)
      .filter(Boolean)
      .reduce((sum, w) => sum + estimateSyllables(w) + 0.4, 0) || 1
  );
}

/* lrclib only ever gives one timestamp per LINE, never per word - true
   "wort für wort" sync data doesn't exist here to read (kein kostenloser
   Anbieter liefert das; Musixmatch RichSync o.ä. wäre kostenpflichtig).
   Das hier ist die bestmögliche Annäherung ohne solche Daten: Zeitfenster
   pro Wort, proportional zur geschätzten Silbenzahl verteilt.

   Wichtige Korrektur ("kommt manchmal nicht richtig hinterher"): bei einer
   grossen Lücke zwischen zwei Zeilen (Instrumental-Teil) wurde das LETZTE
   Wort früher auf die GESAMTE Lücke gestreckt und "kroch" quälend langsam
   bis zur nächsten Zeile. Jetzt wird eine plausible Sprechdauer aus der
   Silbenzahl geschätzt (~0.32s/Silbe) - ist die tatsächliche Lücke deutlich
   größer, endet das letzte Wort dort statt erst an der nächsten Zeile.

   "wenn er ein Wort lang zieht, soll's auch im Text lang gezogen werden":
   gehaltene Töne liegen musikalisch so gut wie immer auf dem LETZTEN Wort
   einer Zeile - bleibt nach der geschätzten Sprechdauer noch Luft bis zur
   nächsten Zeile, bekommt genau dieses letzte Wort einen begrenzten Bonus
   (max. 60% seiner Zeile bzw. 2.5s), statt die Lücke entweder zu ignorieren
   oder (der alte Bug) komplett draufzuschlagen. */
const SECONDS_PER_SYLLABLE_WEIGHT = 0.32;
const HELD_WORD_MAX_BONUS_SECONDS = 2.5;

function wordTimeWindows(text, lineStart, lineEnd) {
  const words = text.split(/(\s+)/).filter((w) => w !== "");
  const weights = words.map((w) => (/\s/.test(w) ? 0 : estimateSyllables(w) + 0.4));
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
  const rawSpan = Math.max(lineEnd - lineStart, 0.3);
  const naturalSpan = totalWeight * SECONDS_PER_SYLLABLE_WEIGHT;
  const duration = Math.min(rawSpan, Math.max(naturalSpan, 0.3));
  const slack = rawSpan - duration;
  const heldWordBonus = Math.max(0, Math.min(slack, duration * 0.6, HELD_WORD_MAX_BONUS_SECONDS));

  let acc = 0;
  const windows = words.map((w, i) => {
    const start = lineStart + (acc / totalWeight) * duration;
    acc += weights[i];
    const end = lineStart + (acc / totalWeight) * duration;
    return { text: w, isSpace: /\s/.test(w), start, end };
  });
  for (let i = windows.length - 1; i >= 0; i--) {
    if (!windows[i].isSpace) {
      windows[i].end += heldWordBonus;
      break;
    }
  }
  return windows;
}

/* Klammer-Ad-Libs ("(hold my hand)") nicht mehr inline in Klammern zeigen,
   sondern als eigene kleinere Zeile darunter (siehe renderSyncedLyrics) -
   extrahiert den/die Klammerinhalt(e) und liefert den Rest als Haupttext.
   Ist die KOMPLETTE Zeile nur eine Klammer, bleibt sie unangetastet (sonst
   verschwindet der einzige Text der Zeile aus der "Haupt"-Reihe). */
function splitAdlib(text) {
  const matches = [...text.matchAll(/\(([^()]+)\)/g)];
  if (!matches.length) return { main: text, adlib: "" };
  const main = text.replace(/\s*\([^()]+\)\s*/g, " ").replace(/\s+/g, " ").trim();
  if (!main) return { main: text, adlib: "" };
  const adlib = matches.map((m) => m[1].trim()).filter(Boolean).join(" ");
  return { main, adlib };
}

/* Baut die Wort-Spans (Klick-zum-Springen + Wisch-Glow) in `container` und
   gibt die {start,end,el}-Liste für updateLyricsHighlight() zurück. Von
   Haupt- UND Ad-Lib-Zeile gleichermaßen genutzt. */
function appendWordsToContainer(container, words) {
  const wordEls = [];
  words.forEach(({ text: w, isSpace, start, end }) => {
    if (isSpace) {
      container.appendChild(document.createTextNode(w));
      return;
    }
    // Two stacked copies of the same word (both via textContent - never
    // innerHTML, lyrics come from an external API): .lyrics-word-base is
    // the plain dim layer that always shows, .lyrics-word-fill is an
    // absolutely-positioned bright+glow duplicate that CSS clips down to
    // just the sung portion of THIS word via --wipe.
    const span = document.createElement("span");
    span.className = "lyrics-word";
    const base = document.createElement("span");
    base.className = "lyrics-word-base";
    base.textContent = w;
    const fill = document.createElement("span");
    fill.className = "lyrics-word-fill";
    fill.textContent = w;
    span.append(base, fill);
    // Klick auf ein Wort (egal ob vergangen oder zukünftig, egal ob
    // Haupt- oder Ad-Lib-Zeile) springt direkt an dessen Startzeit.
    span.addEventListener("click", (e) => {
      e.stopPropagation(); // sonst schließt der Overlay-Klick-außerhalb-Handler das Overlay
      if (isFinite(start)) {
        // t_lyrics = t_audio + Offset (siehe updateLyricsHighlight) - umgekehrt
        // aufgelöst, damit ein Klick auf ein Wort wirklich an den Moment
        // springt, an dem es tatsächlich gesungen wird.
        audioEl.currentTime = Math.max(0, start - lyricsSyncOffset);
        updateLyricsHighlight();
      }
    });
    container.appendChild(span);
    wordEls.push({ start, end, el: span });
  });
  return wordEls;
}

function renderSyncedLyrics(lines) {
  lyricsBody.textContent = "";
  lyricsBody.classList.remove("static");
  lyricsSyncLines = [];
  lyricsActiveIdx = -1;
  lines.forEach(({ t, text }, i) => {
    const div = document.createElement("div");
    div.className = "lyrics-line";
    const lineEnd = i + 1 < lines.length ? lines[i + 1].t : t + 6;
    const { main, adlib } = splitAdlib(text || "♪");

    let words = [];
    if (adlib) {
      // Ad-Lib folgt zeitlich auf den Haupttext (typisches Call-and-
      // Response-Muster) - Zeitbudget der Zeile proportional zum
      // geschätzten Sprechgewicht beider Teile aufteilen.
      const mainWeight = textWeight(main);
      const adlibWeight = textWeight(adlib);
      const splitPoint = t + (lineEnd - t) * (mainWeight / (mainWeight + adlibWeight));
      words = appendWordsToContainer(div, wordTimeWindows(main, t, splitPoint));

      const adlibDiv = document.createElement("div");
      adlibDiv.className = "lyrics-line-adlib";
      const adlibWords = appendWordsToContainer(adlibDiv, wordTimeWindows(adlib, splitPoint, lineEnd));
      div.appendChild(adlibDiv);
      words = words.concat(adlibWords);
    } else {
      words = appendWordsToContainer(div, wordTimeWindows(main, t, lineEnd));
    }

    lyricsBody.appendChild(div);
    lyricsSyncLines.push({ t, el: div, words });
  });
  updateLyricsHighlight();
}

function renderStaticLyrics(text, onRetry) {
  lyricsSyncLines = null;
  lyricsActiveIdx = -1;
  lyricsBody.classList.add("static");
  lyricsBody.textContent = "";
  const textEl = document.createElement("div");
  textEl.textContent = text;
  lyricsBody.appendChild(textEl);
  if (onRetry) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lyrics-retry-btn";
    btn.textContent = "🔄 Erneut versuchen";
    btn.addEventListener("click", onRetry);
    lyricsBody.appendChild(btn);
  }
}

/* Karaoke wipe: the active line's text fill sweeps left-to-right in real
   time between its own timestamp and the next line's, via a --wipe custom
   property driving a two-tone background-clip:text gradient (see CSS).
   Driven by requestAnimationFrame (not the `timeupdate` event, which
   browsers only fire a few times a second - visibly stepping instead of
   flowing) and reads audioEl.currentTime directly each frame, so it can
   never drift and self-corrects instantly on seek/pause/resume. */
let lyricsRafId = null;

function updateLyricsHighlight() {
  if (!lyricsSyncLines) return;
  // t_lyrics = t_audio + Offset: positiver Offset holt die Hervorhebung
  // nach vorn (korrigiert "Songtext eilt hinterher"), negativer schiebt sie
  // zurück ("Songtext eilt voraus").
  const t = audioEl.currentTime + lyricsSyncOffset;
  let idx = -1;
  for (let i = 0; i < lyricsSyncLines.length; i++) {
    if (lyricsSyncLines[i].t <= t) idx = i;
    else break;
  }

  if (idx !== lyricsActiveIdx) {
    lyricsSyncLines.forEach(({ el, words }, i) => {
      el.classList.toggle("active", i === idx);
      el.classList.toggle("sung", i < idx); // seek-safe: recomputed every change
      if (i !== idx) words.forEach(({ el: wEl }) => wEl.style.removeProperty("--wipe"));
    });
    lyricsActiveIdx = idx;
    if (idx >= 0) {
      lyricsSyncLines[idx].el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  // Wort für Wort statt eines gleichmäßigen Wischs über die ganze Zeile:
  // jedes Wort hat sein eigenes geschätztes Zeitfenster (wordTimeWindows),
  // volle Helligkeit sobald die aktuelle Zeit sein Fenster passiert hat,
  // 0 davor, dazwischen ein weicher Übergang - so leuchtet immer nur das
  // gerade gesungene Wort auf statt der ganzen Zeile auf einmal.
  if (idx >= 0) {
    lyricsSyncLines[idx].words.forEach(({ start, end, el: wEl }) => {
      const pct = Math.min(Math.max((t - start) / Math.max(end - start, 0.05), 0), 1) * 100;
      wEl.style.setProperty("--wipe", `${pct.toFixed(1)}%`);
    });
  }
}

function lyricsFrameLoop() {
  updateLyricsHighlight();
  lyricsRafId = lyricsOverlay.classList.contains("hidden") ? null : requestAnimationFrame(lyricsFrameLoop);
}

function startLyricsLoop() {
  if (lyricsRafId === null) lyricsRafId = requestAnimationFrame(lyricsFrameLoop);
}

function stopLyricsLoop() {
  if (lyricsRafId !== null) {
    cancelAnimationFrame(lyricsRafId);
    lyricsRafId = null;
  }
}

async function openLyrics(force = false) {
  if (!nowPlayingMeta) {
    showToast("Gerade wird kein Titel abgespielt.");
    return;
  }
  const meta = nowPlayingMeta;
  lyricsShownForKey = `${meta.playlist || ""}::${meta.file || ""}`;
  const token = ++lyricsRequestToken;
  lyricsOverlay.classList.remove("hidden");
  startLyricsLoop();
  lyricsTitle.textContent = meta.title;
  lyricsArtist.textContent = meta.artist || "Unbekannter Interpret";
  lyricsSyncOffset = loadLyricsSyncOffsetFor(meta.title, meta.artist);
  updateLyricsSyncReadout();
  renderStaticLyrics(force ? "Suche erneut …" : "Lade Songtext …");
  try {
    const data = await fetchLyricsData(meta.playlist, meta.file, meta.title, meta.artist, audioEl.duration, force);
    if (token !== lyricsRequestToken) return; // a newer track's request superseded this one
    if (data.synced) {
      const lines = parseLrc(data.synced);
      if (lines.length) {
        renderSyncedLyrics(lines);
        return;
      }
    }
    if (data.found) {
      renderStaticLyrics(data.lyrics);
    } else {
      renderStaticLyrics(`${meta.title}\n\nKeine Lyrics gefunden.`, () => openLyrics(true));
    }
  } catch (err) {
    if (token === lyricsRequestToken) renderStaticLyrics("Songtext konnte nicht geladen werden.", () => openLyrics(true));
  }
}

function closeLyrics() {
  lyricsOverlay.classList.add("hidden");
  stopLyricsLoop();
  lyricsSyncLines = null;
  lyricsActiveIdx = -1;
  lyricsShownForKey = null;
}

/* Bei JEDEM Trackwechsel aufgerufen (direkter Wechsel UND Crossfade-
   Handoff) - reicht ein offenes Songtext-Overlay auf den neuen Song durch,
   statt die alten Zeilen weiter hervorzuheben. Ein "loadedmetadata"-Listener
   allein reicht dafür NICHT: beim Crossfade-Handoff wurde das Ghost-Element
   schon lange VOR dem Rollentausch (während es noch der leise vorbereitete
   "nächste Song" war) geladen - das Event feuerte da längst und nie wieder,
   das war der eigentliche Bug ("Songtext komplett kaputt beim neuen Song"). */
function refreshLyricsIfOpen() {
  if (lyricsOverlay.classList.contains("hidden") || !nowPlayingMeta) return;
  const key = `${nowPlayingMeta.playlist || ""}::${nowPlayingMeta.file || ""}`;
  if (key !== lyricsShownForKey) openLyrics();
}

pbLyrics.addEventListener("click", openLyrics);
lyricsCloseBtn.addEventListener("click", closeLyrics);
lyricsOverlay.addEventListener("click", (e) => {
  if (e.target === lyricsOverlay) closeLyrics();
});
lyricsSyncMinus.addEventListener("click", () => adjustLyricsSyncOffset(-0.3));
lyricsSyncPlus.addEventListener("click", () => adjustLyricsSyncOffset(0.3));
lyricsSyncReadout.addEventListener("click", () => {
  lyricsSyncOffset = 0;
  updateLyricsSyncReadout();
  if (nowPlayingMeta) saveLyricsSyncOffsetFor(nowPlayingMeta.title, nowPlayingMeta.artist, 0);
  updateLyricsHighlight();
});

/* ===== Sidebar tool popovers (QR / Party / Design) =====
   One generic open/close manager instead of duplicating the eq-popover
   pattern three more times. */
const sidebarPopovers = [
  { btn: qrToggleBtn, popover: qrPopover, onOpen: () => { qrImage.src = `/api/qr?t=${Date.now()}`; } },
  { btn: partyPopoverToggleBtn, popover: partyPopover },
  { btn: themeToggleBtn, popover: themePopover },
];

function closeAllSidebarPopovers() {
  sidebarPopovers.forEach(({ btn, popover }) => {
    popover.classList.add("hidden");
    btn.classList.remove("active");
  });
}

sidebarPopovers.forEach(({ btn, popover, onOpen }) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = popover.classList.contains("hidden");
    closeAllSidebarPopovers();
    if (willOpen) {
      popover.classList.remove("hidden");
      btn.classList.add("active");
      if (onOpen) onOpen();
    }
  });
});
document.addEventListener("click", (e) => {
  const clickedInsideAny = sidebarPopovers.some(
    ({ btn, popover }) => popover.contains(e.target) || btn === e.target
  );
  if (!clickedInsideAny) closeAllSidebarPopovers();
});

/* ===== Themes ===== */
const THEME_STORAGE_KEY = "meineMusikTheme";

function applyTheme(theme) {
  if (theme && theme !== "spotify-green") {
    document.documentElement.setAttribute("data-theme", theme);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  themeOptionBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === (theme || "spotify-green"));
  });
  localStorage.setItem(THEME_STORAGE_KEY, theme || "spotify-green");
}

themeOptionBtns.forEach((btn) => {
  btn.addEventListener("click", () => applyTheme(btn.dataset.theme));
});

applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || "spotify-green");

/* ===== Party mode (synced playback across devices) =====
   This device is always the *source* while party mode is on - it POSTs
   its own playback snapshot on an interval (and immediately after any
   play/pause/track-change), the server just relays it to every guest
   device over SSE. The host never listens for party_sync itself, so
   there's no feedback loop to worry about. */
/* Teilnehmerliste im Freunde-Popover: Gast-Seiten melden sich beim
   Party-Server an (join/heartbeat, party.rs) - jede Änderung kommt als
   "participants"-Event über den SSE/Event-Bus rein, initial einmal per
   Fetch. */
const qrParticipantsTitle = document.getElementById("qrParticipantsTitle");
const qrParticipantList = document.getElementById("qrParticipantList");

function renderParticipants(list) {
  if (!qrParticipantList) return;
  qrParticipantsTitle.classList.toggle("hidden", !list.length);
  qrParticipantList.innerHTML = "";
  list.forEach((p) => {
    const row = document.createElement("div");
    row.className = "qr-participant";
    const dot = document.createElement("span");
    dot.className = "qr-participant-dot";
    const name = document.createElement("span");
    name.className = "qr-participant-name";
    name.textContent = p.name || "Gast";
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "qr-participant-remove";
    removeBtn.textContent = "✕";
    removeBtn.title = "Aus der Party entfernen";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      fetch(`/api/party/participants/${encodeURIComponent(p.id)}`, { method: "DELETE" })
        .then((r) => r.json())
        .then((d) => renderParticipants(d.participants || []))
        .catch(() => {});
    });
    row.append(dot, name, removeBtn);
    qrParticipantList.appendChild(row);
  });
}

fetch("/api/party/participants")
  .then((r) => r.json())
  .then((d) => renderParticipants(d.participants || []))
  .catch(() => {});

/* Skip-Abstimmung: Gäste stimmen auf ihrer Seite ab (party.rs zählt und
   entscheidet die Mehrheit), der Host bekommt hier nur den Stand zum
   Anzeigen und - sobald die Schwelle erreicht ist - das Signal zum echten
   Skip. */
const partySkipStatus = document.getElementById("partySkipStatus");
function renderSkipVotes({ count, needed }) {
  if (!partySkipStatus) return;
  partySkipStatus.classList.toggle("hidden", !count);
  if (count) partySkipStatus.textContent = `🙋 Skip-Wunsch: ${count}/${needed}`;
}

let partyModeActive = false;
let partyHeartbeatTimer = null;

// Party-Verlauf: welche Titel liefen waehrend dieser Session - rein
// clientseitig (der Host ist ohnehin die einzige Quelle von Trackwechseln),
// Grundlage fuer "Verlauf als Playlist speichern" weiter unten.
let partyHistory = [];
function trackPartyHistory() {
  if (!partyModeActive || !nowPlayingMeta || !nowPlayingMeta.file) return;
  const last = partyHistory[partyHistory.length - 1];
  if (last && last.playlist === nowPlayingMeta.playlist && last.file === nowPlayingMeta.file) return;
  partyHistory.push({
    playlist: nowPlayingMeta.playlist,
    file: nowPlayingMeta.file,
    title: nowPlayingMeta.title,
    artist: nowPlayingMeta.artist,
  });
}

function sendPartyHeartbeat() {
  if (!partyModeActive) return;
  trackPartyHistory();
  fetch("/api/party/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      active: true,
      playlist: nowPlayingMeta?.playlist || "",
      file: nowPlayingMeta?.file || "",
      title: nowPlayingMeta?.title || "",
      artist: nowPlayingMeta?.artist || "",
      cover: nowPlayingMeta?.cover || null,
      stream_url: nowPlayingMeta?.stream_url || "",
      position: audioEl.currentTime || 0,
      playing: !audioEl.paused,
    }),
  }).catch(() => {});
}

function setPartyMode(active) {
  partyModeActive = active;
  partyModeBtn.classList.toggle("active", active);
  partyModeBtn.textContent = active ? "Party beenden" : "Party starten";
  partyPopoverToggleBtn.classList.toggle("active", active);
  partyStatusText.textContent = active
    ? "Aktiv – alle Geräte im WLAN hören jetzt synchron mit."
    : "Spielt auf allen Geräten im WLAN exakt denselben Song synchron ab.";
  partyChatSection.classList.toggle("hidden", !active);

  clearInterval(partyHeartbeatTimer);
  if (active) {
    partyHistory = [];
    loadPartyChat();
    sendPartyHeartbeat();
    partyHeartbeatTimer = setInterval(sendPartyHeartbeat, 2000);
    showToast("🎉 Party-Modus gestartet");
  } else {
    fetch("/api/party/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    }).catch(() => {});
    showToast("🎉 Party-Modus beendet");
  }
}

/* ===== Party-Chat ===== */
const partyChatSection = document.getElementById("partyChatSection");
const partyChatMessages = document.getElementById("partyChatMessages");
const partyChatInput = document.getElementById("partyChatInput");
const partyChatSendBtn = document.getElementById("partyChatSendBtn");
const partySaveHistoryBtn = document.getElementById("partySaveHistoryBtn");

function appendChatMessage(msg) {
  const row = document.createElement("div");
  row.className = "party-chat-msg";
  const name = document.createElement("span");
  name.className = "party-chat-msg-name";
  name.textContent = msg.name || "Gast";
  const text = document.createElement("span");
  text.className = "party-chat-msg-text";
  text.textContent = msg.text || "";
  row.append(name, text);
  partyChatMessages.appendChild(row);
  partyChatMessages.scrollTop = partyChatMessages.scrollHeight;
}

async function loadPartyChat() {
  partyChatMessages.innerHTML = "";
  try {
    const res = await fetch("/api/party/chat");
    const data = await res.json();
    (data.messages || []).forEach(appendChatMessage);
  } catch (_) {}
}

async function sendPartyChatMessage() {
  const text = partyChatInput.value.trim();
  if (!text) return;
  partyChatInput.value = "";
  try {
    await fetch("/api/party/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (_) {}
}
partyChatSendBtn.addEventListener("click", sendPartyChatMessage);
partyChatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendPartyChatMessage();
});

/* ===== Party-Verlauf als Playlist speichern =====
   Kopiert jeden in dieser Session gespielten Track (add_track_to_playlist,
   dieselbe Kopier-Logik wie beim manuellen "Zu Playlist hinzufügen") in
   eine neue Playlist - die Originaldateien bleiben unangetastet. */
async function savePartyHistoryAsPlaylist() {
  if (!partyHistory.length) {
    showToast("In dieser Party wurde noch nichts gespielt.");
    return;
  }
  const defaultName = `Party vom ${new Date().toLocaleDateString("de-DE")}`;
  const name = window.prompt("Name der neuen Playlist:", defaultName);
  if (!name || !name.trim()) return;
  const cleanName = name.trim();

  const seen = new Set();
  const unique = partyHistory.filter((e) => {
    const key = `${e.playlist}::${e.file}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let ok = 0;
  for (const entry of unique) {
    try {
      const res = await fetch("/api/playlists/add-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_playlist: cleanName,
          source_playlist: entry.playlist,
          filename: entry.file,
        }),
      });
      if (res.ok) ok++;
    } catch (_) {}
  }
  await refreshLibrary();
  showToast(`🎉 ${ok} von ${unique.length} Songs in „${cleanName}" gespeichert`);
}
partySaveHistoryBtn.addEventListener("click", savePartyHistoryAsPlaylist);

partyModeBtn.addEventListener("click", () => setPartyMode(!partyModeActive));
// Track changes and pause/play should reach guests immediately, not just
// on the next 2s tick.
audioEl.addEventListener("play", sendPartyHeartbeat);
audioEl.addEventListener("pause", sendPartyHeartbeat);

/* ===== Realtime bus: collaborative queue + remote hotkeys =====
   Single shared SSE connection - /guest also listens on the same
   endpoint for queue_update, so adding a song there shows up here (and
   vice versa) without polling. */
async function loadQueueOnce() {
  try {
    const res = await fetch("/api/queue");
    const data = await res.json();
    liveQueue = data.queue || [];
  } catch (_) {
    liveQueue = [];
  }
}

function handleRemoteCommand(action) {
  switch (action) {
    case "next":
      nextTrack();
      break;
    case "prev":
      prevTrack();
      break;
    case "toggle_play":
      togglePlayPause();
      break;
    case "toggle_like":
      toggleLike();
      break;
  }
}

if ("EventSource" in window) {
  const hostEvents = new EventSource("/api/events");
  hostEvents.addEventListener("queue_update", (e) => {
    try {
      liveQueue = JSON.parse(e.data).queue || [];
      renderQueuePanel();
    } catch (_) {
      // keep whatever we had
    }
  });
  hostEvents.addEventListener("participants", (e) => {
    try {
      renderParticipants(JSON.parse(e.data).participants || []);
    } catch (_) {}
  });
  hostEvents.addEventListener("remote_command", (e) => {
    try {
      handleRemoteCommand(JSON.parse(e.data).action);
    } catch (_) {
      // ignore malformed event
    }
  });
  hostEvents.addEventListener("skip_votes", (e) => {
    try {
      renderSkipVotes(JSON.parse(e.data));
    } catch (_) {}
  });
  // Mehrheit erreicht (party.rs zählt) - echter Skip auf dem Host. Kein
  // Toast/Bestätigung noetig, das war ja bereits der demokratische Wille
  // der Gaeste.
  hostEvents.addEventListener("skip_now", () => {
    if (partyModeActive) nextTrack();
  });
  hostEvents.addEventListener("chat_message", (e) => {
    try {
      appendChatMessage(JSON.parse(e.data));
    } catch (_) {}
  });
}

/* ===== Hotkeys =====
   Works whenever this browser tab is focused - a plain web page can never
   see keystrokes while unfocused/backgrounded (browser sandbox limit).
   True system-wide hotkeys (works even minimized) come from desktop.py's
   separate OS-level keyboard hook, which relays here as "remote_command"
   SSE events above - both paths end up calling the exact same functions,
   so behaviour is identical either way. Every combo is user-configurable
   (see HOTKEY_ACTIONS above) - this listener just looks up whichever
   action currently owns the pressed combo and runs it. */
document.addEventListener("keydown", (e) => {
  if (recordingActionId) return; // settings modal is capturing this keystroke instead
  // Don't hijack any combo while the user is typing in a text field.
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea") return;

  const action = HOTKEY_ACTIONS.find((a) => matchesHotkey(e, hotkeyBindings[a.id]));
  if (!action) return;
  e.preventDefault();
  action.fn();
});

/* ===== Trash (Papierkorb) ===== */
async function loadTrash() {
  let entries = [];
  try {
    const res = await fetch("/api/trash");
    const data = await res.json();
    entries = data.trash || [];
  } catch (_) {
    entries = [];
  }
  renderTrash(entries);
}

function renderTrash(entries) {
  trashTableBody.innerHTML = "";
  trashEmpty.classList.toggle("hidden", entries.length > 0);
  entries
    .slice()
    .sort((a, b) => (b.trashed_at || 0) - (a.trashed_at || 0))
    .forEach((entry) => {
      const tr = document.createElement("tr");
      tr.className = "track-row";

      const tdTitle = document.createElement("td");
      tdTitle.textContent = entry.filename;

      const tdPlaylist = document.createElement("td");
      tdPlaylist.textContent = entry.playlist;

      const tdDate = document.createElement("td");
      tdDate.textContent = entry.trashed_at
        ? new Date(entry.trashed_at * 1000).toLocaleString("de-DE")
        : "—";

      const tdActions = document.createElement("td");
      tdActions.className = "trash-actions-cell";
      const restoreBtn = document.createElement("button");
      restoreBtn.className = "trash-restore-btn";
      restoreBtn.textContent = "↩️";
      restoreBtn.title = "Wiederherstellen";
      restoreBtn.addEventListener("click", () => restoreTrashEntry(entry.id));
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "trash-delete-btn";
      deleteBtn.textContent = "🗑";
      deleteBtn.title = "Endgültig löschen";
      deleteBtn.addEventListener("click", () => deleteTrashEntryForever(entry.id));
      tdActions.append(restoreBtn, deleteBtn);

      tr.append(tdTitle, tdPlaylist, tdDate, tdActions);
      trashTableBody.appendChild(tr);
    });
}

async function restoreTrashEntry(id) {
  try {
    const res = await fetch(`/api/trash/${id}/restore`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Wiederherstellen fehlgeschlagen.");
    showToast("↩️ Titel wiederhergestellt");
    await refreshLibrary();
    await loadTrash();
  } catch (err) {
    showToast(err.message || "Wiederherstellen fehlgeschlagen.");
  }
}

/* ===== Duplikat-Erkennung =====
   find_duplicates (Rust) gruppiert alle Tracks der ganzen Bibliothek nach
   normalisiertem Titel+Interpret - z.B. derselbe Song, der versehentlich in
   zwei Playlists gelandet ist. Löschen nutzt denselben Weg wie ein
   normales Entfernen aus einer Playlist (Papierkorb, kein Hard-Delete). */
async function loadDuplicates() {
  let groups = [];
  try {
    const res = await fetch("/api/duplicates");
    const data = await res.json();
    groups = data.groups || [];
  } catch (_) {
    groups = [];
  }
  renderDuplicates(groups);
}

function renderDuplicates(groups) {
  duplicatesList.innerHTML = "";
  duplicatesEmpty.classList.toggle("hidden", groups.length > 0);
  groups.forEach((group) => {
    const card = document.createElement("div");
    card.className = "duplicate-group-card";
    const heading = document.createElement("div");
    heading.className = "duplicate-group-heading";
    heading.textContent = `${group.label} (${group.tracks.length}×)`;
    card.appendChild(heading);

    group.tracks.forEach((t, i) => {
      const row = document.createElement("div");
      row.className = "duplicate-track-row";
      const info = document.createElement("div");
      info.className = "duplicate-track-info";
      info.textContent = `${i === 0 ? "★ " : ""}${t.playlist} — ${t.file}`;
      const delBtn = document.createElement("button");
      delBtn.className = "trash-delete-btn";
      delBtn.textContent = "🗑";
      delBtn.title = "In den Papierkorb verschieben";
      delBtn.addEventListener("click", async () => {
        try {
          const res = await fetch(
            `/api/library/track/${encodeURIComponent(t.playlist)}/${encodeURIComponent(t.file)}`,
            { method: "DELETE" }
          );
          if (!res.ok) throw new Error("Löschen fehlgeschlagen.");
          showToast("🗑 In den Papierkorb verschoben");
          // Duplikate-Ansicht ist nicht an currentPlaylist/currentTrackIndex
          // gebunden (kann aus jeder Playlist loeschen) - deshalb hier extra
          // gegen nowPlayingMeta pruefen, statt wie in deleteTrack() gegen
          // den Index. Sonst zeigt der Player weiter auf eine gerade
          // verschobene Datei.
          if (nowPlayingMeta && nowPlayingMeta.playlist === t.playlist && nowPlayingMeta.file === t.file) {
            audioEl.pause();
            audioEl.removeAttribute("src");
            currentTrackIndex = -1;
            nowPlayingMeta = null;
            updatePlayButton(false);
            pbTitle.textContent = "Kein Titel ausgewählt";
            pbArtist.textContent = "—";
            updateVideoButtonVisibility();
            closeVideoViewIfOpenForTrackChange();
          }
          await refreshLibrary();
          await loadDuplicates();
        } catch (err) {
          showToast(err.message || "Löschen fehlgeschlagen.");
        }
      });
      row.append(info, delBtn);
      card.appendChild(row);
    });
    duplicatesList.appendChild(card);
  });
}

async function deleteTrashEntryForever(id) {
  showConfirmModal(
    "Endgültig löschen?",
    "Diese Datei wird unwiderruflich gelöscht und kann nicht wiederhergestellt werden.",
    async () => {
      try {
        const res = await fetch(`/api/trash/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Löschen fehlgeschlagen.");
        showToast("🗑 Endgültig gelöscht");
        await loadTrash();
      } catch (err) {
        showToast(err.message || "Löschen fehlgeschlagen.");
      }
    }
  );
}

/* ===== Init ===== */
audioEl.volume = 0.8;
loadQueueOnce();
loadLibrary();
