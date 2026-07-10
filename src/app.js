import { invoke } from "@tauri-apps/api/core";

/* ===== DOM Elements ===== */
const playlistList = document.getElementById("playlistList");
const playlistListEmpty = document.getElementById("playlistListEmpty");
const emptyState = document.getElementById("emptyState");
const emptyStateLibraryBtn = document.getElementById("emptyStateLibraryBtn");
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

const renamePlaylistBtn = document.getElementById("renamePlaylistBtn");
const deletePlaylistBtn = document.getElementById("deletePlaylistBtn");
const playlistDropzone = document.getElementById("playlistDropzone");
const libraryDropzone = document.getElementById("libraryDropzone");
const libraryFileInput = document.getElementById("libraryFileInput");
const addYoutubeBtn = document.getElementById("addYoutubeBtn");

const searchInput = document.getElementById("searchInput");
const searchView = document.getElementById("searchView");
const searchSongsGrid = document.getElementById("searchSongsGrid");
const searchPlaylistsGrid = document.getElementById("searchPlaylistsGrid");
const searchSongsSection = document.getElementById("searchSongsSection");
const searchPlaylistsSection = document.getElementById("searchPlaylistsSection");
const searchNothingAtAll = document.getElementById("searchNothingAtAll");

const themeToggleBtn = document.getElementById("themeToggleBtn");
const themePopover = document.getElementById("themePopover");
const themeOptionBtns = document.querySelectorAll(".theme-option");

const settingsToggleBtn = document.getElementById("settingsToggleBtn");
const settingsModal = document.getElementById("settingsModal");
const settingsModalClose = document.getElementById("settingsModalClose");
const glowToggleSwitch = document.getElementById("glowToggleSwitch");
const hotkeyList = document.getElementById("hotkeyList");

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
let repeatMode = "off";
let shuffleOrder = [];
let isLiked = false;
let currentView = "home";
let previousView = "home";

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
function trackStreamUrl(playlistName, filename) {
  // Custom "stream://" protocol registered in main.rs; the Rust side
  // safe_join()s <playlist>/<file> against music_root and rejects
  // anything that resolves outside it.
  return `stream://localhost/${encodeURIComponent(playlistName)}/${encodeURIComponent(filename)}`;
}

/* ===== Load Library ===== */
async function refreshLibrary() {
  try {
    library = await invoke("list_playlists");
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
}

/* ===== View Switching ===== */
function showView(view) {
  if (!library.length) {
    emptyState.classList.remove("hidden");
    homeView.classList.add("hidden");
    libraryView.classList.add("hidden");
    playlistView.classList.add("hidden");
    searchView.classList.add("hidden");
    navBackBtn.disabled = true;
    return;
  }

  emptyState.classList.add("hidden");
  homeView.classList.toggle("hidden", view !== "home");
  libraryView.classList.toggle("hidden", view !== "library");
  playlistView.classList.toggle("hidden", view !== "playlist");
  searchView.classList.add("hidden");

  document.querySelectorAll(".nav-item[data-view]").forEach((el) => {
    el.classList.toggle("active", el.dataset.view === view);
  });

  if (view !== "playlist") {
    previousView = view;
    playlistList.querySelectorAll(".playlist-item").forEach((el) => el.classList.remove("active"));
  }
  navBackBtn.disabled = view !== "playlist";
  currentView = view;
}

navBackBtn.addEventListener("click", () => showView(previousView));
document.querySelectorAll(".nav-item[data-view]").forEach((el) => {
  el.addEventListener("click", () => showView(el.dataset.view));
});
emptyStateLibraryBtn.addEventListener("click", () => showView("library"));

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
    pl.tracks.forEach((t, trackIdx) => allTracks.push({ track: t, plIdx, trackIdx }));
  });
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
    attachAddButton(coverWrap, { sourcePlaylist: library[plIdx].name, filename: track.file });

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
}

/* ===== Library View ===== */
function renderLibraryGrid() {
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

function playTrackIn(plIdx, trackIdx) {
  currentPlaylist = library[plIdx];
  playlistList.querySelectorAll(".playlist-item").forEach((el, i) => {
    el.classList.toggle("active", i === plIdx);
  });
  playTrack(trackIdx);
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
  if (isShuffle) buildShuffleOrder();
  renderTrackTable();
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
confirmModal.addEventListener("click", (e) => { if (e.target === confirmModal) hideConfirmModal(); });

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
renameModal.addEventListener("click", (e) => { if (e.target === renameModal) hideRenameModal(); });

/* ===== Playlist Delete / Rename ===== */
deletePlaylistBtn.addEventListener("click", () => {
  if (!currentPlaylist) return;
  showConfirmModal(
    "Playlist löschen?",
    `„${currentPlaylist.name}" mit ${currentPlaylist.tracks.length} Titeln wird unwiderruflich gelöscht.`,
    async () => {
      try {
        await invoke("delete_playlist", { name: currentPlaylist.name });
        showToast("🗑 Playlist gelöscht");
        await refreshLibrary();
        showView("library");
      } catch (err) {
        showToast(String(err) || "Löschen fehlgeschlagen.");
      }
    }
  );
});

renamePlaylistBtn.addEventListener("click", () => {
  if (!currentPlaylist) return;
  showRenameModal(currentPlaylist.name, async (newName) => {
    const oldName = currentPlaylist.name;
    try {
      await invoke("rename_playlist", { oldName, newName });
      showToast("✏️ Playlist umbenannt");
      await refreshLibrary();
      const idx = library.findIndex((p) => p.name === newName || p.name.startsWith(newName));
      if (idx !== -1) selectPlaylist(idx);
    } catch (err) {
      showToast(String(err) || "Umbenennen fehlgeschlagen.");
    }
  });
});

/* ===== Track Removal ===== */
async function deleteTrack(index) {
  if (!currentPlaylist || !currentPlaylist.tracks[index]) return;
  const track = currentPlaylist.tracks[index];
  const playlistName = currentPlaylist.name;
  try {
    await invoke("remove_track_from_playlist", { playlistName, filename: track.file });
    showToast(`🗑 „${track.title}" entfernt`);
    if (index === currentTrackIndex) {
      audioEl.pause();
      audioEl.removeAttribute("src");
      currentTrackIndex = -1;
      updatePlayButton(false);
      pbTitle.textContent = "Kein Titel ausgewählt";
      pbArtist.textContent = "—";
    } else if (index < currentTrackIndex) {
      currentTrackIndex -= 1;
    }
    await refreshLibrary();
    const idx = library.findIndex((p) => p.name === playlistName);
    if (idx !== -1) selectPlaylist(idx);
    else showView("library");
  } catch (err) {
    showToast(String(err) || "Löschen fehlgeschlagen.");
  }
}

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
      openAddMenu(addBtn, { sourcePlaylist: currentPlaylist.name, filename: t.file });
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
    tr.addEventListener("click", () => playTrack(i));
    trackTableBody.appendChild(tr);
  });
  highlightPlayingRow();
}
function highlightPlayingRow() {
  trackTableBody.querySelectorAll(".track-row").forEach((row) => {
    row.classList.toggle("playing", Number(row.dataset.index) === currentTrackIndex);
  });
}

/* ===== Add to Playlist =====
   Every track here is already local (no online search/recommendations
   backend in this rewrite yet - see README) - so this only ever copies an
   existing file into another playlist folder via add_track_to_playlist. */
let addMenuEl = null;
function closeAddMenu() {
  if (addMenuEl) { addMenuEl.remove(); addMenuEl = null; }
}
document.addEventListener("click", closeAddMenu);

async function addTrackToPlaylist(targetPlaylist, trackData) {
  try {
    await invoke("add_track_to_playlist", {
      sourcePlaylist: trackData.sourcePlaylist,
      filename: trackData.filename,
      targetPlaylist,
    });
    showToast(`➕ Zu „${targetPlaylist}" hinzugefügt`);
    await refreshLibrary();
  } catch (err) {
    showToast(String(err) || "Hinzufügen fehlgeschlagen.");
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
  newInput.addEventListener("keydown", (e) => { if (e.key === "Enter") newBtn.click(); });
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

function attachAddButton(coverWrap, trackData) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "card-add-btn";
  btn.textContent = "➕";
  btn.title = "Zu Playlist hinzufügen";
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    openAddMenu(btn, trackData);
  });
  coverWrap.appendChild(btn);
  return btn;
}

/* ===== Playback ===== */
function buildShuffleOrder(keepCurrentFirst = true) {
  const order = currentPlaylist.tracks.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
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

  audioEl.src = trackStreamUrl(currentPlaylist.name, track.file);
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
}

function updatePlayButton(playing) {
  pbPlay.textContent = playing ? "⏸" : "▶";
  pbPlay.title = playing ? "Pause" : "Abspielen";
}
function togglePlayPause() {
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
  if (!currentPlaylist || !currentPlaylist.tracks.length) return;
  if (isShuffle) {
    const pos = shuffleOrder.indexOf(currentTrackIndex);
    const nextPos = (pos + 1) % shuffleOrder.length;
    if (nextPos === 0 && repeatMode !== "all") { updatePlayButton(false); return; }
    playTrack(shuffleOrder[nextPos]);
    return;
  }
  let next = currentTrackIndex + 1;
  if (next >= currentPlaylist.tracks.length) {
    if (repeatMode !== "all") { updatePlayButton(false); return; }
    next = 0;
  }
  playTrack(next);
}
function prevTrack() {
  if (!currentPlaylist || !currentPlaylist.tracks.length) return;
  if (audioEl.currentTime > 3) { audioEl.currentTime = 0; return; }
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

playAllBtn.addEventListener("click", () => {
  if (currentPlaylist && currentPlaylist.tracks.length) playTrack(0);
});
shuffleAllBtn.addEventListener("click", () => {
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
  isShuffle = !isShuffle;
  pbShuffle.classList.toggle("active", isShuffle);
  shuffleAllBtn.classList.toggle("active", isShuffle);
  if (isShuffle && currentPlaylist) buildShuffleOrder();
}
pbShuffle.addEventListener("click", toggleShuffle);

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
    void btn.offsetWidth;
    btn.classList.add("shuffle-pulse");
  }
}
[pbShuffle, shuffleAllBtn].forEach((btn) => {
  btn.addEventListener("contextmenu", (e) => { e.preventDefault(); reshuffleNow(btn); });
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

/* Stream drop mid-playback must not freeze the player: toast, wait 3s,
   auto-advance, capped so a fully broken library can't loop forever. */
let audioErrorRetryTimer = null;
let consecutiveAudioErrors = 0;
const MAX_CONSECUTIVE_AUDIO_ERRORS = 5;
audioEl.addEventListener("playing", () => { consecutiveAudioErrors = 0; });
audioEl.addEventListener("error", () => {
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
  if (audioEl.duration) audioEl.currentTime = pct * audioEl.duration;
}
let scrubbing = false;
pbProgressWrap.addEventListener("mousedown", (e) => { scrubbing = true; seekFromEvent(e); });
window.addEventListener("mousemove", (e) => { if (scrubbing) seekFromEvent(e); });
window.addEventListener("mouseup", () => { scrubbing = false; });

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
pbVolumeWrap.addEventListener("mousedown", (e) => { scrubbingVolume = true; setVolumeFromEvent(e); });
window.addEventListener("mousemove", (e) => { if (scrubbingVolume) setVolumeFromEvent(e); });
window.addEventListener("mouseup", () => { scrubbingVolume = false; });

/* ===== Add local MP3s (drag & drop / file picker) =====
   Reads each dropped file client-side and sends its raw bytes to the Rust
   upload_track command, which writes them into music_root/<playlist>/ -
   there's no separate Downloader page in this rewrite, so this plus the
   YouTube-loader button are the two ways to get music in. */
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
  let saved = 0;
  let skipped = 0;
  for (const f of files) {
    try {
      const buf = await f.arrayBuffer();
      await invoke("upload_track", {
        playlistName,
        filename: f.name,
        data: Array.from(new Uint8Array(buf)),
      });
      saved++;
    } catch (_) {
      skipped++;
    }
  }
  const skippedNote = skipped ? `, ${skipped} übersprungen` : "";
  showUploadToast(`✅ ${saved} Titel zu „${playlistName}" hinzugefügt${skippedNote}`);
  await refreshLibrary();
  if (onDone) onDone(playlistName);
  setTimeout(() => uploadToast.classList.add("hidden"), 3000);
}

function jumpToPlaylistByName(name) {
  const idx = library.findIndex((p) => p.name === name || p.name.startsWith(name));
  if (idx !== -1) selectPlaylist(idx);
}

function readAllDirectoryEntries(reader) {
  return new Promise((resolve) => {
    let all = [];
    function readBatch() {
      reader.readEntries((entries) => {
        if (!entries.length) { resolve(all); return; }
        all = all.concat(entries);
        readBatch();
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

["dragenter", "dragover"].forEach((evt) =>
  libraryDropzone.addEventListener(evt, (e) => { e.preventDefault(); libraryDropzone.classList.add("drag-over"); })
);
["dragleave", "drop"].forEach((evt) =>
  libraryDropzone.addEventListener(evt, (e) => { e.preventDefault(); libraryDropzone.classList.remove("drag-over"); })
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

["dragenter", "dragover"].forEach((evt) =>
  playlistDropzone.addEventListener(evt, (e) => { e.preventDefault(); playlistDropzone.classList.add("drag-over"); })
);
["dragleave", "drop"].forEach((evt) =>
  playlistDropzone.addEventListener(evt, (e) => { e.preventDefault(); playlistDropzone.classList.remove("drag-over"); })
);
playlistDropzone.addEventListener("drop", async (e) => {
  if (!currentPlaylist) return;
  const playlistName = currentPlaylist.name;
  const files = await collectFilesFromDataTransfer(e.dataTransfer);
  await uploadFiles(playlistName, files, jumpToPlaylistByName);
});
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());

/* ===== YouTube loader (desktop only, see README) =====
   Minimal prompt-based UI - paste a video ID/URL, pick target playlist by
   name. download_track() shells out to the bundled yt-dlp sidecar. */
addYoutubeBtn.addEventListener("click", async () => {
  const raw = window.prompt("YouTube-Video-ID oder -Link:");
  if (!raw) return;
  const idMatch = raw.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{6,20})/) || raw.match(/^([\w-]{6,20})$/);
  const videoId = idMatch ? idMatch[1] : null;
  if (!videoId) { showToast("Konnte keine Video-ID erkennen."); return; }
  const title = window.prompt("Titel für die Datei:", "Song") || "Song";
  const playlistName = window.prompt("In welche Playlist? (neue oder bestehende)", "Meins") || "Meins";
  showToast("⏳ Lade von YouTube …");
  try {
    await invoke("download_track", { videoId, playlistName, title });
    showToast(`⬇ „${title}" zu „${playlistName}" hinzugefügt`);
    await refreshLibrary();
    jumpToPlaylistByName(playlistName);
  } catch (err) {
    showToast(String(err) || "Download fehlgeschlagen.");
  }
});

/* ===== Web Audio graph: Equalizer + soft fade in/out ===== */
let audioCtx = null;
let eqBass, eqMid, eqTreble, masterGain, normalizerCompressor;
let audioGraphReady = false;
const eqSettings = { bass: 0, mid: 0, treble: 0 };

function initAudioGraph() {
  if (audioGraphReady) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audioCtx = new Ctx();
  const source = audioCtx.createMediaElementSource(audioEl);

  eqBass = audioCtx.createBiquadFilter();
  eqBass.type = "lowshelf"; eqBass.frequency.value = 200; eqBass.gain.value = eqSettings.bass;
  eqMid = audioCtx.createBiquadFilter();
  eqMid.type = "peaking"; eqMid.frequency.value = 1000; eqMid.Q.value = 0.9; eqMid.gain.value = eqSettings.mid;
  eqTreble = audioCtx.createBiquadFilter();
  eqTreble.type = "highshelf"; eqTreble.frequency.value = 3000; eqTreble.gain.value = eqSettings.treble;

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

/* ===== Media Session API ===== */
function updateMediaSessionMetadata(track) {
  if (!("mediaSession" in navigator)) return;
  const artwork = track.cover ? [{ src: track.cover, sizes: "512x512", type: "image/png" }] : [];
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
      if (details.seekTime != null && audioEl.duration) audioEl.currentTime = details.seekTime;
    });
  } catch (_) { /* not every webview supports seekto */ }
}

/* ===== Dynamic Glow ===== */
const ambientGlowEl = document.getElementById("ambientGlow");
let lastCoverSrc = null;
function updateAmbientGlow(coverSrc) {
  if (coverSrc) lastCoverSrc = coverSrc;
  if (!glowEnabled || !coverSrc) return;
  const img = new Image();
  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      const size = 24;
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; count++; }
      r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
      ambientGlowEl.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    } catch (_) { /* decode failure - keep previous glow */ }
  };
  img.src = coverSrc;
}

const GLOW_ENABLED_KEY = "glowEnabled";
let glowEnabled = localStorage.getItem(GLOW_ENABLED_KEY) !== "0";
function setGlowEnabled(enabled) {
  glowEnabled = enabled;
  localStorage.setItem(GLOW_ENABLED_KEY, enabled ? "1" : "0");
  glowToggleSwitch.classList.toggle("active", enabled);
  glowToggleSwitch.setAttribute("aria-checked", String(enabled));
  if (enabled) { ambientGlowEl.classList.remove("glow-off"); updateAmbientGlow(lastCoverSrc); }
  else ambientGlowEl.classList.add("glow-off");
}
function toggleGlow() { setGlowEnabled(!glowEnabled); }
glowToggleSwitch.addEventListener("click", () => setGlowEnabled(!glowEnabled));
glowToggleSwitch.classList.toggle("active", glowEnabled);
glowToggleSwitch.setAttribute("aria-checked", String(glowEnabled));
if (!glowEnabled) ambientGlowEl.classList.add("glow-off");

/* ===== Fully configurable hotkeys ===== */
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
  try { stored = JSON.parse(localStorage.getItem(HOTKEYS_STORAGE_KEY) || "{}") || {}; } catch (_) { stored = {}; }
  hotkeyBindings = {};
  HOTKEY_ACTIONS.forEach((action) => {
    const combo = stored[action.id];
    hotkeyBindings[action.id] = combo && combo.key ? combo : { ...action.default };
  });
}
loadHotkeyBindings();
function saveHotkeyBindings() { localStorage.setItem(HOTKEYS_STORAGE_KEY, JSON.stringify(hotkeyBindings)); }

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
  return e.ctrlKey === !!combo.ctrl && e.altKey === !!combo.alt && e.shiftKey === !!combo.shift && key === combo.key;
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
    btn.addEventListener("click", (e) => { e.stopPropagation(); recordingActionId = action.id; renderHotkeyList(); });
    row.append(label, btn);
    hotkeyList.appendChild(row);
  });
}

document.addEventListener("keydown", (e) => {
  if (!recordingActionId) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.key === "Escape") { recordingActionId = null; renderHotkeyList(); return; }
  if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
  const combo = { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, key: e.key === " " ? " " : e.key.toLowerCase() };
  const clash = HOTKEY_ACTIONS.find((a) => a.id !== recordingActionId && hotkeysEqual(hotkeyBindings[a.id], combo));
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
settingsModal.addEventListener("click", (e) => { if (e.target === settingsModal) closeSettingsModal(); });

document.addEventListener("keydown", (e) => {
  if (recordingActionId) return;
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea") return;
  const action = HOTKEY_ACTIONS.find((a) => matchesHotkey(e, hotkeyBindings[a.id]));
  if (!action) return;
  e.preventDefault();
  action.fn();
});

/* ===== Sidebar popover (Design) ===== */
themeToggleBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  themePopover.classList.toggle("hidden");
  themeToggleBtn.classList.toggle("active", !themePopover.classList.contains("hidden"));
});
document.addEventListener("click", (e) => {
  if (!themePopover.classList.contains("hidden") && !themePopover.contains(e.target) && e.target !== themeToggleBtn) {
    themePopover.classList.add("hidden");
    themeToggleBtn.classList.remove("active");
  }
});

/* ===== Themes ===== */
const THEME_STORAGE_KEY = "meineMusikTheme";
function applyTheme(theme) {
  if (theme && theme !== "spotify-green") document.documentElement.setAttribute("data-theme", theme);
  else document.documentElement.removeAttribute("data-theme");
  themeOptionBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.theme === (theme || "spotify-green")));
  localStorage.setItem(THEME_STORAGE_KEY, theme || "spotify-green");
}
themeOptionBtns.forEach((btn) => btn.addEventListener("click", () => applyTheme(btn.dataset.theme)));
applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || "spotify-green");

/* ===== Search (local library only) ===== */
function setSearchActive(active) {
  [emptyState, homeView, libraryView, playlistView].forEach((el) => { if (active) el.classList.add("hidden"); });
  searchView.classList.toggle("hidden", !active);
  if (!active) showView(currentView);
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
    playBtn.addEventListener("click", (e) => { e.stopPropagation(); exitSearchAndPlay(plIdx, trackIdx); });
    coverWrap.append(img, playBtn);
    attachAddButton(coverWrap, { sourcePlaylist: library[plIdx].name, filename: track.file });

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
function performSearch() {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) { setSearchActive(false); return; }
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
  searchNothingAtAll.classList.toggle("hidden", matchedTracks.length > 0 || matchedPlaylists.length > 0);
}
searchInput.addEventListener("input", performSearch);

loadLibrary();
