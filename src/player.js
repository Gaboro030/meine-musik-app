/* ===== DOM Elements ===== */
const playlistList = document.getElementById("playlistList");
const playlistListEmpty = document.getElementById("playlistListEmpty");
const emptyState = document.getElementById("emptyState");
const homeView = document.getElementById("homeView");
const libraryView = document.getElementById("libraryView");
const playlistView = document.getElementById("playlistView");
const homeGreeting = document.getElementById("homeGreeting");
const recentGrid = document.getElementById("recentGrid");
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
const playlistDropzone = document.getElementById("playlistDropzone");
const libraryDropzone = document.getElementById("libraryDropzone");
const libraryFileInput = document.getElementById("libraryFileInput");
const offlineDownloadBtn = document.getElementById("offlineDownloadBtn");

const searchInput = document.getElementById("searchInput");
const searchView = document.getElementById("searchView");
const searchSongsGrid = document.getElementById("searchSongsGrid");
const searchPlaylistsGrid = document.getElementById("searchPlaylistsGrid");
const searchSongsSection = document.getElementById("searchSongsSection");
const searchPlaylistsSection = document.getElementById("searchPlaylistsSection");
const searchOnlineSection = document.getElementById("searchOnlineSection");
const searchNothingAtAll = document.getElementById("searchNothingAtAll");

const trashView = document.getElementById("trashView");
const trashTableBody = document.getElementById("trashTableBody");
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
const hotkeyList = document.getElementById("hotkeyList");

const pbLyrics = document.getElementById("pbLyrics");
const lyricsOverlay = document.getElementById("lyricsOverlay");
const lyricsTitle = document.getElementById("lyricsTitle");
const lyricsArtist = document.getElementById("lyricsArtist");
const lyricsBody = document.getElementById("lyricsBody");
const lyricsCloseBtn = document.getElementById("lyricsCloseBtn");

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
const audioEl = document.getElementById("audioEl");

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
let prefetchedNextForTrack = -1; // guards the 80%-progress re-check below from firing more than once per track
let isLiked = false;
let currentView = "home"; // home | library | playlist
let previousView = "home"; // where the back arrow returns to from playlist view
let nowPlayingMeta = null; // {playlist, file, title, artist, cover, stream_url} - feeds party-mode heartbeat
let liveQueue = []; // collaborative queue from guest phones, kept in sync via SSE

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
  // Trash must stay reachable even with an empty library (everything
  // could be sitting in the trash) - every other view still needs at
  // least one real playlist to show.
  if (!library.length && view !== "trash") {
    emptyState.classList.remove("hidden");
    homeView.classList.add("hidden");
    libraryView.classList.add("hidden");
    playlistView.classList.add("hidden");
    trashView.classList.add("hidden");
    navBackBtn.disabled = true;
    return;
  }

  emptyState.classList.add("hidden");
  homeView.classList.toggle("hidden", view !== "home");
  libraryView.classList.toggle("hidden", view !== "library");
  playlistView.classList.toggle("hidden", view !== "playlist");
  trashView.classList.toggle("hidden", view !== "trash");

  document.querySelectorAll(".nav-item[data-view]").forEach((el) => {
    el.classList.toggle("active", el.dataset.view === view);
  });

  if (view !== "playlist") {
    previousView = view;
    playlistList.querySelectorAll(".playlist-item").forEach((el) => el.classList.remove("active"));
  }
  navBackBtn.disabled = view !== "playlist";
  if (view === "trash") loadTrash();

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

  loadDiscover();
  loadDiscoverArtistRows();
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
  coverWrap.append(img, dlBtn);
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

async function downloadDiscoverTrack(rec, btn) {
  btn.disabled = true;
  btn.textContent = "⏳";
  try {
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
  // different track list and would freeze/duplicate the queue.
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
      updatePlayButton(false);
      pbTitle.textContent = "Kein Titel ausgewählt";
      pbArtist.textContent = "—";
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

/* ===== Track Table ===== */
function renderTrackTable() {
  trackTableBody.innerHTML = "";
  currentPlaylist.tracks.forEach((t, i) => {
    const tr = document.createElement("tr");
    tr.className = "track-row";
    tr.dataset.index = i;

    const tdIndex = document.createElement("td");
    tdIndex.className = "col-index";
    tdIndex.innerHTML = `<span class="track-num">${i + 1}</span><span class="track-play-icon">▶</span>`;

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

    tr.append(tdIndex, tdTitle, tdAlbum, tdDuration, tdAdd, tdRemove);
    tr.addEventListener("click", () => {
      // Klick auf den bereits laufenden Track: pausieren bzw. fortsetzen
      // statt von vorne zu starten.
      if (i === currentTrackIndex && nowPlayingMeta && nowPlayingMeta.stream_url === t.stream_url) {
        togglePlayPause();
      } else {
        playTrack(i);
      }
    });
    trackTableBody.appendChild(tr);
  });
  highlightPlayingRow();
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
  shuffleOrder = order;
}

function playTrack(index) {
  if (!currentPlaylist || !currentPlaylist.tracks[index]) return;
  currentTrackIndex = index;
  const track = currentPlaylist.tracks[index];

  initAudioGraph();
  resetFadeForNewTrack();

  audioEl.src = track.stream_url;
  audioEl.play().catch(() => {});

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
}

/* Plays a track handed over from the collaborative queue (guest phones).
   Not tied to currentPlaylist/currentTrackIndex - it has its own full
   metadata already, so this bypasses the indexed playTrack() path
   entirely instead of trying to force it into a playlist context it
   doesn't belong to. */
function playQueuedEntry(entry) {
  initAudioGraph();
  resetFadeForNewTrack();

  audioEl.src = entry.stream_url;
  audioEl.play().catch(() => {});

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
    playlist: "",
    file: "",
    title: entry.title,
    artist: entry.artist,
    cover: entry.cover,
    stream_url: entry.stream_url,
  };

  fetch(`/api/queue/${entry.id}`, { method: "DELETE" }).catch(() => {});
  showToast(`👥 Aus der Warteschlange: „${entry.title}"`);
}

function updatePlayButton(playing) {
  pbPlay.textContent = playing ? "⏸" : "▶";
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
  // Guest-queued songs always take priority over normal playlist advance,
  // same as every music app's "up next" queue.
  if (liveQueue.length) {
    const entry = liveQueue.shift();
    playQueuedEntry(entry);
    return;
  }
  if (!currentPlaylist || !currentPlaylist.tracks.length) return;
  if (isShuffle) {
    const pos = shuffleOrder.indexOf(currentTrackIndex);
    const nextPos = (pos + 1) % shuffleOrder.length;
    if (nextPos === 0 && repeatMode !== "all") {
      updatePlayButton(false);
      return;
    }
    playTrack(shuffleOrder[nextPos]);
    return;
  }
  let next = currentTrackIndex + 1;
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
  pbRepeat.textContent = repeatMode === "one" ? "🔂" : "🔁";
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

audioEl.addEventListener("ended", () => {
  if (repeatMode === "one") {
    audioEl.currentTime = 0;
    audioEl.play().catch(() => {});
    return;
  }
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

audioEl.addEventListener("playing", () => {
  consecutiveAudioErrors = 0;
});

audioEl.addEventListener("error", () => {
  // deleteTrack() intentionally clears src, which also fires an error
  // event - that's not a stream failure, so ignore it.
  if (!audioEl.getAttribute("src")) return;

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
  audioEl.volume = pct;
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
let audioGraphReady = false;
const eqSettings = { bass: 0, mid: 0, treble: 0 };

function initAudioGraph() {
  if (audioGraphReady) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return; // very old browser - playback still works, just no EQ/fade
  audioCtx = new Ctx();
  const source = audioCtx.createMediaElementSource(audioEl);

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
  normalizerCompressor.threshold.value = -24;
  normalizerCompressor.knee.value = 30;
  normalizerCompressor.ratio.value = 12;
  normalizerCompressor.attack.value = 0.003;
  normalizerCompressor.release.value = 0.25;

  masterGain = audioCtx.createGain();
  masterGain.gain.value = 1;

  source.connect(eqBass).connect(eqMid).connect(eqTreble).connect(normalizerCompressor).connect(masterGain).connect(audioCtx.destination);
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

/* Simple single-element "soft crossfade": ramp the master gain down over
   the last FADE_SECONDS of a track, then playTrack() (via
   resetFadeForNewTrack) ramps the next track back up from a low starting
   gain. No overlapping second <audio> element, so nothing about
   next/prev/shuffle/repeat track selection needed to change. */
const FADE_SECONDS = 2.5;
const FADE_IN_SECONDS = 1.2;
const FADE_FLOOR = 0.05;
let fadingOut = false;

function resetFadeForNewTrack() {
  fadingOut = false;
  if (!masterGain || !audioCtx) return;
  const now = audioCtx.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(FADE_FLOOR, now);
  masterGain.gain.linearRampToValueAtTime(1, now + FADE_IN_SECONDS);
}

function maybeStartFadeOut() {
  if (!masterGain || !audioCtx || fadingOut) return;
  if (!audioEl.duration || !isFinite(audioEl.duration)) return;
  const remaining = audioEl.duration - audioEl.currentTime;
  if (remaining <= FADE_SECONDS && remaining > 0) {
    fadingOut = true;
    const now = audioCtx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(FADE_FLOOR, now + remaining);
  }
}

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
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }
      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);
      ambientGlowEl.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
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
  }
}

function toggleGlow() {
  setGlowEnabled(!glowEnabled);
}

glowToggleSwitch.addEventListener("click", () => setGlowEnabled(!glowEnabled));
glowToggleSwitch.classList.toggle("active", glowEnabled);
glowToggleSwitch.setAttribute("aria-checked", String(glowEnabled));
if (!glowEnabled) ambientGlowEl.classList.add("glow-off");

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
    const res = await fetch("/api/playlists/add-track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_playlist: targetPlaylist, ...trackData }),
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
  [emptyState, homeView, libraryView, playlistView, trashView].forEach((el) => {
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
  onlineSearchTimer = setTimeout(() => runOnlineSearch(searchInput.value.trim(), token), 450);
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

async function fetchLyricsData(playlist, file, title, artist, duration) {
  const key = lyricsCacheKey(playlist, file, title, artist);
  if (lyricsMemCache.has(key)) return lyricsMemCache.get(key);
  const promise = (async () => {
    const params = new URLSearchParams({
      playlist: playlist || "",
      file: file || "",
      title: title || "",
      artist: artist || "",
    });
    if (duration && isFinite(duration) && duration > 0) params.set("duration", Math.round(duration));
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
  if (liveQueue.length || !currentPlaylist || !currentPlaylist.tracks.length) return null;
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
let lyricsSyncLines = null; // [{t, el}] sorted by t, or null when unsynced
let lyricsActiveIdx = -1;
let lyricsRequestToken = 0; // drops stale responses after a quick track change

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

function renderSyncedLyrics(lines) {
  lyricsBody.textContent = "";
  lyricsBody.classList.remove("static");
  lyricsSyncLines = [];
  lyricsActiveIdx = -1;
  lines.forEach(({ t, text }) => {
    const div = document.createElement("div");
    div.className = "lyrics-line";
    // Two stacked copies of the same text (both via textContent - never
    // innerHTML, lyrics come from an external API): .lyrics-line-base is
    // the plain dim layer that always shows, .lyrics-line-fill is an
    // absolutely-positioned bright+glow duplicate that CSS clips down to
    // just the sung portion via --wipe. See player.css for why a single
    // text-shadow can't do this alone.
    const base = document.createElement("span");
    base.className = "lyrics-line-base";
    base.textContent = text || "♪";
    const fill = document.createElement("span");
    fill.className = "lyrics-line-fill";
    fill.textContent = text || "♪";
    div.append(base, fill);
    lyricsBody.appendChild(div);
    lyricsSyncLines.push({ t, el: div });
  });
  updateLyricsHighlight();
}

function renderStaticLyrics(text) {
  lyricsSyncLines = null;
  lyricsActiveIdx = -1;
  lyricsBody.classList.add("static");
  lyricsBody.textContent = text;
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
  const t = audioEl.currentTime;
  let idx = -1;
  for (let i = 0; i < lyricsSyncLines.length; i++) {
    if (lyricsSyncLines[i].t <= t) idx = i;
    else break;
  }

  if (idx !== lyricsActiveIdx) {
    lyricsSyncLines.forEach(({ el }, i) => {
      el.classList.toggle("active", i === idx);
      el.classList.toggle("sung", i < idx); // seek-safe: recomputed every change
      if (i !== idx) el.style.removeProperty("--wipe");
    });
    lyricsActiveIdx = idx;
    if (idx >= 0) {
      lyricsSyncLines[idx].el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  if (idx >= 0) {
    const start = lyricsSyncLines[idx].t;
    const end = idx + 1 < lyricsSyncLines.length ? lyricsSyncLines[idx + 1].t : start + 6;
    const pct = Math.min(Math.max((t - start) / Math.max(end - start, 0.3), 0), 1) * 100;
    lyricsSyncLines[idx].el.style.setProperty("--wipe", `${pct.toFixed(1)}%`);
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

async function openLyrics() {
  if (!nowPlayingMeta) {
    showToast("Gerade wird kein Titel abgespielt.");
    return;
  }
  const meta = nowPlayingMeta;
  const token = ++lyricsRequestToken;
  lyricsOverlay.classList.remove("hidden");
  startLyricsLoop();
  lyricsTitle.textContent = meta.title;
  lyricsArtist.textContent = meta.artist || "Unbekannter Interpret";
  renderStaticLyrics("Lade Songtext …");
  try {
    const data = await fetchLyricsData(meta.playlist, meta.file, meta.title, meta.artist, audioEl.duration);
    if (token !== lyricsRequestToken) return; // a newer track's request superseded this one
    if (data.synced) {
      const lines = parseLrc(data.synced);
      if (lines.length) {
        renderSyncedLyrics(lines);
        return;
      }
    }
    renderStaticLyrics(data.lyrics || `${meta.title}\n\nKeine Lyrics gefunden.`);
  } catch (err) {
    if (token === lyricsRequestToken) renderStaticLyrics("Songtext konnte nicht geladen werden.");
  }
}

function closeLyrics() {
  lyricsOverlay.classList.add("hidden");
  stopLyricsLoop();
  lyricsSyncLines = null;
  lyricsActiveIdx = -1;
}

// Track changed while the overlay is open (autoplay, next/prev, queue) -
// reload lyrics for the new song instead of highlighting stale lines.
// loadedmetadata fires exactly once per new src, not on seeks.
audioEl.addEventListener("loadedmetadata", () => {
  if (!lyricsOverlay.classList.contains("hidden") && nowPlayingMeta &&
      lyricsTitle.textContent !== nowPlayingMeta.title) {
    openLyrics();
  }
});

pbLyrics.addEventListener("click", openLyrics);
lyricsCloseBtn.addEventListener("click", closeLyrics);
lyricsOverlay.addEventListener("click", (e) => {
  if (e.target === lyricsOverlay) closeLyrics();
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
let partyModeActive = false;
let partyHeartbeatTimer = null;

function sendPartyHeartbeat() {
  if (!partyModeActive) return;
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

  clearInterval(partyHeartbeatTimer);
  if (active) {
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
    } catch (_) {
      // keep whatever we had
    }
  });
  hostEvents.addEventListener("remote_command", (e) => {
    try {
      handleRemoteCommand(JSON.parse(e.data).action);
    } catch (_) {
      // ignore malformed event
    }
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
