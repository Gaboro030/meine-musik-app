/* Ported from the Flask app's static/app.js. DOM structure/rendering is
   kept as close to the original as possible; the two SSE-based download
   functions (downloadOneSSE, the ZIP handler) are replaced with Tauri
   invoke()+event equivalents since there's no server here to hold an SSE
   connection open - progress instead streams over Tauri's own event bus,
   emitted by the Rust download commands as they parse yt-dlp's own
   progress output. There's no physical .zip file anymore either: tracks
   land straight in the chosen library playlist, which is the natural
   behavior for a native library-first app instead of a browser download. */
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

/* ===== DOM Elements ===== */
const loadForm = document.getElementById("loadForm");
const urlInput = document.getElementById("urlInput");
const loadBtn = document.getElementById("loadBtn");
const statusEl = document.getElementById("status");
const results = document.getElementById("results");
const plTitle = document.getElementById("plTitle");
const plCount = document.getElementById("plCount");
const trackList = document.getElementById("trackList");
const selectAll = document.getElementById("selectAll");
const zipBtn = document.getElementById("zipBtn");
const zipReportBtn = document.getElementById("zipReportBtn");
const bitrateSel = document.getElementById("bitrate");
const videoQualitySel = document.getElementById("videoQuality");
const cleanAudioToggle = document.getElementById("cleanAudioToggle");
const cleanAudioLabel = document.getElementById("cleanAudioLabel");
const formatToggle = document.getElementById("formatToggle");
const toastContainer = document.getElementById("toastContainer");
const globalProgress = document.getElementById("globalProgress");
const gpBar = document.getElementById("gpBar");
const gpTitle = document.getElementById("gpTitle");
const gpPercent = document.getElementById("gpPercent");
const gpTrackName = document.getElementById("gpTrackName");
const gpTrackCount = document.getElementById("gpTrackCount");

let currentTitle = "playlist";
let currentFormat = "mp3";

/* ===== Helpers ===== */
function currentBitrate() { return bitrateSel ? bitrateSel.value : "192"; }
function currentVideoQuality() { return videoQualitySel ? videoQualitySel.value : "best"; }
function preferCleanAudio() { return currentFormat === "mp3" && (cleanAudioToggle ? cleanAudioToggle.checked : true); }

/* ===== Format Toggle (MP3/MP4) ===== */
if (formatToggle) {
  formatToggle.querySelectorAll(".format-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentFormat = btn.dataset.format;
      formatToggle.querySelectorAll(".format-btn").forEach((b) => b.classList.toggle("active", b === btn));
      const isMp4 = currentFormat === "mp4";
      if (bitrateSel) bitrateSel.classList.toggle("hidden", isMp4);
      if (videoQualitySel) videoQualitySel.classList.toggle("hidden", !isMp4);
      if (cleanAudioLabel) cleanAudioLabel.classList.toggle("hidden", isMp4);
      trackList.querySelectorAll(".fmt-btn").forEach((b) => {
        if (!b.disabled && !b.classList.contains("done") && !b.classList.contains("report-btn")) {
          b.textContent = currentFormat.toUpperCase();
        }
      });
    });
  });
}

function setStatus(msg, isError = false) {
  statusEl.textContent = msg || "";
  statusEl.classList.toggle("error", isError);
}
function fmtDuration(sec) {
  if (!sec && sec !== 0) return "";
  sec = Math.round(sec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ===== Toast System ===== */
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const iconSpan = document.createElement("span");
  iconSpan.textContent = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";
  const msgSpan = document.createElement("span");
  msgSpan.textContent = message;
  toast.append(iconSpan, msgSpan);
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

/* ===== Report Modal ===== */
const reportModal = document.getElementById("reportModal");
const reportModalBody = document.getElementById("reportModalBody");
const reportModalClose = document.getElementById("reportModalClose");
function showReportModal(items) {
  reportModalBody.innerHTML = "";
  for (const item of items) {
    const div = document.createElement("div");
    div.className = "report-item";
    const title = document.createElement("div");
    title.className = "r-title";
    title.textContent = item.title;
    const reason = document.createElement("div");
    reason.className = "r-reason";
    reason.textContent = item.reason;
    div.append(title, reason);
    reportModalBody.appendChild(div);
  }
  reportModal.classList.remove("hidden");
}
reportModalClose.addEventListener("click", () => reportModal.classList.add("hidden"));
reportModal.addEventListener("click", (e) => { if (e.target === reportModal) reportModal.classList.add("hidden"); });

/* ===== Playlist Loading (Spotify / YouTube / YouTube Music) ===== */
loadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = urlInput.value.trim();
  if (!url) return;

  loadBtn.disabled = true;
  loadBtn.textContent = "Laden …";
  setStatus("Lade Playlist …");
  results.classList.add("hidden");
  globalProgress.classList.add("hidden");
  trackList.innerHTML = "";

  try {
    const data = await invoke("resolve_playlist", { url });
    currentTitle = data.title || "playlist";
    plTitle.textContent = data.title;
    plCount.textContent = `${data.count} Titel`;
    if (data.unmatched) {
      showToast(`${data.unmatched} Spotify-Titel ohne YouTube-Treffer übersprungen.`, "info");
    }
    renderTracks(data.entries);
    results.classList.remove("hidden");
    setStatus("");
    showToast(`${data.count} Titel geladen`, "success");
  } catch (err) {
    const msg = String(err);
    setStatus(msg, true);
    showToast(msg, "error");
  } finally {
    loadBtn.disabled = false;
    loadBtn.textContent = "Laden";
  }
});

/* ===== Track Rendering ===== */
function renderTracks(entries) {
  trackList.innerHTML = "";
  for (const t of entries) {
    const li = document.createElement("li");
    li.className = "track";
    li.dataset.videoId = t.id;

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = true;
    cb.dataset.id = t.id;
    cb.dataset.title = t.title;
    cb.dataset.uploader = t.uploader || "";
    cb.dataset.duration = t.duration || "";
    cb.dataset.thumbnail = t.thumbnail || "";

    const img = document.createElement("img");
    img.className = "thumb";
    img.alt = "";
    img.loading = "lazy";
    img.src = t.thumbnail || `https://i.ytimg.com/vi/${t.id}/mqdefault.jpg`;

    const info = document.createElement("div");
    info.className = "info";
    const title = document.createElement("div");
    title.className = "t-title";
    title.textContent = t.title;
    const sub = document.createElement("div");
    sub.className = "t-sub";
    const parts = [];
    if (t.uploader) parts.push(t.uploader);
    const dur = fmtDuration(t.duration);
    if (dur) parts.push(dur);
    sub.textContent = parts.join(" · ");
    info.append(title, sub);

    const playBtn = document.createElement("button");
    playBtn.className = "dl-btn play-btn";
    playBtn.textContent = "▶";
    playBtn.title = "Auf YouTube ansehen";
    playBtn.addEventListener("click", () => window.open(t.url || `https://www.youtube.com/watch?v=${t.id}`, "_blank", "noopener"));

    const btn = document.createElement("button");
    btn.className = "dl-btn fmt-btn";
    btn.textContent = currentFormat.toUpperCase();
    btn.addEventListener("click", () => {
      if (btn.dataset.failReason) {
        showReportModal([{ title: t.title, reason: btn.dataset.failReason }]);
        delete btn.dataset.failReason;
        btn.classList.remove("report-btn");
        btn.textContent = currentFormat.toUpperCase();
        return;
      }
      downloadOne(t.id, btn, li);
    });

    li.append(cb, img, info, playBtn, btn);
    trackList.appendChild(li);
  }
}

/* ===== Single Track Download (Tauri event progress) ===== */
let taskCounter = 0;
async function downloadOne(id, btn, trackEl) {
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  let progressWrap = trackEl.querySelector(".track-progress");
  if (!progressWrap) {
    progressWrap = document.createElement("div");
    progressWrap.className = "track-progress";
    const bar = document.createElement("div");
    bar.className = "track-progress-bar";
    progressWrap.appendChild(bar);
    trackEl.appendChild(progressWrap);
  }
  const bar = progressWrap.querySelector(".track-progress-bar");
  bar.style.width = "0%";
  progressWrap.style.display = "";

  let progressInfo = trackEl.querySelector(".track-progress-info");
  if (!progressInfo) {
    progressInfo = document.createElement("div");
    progressInfo.className = "track-progress-info";
    progressInfo.innerHTML = '<span class="pct">0%</span><span class="eta-label"></span>';
    trackEl.appendChild(progressInfo);
  }
  progressInfo.style.display = "flex";
  const pctEl = progressInfo.querySelector(".pct");
  const etaEl = progressInfo.querySelector(".eta-label");

  const cb = trackEl.querySelector('input[type="checkbox"]');
  const taskId = `t${++taskCounter}`;

  const unlistenProgress = await listen(`dl-progress-${taskId}`, (e) => {
    const d = e.payload;
    const pct = d.percent || 0;
    bar.style.width = `${pct}%`;
    pctEl.textContent = `${Math.round(pct)}%`;
    etaEl.textContent = d.phase === "converting" ? "Konvertiere …" : "";
  });

  try {
    await invoke("download_track_progress", {
      taskId,
      videoId: id,
      title: cb ? cb.dataset.title || "" : "",
      uploader: cb ? cb.dataset.uploader || "" : "",
      duration: cb && cb.dataset.duration ? Number(cb.dataset.duration) : null,
      thumbnail: cb ? cb.dataset.thumbnail || null : null,
      bitrate: currentBitrate(),
      format: currentFormat,
      quality: currentVideoQuality(),
      preferAudio: preferCleanAudio(),
      playlistName: currentTitle,
    });
    bar.style.width = "100%";
    pctEl.textContent = "100%";
    etaEl.textContent = "";
    btn.textContent = `✓ ${currentFormat.toUpperCase()}`;
    btn.classList.add("done");
    btn.disabled = false;
    showToast(`„${cb ? cb.dataset.title : id}" in Bibliothek gespeichert`, "success");
    setTimeout(() => { progressWrap.style.display = "none"; progressInfo.style.display = "none"; bar.style.width = "0%"; }, 1500);
    setTimeout(() => { btn.textContent = currentFormat.toUpperCase(); btn.classList.remove("done"); }, 3000);
  } catch (err) {
    const msg = String(err) || "Download fehlgeschlagen.";
    setStatus(msg, true);
    showToast(msg, "error");
    btn.textContent = "Fehlerbericht";
    btn.classList.add("report-btn");
    btn.disabled = false;
    btn.dataset.failReason = msg;
    progressWrap.style.display = "none";
    progressInfo.style.display = "none";
  } finally {
    unlistenProgress();
  }
}

/* ===== Select All ===== */
selectAll.addEventListener("change", () => {
  trackList.querySelectorAll('input[type="checkbox"]').forEach((cb) => { cb.checked = selectAll.checked; });
});

/* ===== Batch download - all selected tracks straight into the library
   playlist named after the loaded playlist/album (no .zip file - this is
   a native library-first app, so "download" just means "add to library"). */
zipBtn.addEventListener("click", async () => {
  const checked = [...trackList.querySelectorAll('input[type="checkbox"]:checked')];
  if (!checked.length) {
    showToast("Bitte mindestens einen Titel auswählen.", "error");
    return;
  }

  zipBtn.disabled = true;
  const origText = zipBtn.textContent;
  zipBtn.textContent = "Wird geladen …";
  zipReportBtn.classList.add("hidden");
  const skippedList = [];

  globalProgress.classList.remove("hidden");
  gpBar.style.width = "0%";
  gpPercent.textContent = "0%";
  gpTrackName.textContent = "Vorbereitung …";
  gpTrackCount.textContent = `0 / ${checked.length}`;
  gpTitle.textContent = "Sammel-Download";

  for (let i = 0; i < checked.length; i++) {
    const cb = checked[i];
    const title = cb.dataset.title || cb.dataset.id;
    gpTrackName.textContent = `🎵 ${title}`;
    try {
      await invoke("download_track_progress", {
        taskId: `batch${i}`,
        videoId: cb.dataset.id,
        title,
        uploader: cb.dataset.uploader || "",
        duration: cb.dataset.duration ? Number(cb.dataset.duration) : null,
        thumbnail: cb.dataset.thumbnail || null,
        bitrate: currentBitrate(),
        format: currentFormat,
        quality: currentVideoQuality(),
        preferAudio: preferCleanAudio(),
        playlistName: currentTitle,
      });
    } catch (err) {
      skippedList.push({ title, reason: String(err) || "Unbekannter Fehler." });
      showToast(`Übersprungen: ${title}`, "error");
    }
    const pct = ((i + 1) / checked.length) * 100;
    gpBar.style.width = `${pct}%`;
    gpPercent.textContent = `${Math.round(pct)}%`;
    gpTrackCount.textContent = `${i + 1} / ${checked.length}`;
  }

  gpTrackName.textContent = "✅ Fertig!";
  const ok = checked.length - skippedList.length;
  if (skippedList.length) {
    showToast(`${ok} Titel geladen, ${skippedList.length} übersprungen.`, "info");
    zipReportBtn.classList.remove("hidden");
    zipReportBtn.textContent = `Fehlerbericht (${skippedList.length})`;
    zipReportBtn.onclick = () => showReportModal(skippedList);
  } else {
    showToast(`${ok} Titel in Bibliothek geladen!`, "success");
  }

  zipBtn.disabled = false;
  zipBtn.textContent = origText;
  setTimeout(() => globalProgress.classList.add("hidden"), 4000);
});
