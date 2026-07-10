import { invoke } from "@tauri-apps/api/core";

/* ===== DOM ===== */
const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");
const playlistList = document.getElementById("playlistList");
const playlistTitle = document.getElementById("playlistTitle");
const playlistCover = document.getElementById("playlistCover");
const trackList = document.getElementById("trackList");
const settingsToggleBtn = document.getElementById("settingsToggleBtn");
const settingsModal = document.getElementById("settingsModal");
const settingsModalClose = document.getElementById("settingsModalClose");
const glowToggleSwitch = document.getElementById("glowToggleSwitch");
const hotkeyList = document.getElementById("hotkeyList");
const ambientGlowEl = document.getElementById("ambientGlow");
const addMenuEl = document.getElementById("addToPlaylistMenu");
const toastEl = document.getElementById("toast");
const audioEl = document.getElementById("audioEl");
const pbCover = document.getElementById("pbCover");
const pbTitle = document.getElementById("pbTitle");
const pbArtist = document.getElementById("pbArtist");
const pbPlay = document.getElementById("pbPlay");
const pbPrev = document.getElementById("pbPrev");
const pbNext = document.getElementById("pbNext");
const pbShuffle = document.getElementById("pbShuffle");
const pbProgressBar = document.getElementById("pbProgressBar");
const pbProgressWrap = document.getElementById("pbProgressWrap");

/* ===== State ===== */
let library = []; // [{name, tracks:[{file,title,artist,cover}]}]
let currentPlaylist = null;
let currentTrackIndex = -1;
let isShuffle = false;
let shuffleOrder = [];

/* ===== Toast ===== */
let toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg; // never innerHTML - XSS rule
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

/* ===== Menu / sidebar (mobile) ===== */
menuBtn.addEventListener("click", () => sidebar.classList.toggle("open"));
document.querySelectorAll(".nav-item[data-view]").forEach((el) => {
  el.addEventListener("click", () => sidebar.classList.remove("open"));
});

/* ===== Library / Playlists ===== */
async function loadLibrary() {
  try {
    library = await invoke("list_playlists");
  } catch (e) {
    library = [];
    showToast(String(e));
  }
  renderSidebar();
  if (library.length && !currentPlaylist) selectPlaylist(0);
}

function renderSidebar() {
  playlistList.innerHTML = "";
  library.forEach((pl, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "playlist-item";
    btn.textContent = `${pl.name} (${pl.tracks.length})`; // textContent only
    btn.addEventListener("click", () => selectPlaylist(idx));
    playlistList.appendChild(btn);
  });
}

function selectPlaylist(idx) {
  currentPlaylist = library[idx];
  if (!currentPlaylist) return;
  if (isShuffle) buildShuffleOrder();
  playlistTitle.textContent = currentPlaylist.name;
  playlistCover.src = currentPlaylist.tracks[0]?.cover || "";
  renderTrackList();
  sidebar.classList.remove("open");
}

function trackStreamUrl(track) {
  // Custom protocol registered in main.rs; path is <playlist>/<file>, safe_join()
  // on the Rust side rejects anything that resolves outside music_root.
  return `stream://localhost/${encodeURIComponent(currentPlaylist.name)}/${encodeURIComponent(track.file)}`;
}

function renderTrackList() {
  trackList.innerHTML = "";
  currentPlaylist.tracks.forEach((t, i) => {
    const row = document.createElement("div");
    row.className = "track-row";
    row.dataset.index = i;

    const info = document.createElement("div");
    const title = document.createElement("div");
    title.className = "track-title";
    title.textContent = t.title || t.file;
    const artist = document.createElement("div");
    artist.className = "track-artist";
    artist.textContent = t.artist || "Unbekannter Interpret";
    info.append(title, artist);

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "track-add-btn";
    addBtn.textContent = "➕";
    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openAddMenu(addBtn, t);
    });

    row.append(info, addBtn);
    row.addEventListener("click", () => playTrack(i));
    trackList.appendChild(row);
  });
  highlightPlayingRow();
}

function highlightPlayingRow() {
  trackList.querySelectorAll(".track-row").forEach((row) => {
    row.classList.toggle("playing", Number(row.dataset.index) === currentTrackIndex);
  });
}

/* ===== Add to Playlist ===== */
function closeAddMenu() {
  addMenuEl.classList.add("hidden");
  addMenuEl.innerHTML = "";
}
document.addEventListener("click", closeAddMenu);

function openAddMenu(anchorBtn, track) {
  closeAddMenu();
  library.forEach((pl) => {
    const item = document.createElement("button");
    item.type = "button";
    item.textContent = pl.name;
    item.addEventListener("click", async (e) => {
      e.stopPropagation();
      closeAddMenu();
      try {
        await invoke("add_track_to_playlist", { playlistName: pl.name, filename: track.file });
        showToast(`➕ Zu „${pl.name}" hinzugefügt`);
        await loadLibrary();
      } catch (err) {
        showToast(String(err));
      }
    });
    addMenuEl.appendChild(item);
  });
  const rect = anchorBtn.getBoundingClientRect();
  addMenuEl.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - 200)}px`;
  addMenuEl.style.left = `${Math.min(rect.left, window.innerWidth - 232)}px`;
  addMenuEl.classList.remove("hidden");
}

/* ===== Playback ===== */
function buildShuffleOrder() {
  const order = currentPlaylist.tracks.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  shuffleOrder = order;
}

function playTrack(index) {
  if (!currentPlaylist || !currentPlaylist.tracks[index]) return;
  currentTrackIndex = index;
  const track = currentPlaylist.tracks[index];
  audioEl.src = trackStreamUrl(track);
  audioEl.play().catch(() => {});
  pbCover.src = track.cover || "";
  pbTitle.textContent = track.title || track.file;
  pbArtist.textContent = track.artist || "Unbekannter Interpret";
  updateAmbientGlow(track.cover);
  highlightPlayingRow();
  updatePlayButton(true);
}

function updatePlayButton(playing) {
  pbPlay.textContent = playing ? "⏸" : "▶";
}
function togglePlayPause() {
  if (currentTrackIndex === -1) {
    if (currentPlaylist?.tracks.length) playTrack(0);
    return;
  }
  if (audioEl.paused) audioEl.play().catch(() => {});
  else audioEl.pause();
}

function nextTrack() {
  if (!currentPlaylist?.tracks.length) return;
  if (isShuffle) {
    const pos = shuffleOrder.indexOf(currentTrackIndex);
    playTrack(shuffleOrder[(pos + 1) % shuffleOrder.length]);
    return;
  }
  playTrack((currentTrackIndex + 1) % currentPlaylist.tracks.length);
}
function prevTrack() {
  if (!currentPlaylist?.tracks.length) return;
  if (audioEl.currentTime > 3) { audioEl.currentTime = 0; return; }
  if (isShuffle) {
    const pos = shuffleOrder.indexOf(currentTrackIndex);
    playTrack(shuffleOrder[(pos - 1 + shuffleOrder.length) % shuffleOrder.length]);
    return;
  }
  playTrack((currentTrackIndex - 1 + currentPlaylist.tracks.length) % currentPlaylist.tracks.length);
}

pbPlay.addEventListener("click", togglePlayPause);
pbNext.addEventListener("click", nextTrack);
pbPrev.addEventListener("click", prevTrack);
pbShuffle.addEventListener("click", () => {
  isShuffle = !isShuffle;
  pbShuffle.classList.toggle("active", isShuffle);
  if (isShuffle && currentPlaylist) buildShuffleOrder();
});

audioEl.addEventListener("play", () => updatePlayButton(true));
audioEl.addEventListener("pause", () => updatePlayButton(false));
audioEl.addEventListener("timeupdate", () => {
  if (!audioEl.duration) return;
  pbProgressBar.style.width = `${(audioEl.currentTime / audioEl.duration) * 100}%`;
});
audioEl.addEventListener("ended", nextTrack);
pbProgressWrap.addEventListener("click", (e) => {
  const rect = pbProgressWrap.querySelector(".pb-progress-track").getBoundingClientRect();
  const pct = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
  if (audioEl.duration) audioEl.currentTime = pct * audioEl.duration;
});

/* Stream drop mid-playback (native side hiccup, flaky storage, etc.) - same
   contract as the old Flask player: toast, wait 3s, auto-advance, with a
   consecutive-failure cap so a fully broken library can't loop forever. */
let consecutiveAudioErrors = 0;
const MAX_CONSECUTIVE_AUDIO_ERRORS = 5;
let audioErrorTimer = null;
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
  clearTimeout(audioErrorTimer);
  audioErrorTimer = setTimeout(nextTrack, 3000);
});

/* ===== Swipe gestures (mobile) =====
   Horizontal swipe on the player bar -> prev/next, matching the
   touch-first requirement. Vertical scroll is left alone (only acts once
   the horizontal delta clearly dominates, so normal list scrolling never
   misfires as a swipe). */
(function setupSwipe() {
  const bar = document.querySelector(".player-bar");
  let startX = 0, startY = 0, tracking = false;
  bar.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });
  bar.addEventListener("touchend", (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2) {
      if (dx < 0) nextTrack(); else prevTrack();
    }
  }, { passive: true });
})();

/* ===== Dynamic Glow ===== */
const GLOW_ENABLED_KEY = "glowEnabled";
let glowEnabled = localStorage.getItem(GLOW_ENABLED_KEY) !== "0";
let lastCoverSrc = null;

function updateAmbientGlow(coverSrc) {
  if (coverSrc) lastCoverSrc = coverSrc;
  if (!glowEnabled || !coverSrc) return;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 24;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, 24, 24);
      const { data } = ctx.getImageData(0, 0, 24, 24);
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
      ambientGlowEl.style.backgroundColor = `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
    } catch (_) { /* decode/CORS failure - keep previous glow */ }
  };
  img.src = coverSrc;
}
function setGlowEnabled(enabled) {
  glowEnabled = enabled;
  localStorage.setItem(GLOW_ENABLED_KEY, enabled ? "1" : "0");
  glowToggleSwitch.classList.toggle("active", enabled);
  if (enabled) { ambientGlowEl.classList.remove("glow-off"); updateAmbientGlow(lastCoverSrc); }
  else ambientGlowEl.classList.add("glow-off");
}
function toggleGlow() { setGlowEnabled(!glowEnabled); }
glowToggleSwitch.addEventListener("click", () => setGlowEnabled(!glowEnabled));
glowToggleSwitch.classList.toggle("active", glowEnabled);
if (!glowEnabled) ambientGlowEl.classList.add("glow-off");

/* ===== Fully configurable hotkeys (desktop only - no physical keyboard on
   phones; Android background control comes from the notification's
   MediaSession buttons instead, see android-extra/PlaybackService.kt) ===== */
const HOTKEYS_KEY = "hotkeyBindings";
const HOTKEY_ACTIONS = [
  { id: "next", label: "Nächster Song", default: { ctrl: true, alt: true, shift: false, key: "arrowright" }, fn: nextTrack },
  { id: "prev", label: "Vorheriger Song", default: { ctrl: true, alt: true, shift: false, key: "arrowleft" }, fn: prevTrack },
  { id: "playpause", label: "Wiedergabe / Pause", default: { ctrl: true, alt: true, shift: false, key: " " }, fn: togglePlayPause },
  { id: "glow", label: "Dynamic Glow an/aus", default: { ctrl: true, alt: true, shift: false, key: "g" }, fn: toggleGlow },
];
let hotkeyBindings = {};
(function loadHotkeys() {
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(HOTKEYS_KEY) || "{}") || {}; } catch (_) { stored = {}; }
  HOTKEY_ACTIONS.forEach((a) => { hotkeyBindings[a.id] = stored[a.id]?.key ? stored[a.id] : { ...a.default }; });
})();
function saveHotkeys() { localStorage.setItem(HOTKEYS_KEY, JSON.stringify(hotkeyBindings)); }
function formatHotkey(c) {
  const parts = [];
  if (c.ctrl) parts.push("Strg");
  if (c.alt) parts.push("Alt");
  if (c.shift) parts.push("Umschalt");
  parts.push(c.key === " " ? "Leertaste" : c.key === "arrowright" ? "→" : c.key === "arrowleft" ? "←" : c.key.toUpperCase());
  return parts.join(" + ");
}
function matchesHotkey(e, c) {
  const key = e.key === " " ? " " : e.key.toLowerCase();
  return e.ctrlKey === !!c.ctrl && e.altKey === !!c.alt && e.shiftKey === !!c.shift && key === c.key;
}
let recordingActionId = null;
function renderHotkeyList() {
  hotkeyList.innerHTML = "";
  HOTKEY_ACTIONS.forEach((action) => {
    const row = document.createElement("div");
    row.className = "hotkey-row";
    const label = document.createElement("span");
    label.textContent = action.label;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hotkey-combo";
    btn.textContent = recordingActionId === action.id ? "Taste drücken … (Esc)" : formatHotkey(hotkeyBindings[action.id]);
    btn.addEventListener("click", (e) => { e.stopPropagation(); recordingActionId = action.id; renderHotkeyList(); });
    row.append(label, btn);
    hotkeyList.appendChild(row);
  });
}
document.addEventListener("keydown", (e) => {
  if (!recordingActionId) return;
  e.preventDefault();
  if (e.key === "Escape") { recordingActionId = null; renderHotkeyList(); return; }
  if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
  const combo = { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, key: e.key === " " ? " " : e.key.toLowerCase() };
  const clash = HOTKEY_ACTIONS.find((a) => a.id !== recordingActionId &&
    hotkeyBindings[a.id].ctrl === combo.ctrl && hotkeyBindings[a.id].alt === combo.alt &&
    hotkeyBindings[a.id].shift === combo.shift && hotkeyBindings[a.id].key === combo.key);
  if (clash) { showToast(`⚠️ Kombination schon vergeben für „${clash.label}"`); recordingActionId = null; renderHotkeyList(); return; }
  hotkeyBindings[recordingActionId] = combo;
  saveHotkeys();
  recordingActionId = null;
  renderHotkeyList();
}, true);
document.addEventListener("keydown", (e) => {
  if (recordingActionId) return;
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea") return;
  const action = HOTKEY_ACTIONS.find((a) => matchesHotkey(e, hotkeyBindings[a.id]));
  if (!action) return;
  e.preventDefault();
  action.fn();
});

settingsToggleBtn.addEventListener("click", () => { recordingActionId = null; renderHotkeyList(); settingsModal.classList.remove("hidden"); });
settingsModalClose.addEventListener("click", () => { recordingActionId = null; settingsModal.classList.add("hidden"); });
settingsModal.addEventListener("click", (e) => { if (e.target === settingsModal) settingsModal.classList.add("hidden"); });

loadLibrary();
