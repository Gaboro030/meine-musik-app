/* ===== Downloader =====
   Oberflaeche im Reson-Design, Ablauf nach Ytms-to-mp3: Link einfuegen,
   Playlist erscheint mit Cover, Titel an-/abwaehlen, alles landet als
   MP3 (Android: M4A) mit Titel, Interpret und quadratischem Cover in der
   Bibliothek - fehlgeschlagene Titel werden uebersprungen und erklaert.

   Das Herunterladen selbst macht das Rust-Backend (download_track_progress,
   commands.rs/innertube.rs) und meldet den Fortschritt als Tauri-Ereignis
   "dl-progress-<taskId>". Laeuft diese Seite als Ebene im Player, reicht
   frame-bridge.js invoke/listen durch. */
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

const $ = (id) => document.getElementById(id);
const isAndroid = /android/i.test(navigator.userAgent);
const inFrame = window.self !== window.top;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
if (inFrame) document.body.classList.add("in-frame");

/* ===== Theme vom Player uebernehmen =====
   Im Rahmen gelten die CSS-Variablen der Elternseite nicht. Die Seite ist
   gleicher Herkunft, also einfach die --sp-*-Werte des aktiven Themes
   abschreiben - und bei jedem Theme-Wechsel dort erneut. */
const THEME_VARS = [
  "--sp-black", "--sp-bg", "--sp-elevated", "--sp-elevated-hover", "--sp-border", "--sp-text",
  "--sp-muted", "--sp-muted-2", "--sp-green", "--sp-green-hover", "--sp-on-accent", "--sp-scrollbar",
  "--radius-lg", "--radius-md", "--radius-sm", "--app-font",
];
(function syncThemeFromPlayer() {
  if (!inFrame) return;
  let parentRoot;
  try { parentRoot = window.parent.document.documentElement; } catch (_) { return; }
  const root = document.documentElement;
  const apply = () => {
    const cs = window.parent.getComputedStyle(parentRoot);
    for (const v of THEME_VARS) {
      const val = cs.getPropertyValue(v).trim();
      if (val) root.style.setProperty(v, val);
    }
    root.style.colorScheme = cs.colorScheme || "";
    if (parentRoot.dataset.scheme) root.dataset.scheme = parentRoot.dataset.scheme;
    else delete root.dataset.scheme;
    requestAnimationFrame(placeAllIndicators);
  };
  apply();
  new MutationObserver(apply).observe(parentRoot, { attributes: true, attributeFilter: ["style", "class", "data-theme", "data-scheme"] });
})();

// Sprache im Player gewechselt: gleicher Speicher, also hier nachziehen.
window.addEventListener("storage", (e) => {
  if (e.key === "appLanguage" && typeof window.setLanguage === "function") window.setLanguage(e.newValue);
});
document.addEventListener("i18n-changed", () => {
  applyAria();
  renderOptions();
  updateCounts();
  updateDock();
  requestAnimationFrame(placeAllIndicators);
});
function applyAria() {
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
}
applyAria();

/* Android's PoToken (BotGuard) generation runs in the background from page
   load (see potoken-init.js) and takes a couple seconds - awaiting it here
   before the first Innertube-touching call avoids firing a request that
   loses the bot-check race by a second. No-op on desktop. */
function awaitPoToken(timeoutMs = 6000) {
  const ready = window.__poTokenReady;
  if (!ready) return Promise.resolve();
  return Promise.race([ready, new Promise((r) => setTimeout(r, timeoutMs))]);
}

/* ===== Einstellungen =====
   QUALITY_PRESET_KEY liest auch player.js (Schnell-Downloads aus Entdecken
   und Suche) - Format und Schluessel deshalb unveraendert lassen. */
const QUALITY_PRESET_KEY = "downloadQualityPreset";
const PREFS_KEY = "downloaderPrefs";
// parallel 0 = "Alle Kerne": ein Titel pro logischem CPU-Kern (jeder Titel
// ist ein eigener yt-dlp- + ffmpeg-Prozess), sonst die feste Anzahl.
const CORES = Math.max(1, navigator.hardwareConcurrency || 4);
const ALL_CORES = 0;
const PARALLEL_CHOICES = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64].filter((n) => n < CORES).concat(ALL_CORES);
const parallelCount = () => (opts.parallel === ALL_CORES ? CORES : opts.parallel);
const parallelLabel = (n) => (n === ALL_CORES ? t("Alle Kerne ({n})", { n: CORES }) : t("{n} gleichzeitig", { n }));
const opts = { format: "mp3", bitrate: "192", quality: "best", studio: true, parallel: isAndroid ? 2 : ALL_CORES };
try {
  const q = JSON.parse(localStorage.getItem(QUALITY_PRESET_KEY) || "null");
  if (q) {
    if (q.format === "mp3" || q.format === "mp4") opts.format = q.format;
    if (["128", "192", "256", "320"].includes(q.bitrate)) opts.bitrate = q.bitrate;
    if (["best", "1080", "720", "480"].includes(q.quality)) opts.quality = q.quality;
  }
  const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
  if (p) {
    if (typeof p.studio === "boolean") opts.studio = p.studio;
    if (Number.isInteger(p.parallel) && p.parallel >= 0 && p.parallel <= 64) opts.parallel = p.parallel;
  }
} catch (_) { /* kaputter Speicher: Standardwerte */ }

function saveOpts() {
  try {
    localStorage.setItem(QUALITY_PRESET_KEY, JSON.stringify({ format: opts.format, bitrate: opts.bitrate, quality: opts.quality }));
    localStorage.setItem(PREFS_KEY, JSON.stringify({ studio: opts.studio, parallel: opts.parallel }));
  } catch (_) { /* privat/voll */ }
}

/* ===== Segment-Schalter ===== */
function placeIndicator(seg) {
  const on = seg.querySelector('[aria-checked="true"], [aria-selected="true"]');
  const ind = seg.querySelector(".seg-ind");
  if (!on || !ind || !on.offsetWidth) return;
  ind.style.width = on.offsetWidth + "px";
  ind.style.transform = `translateX(${on.offsetLeft - 3}px)`;
}
function placeAllIndicators() { document.querySelectorAll(".seg").forEach(placeIndicator); }
function selectIn(seg, btn) {
  const attr = btn.getAttribute("role") === "tab" ? "aria-selected" : "aria-checked";
  seg.querySelectorAll("button").forEach((b) => b.setAttribute(attr, String(b === btn)));
  placeIndicator(seg);
}
// Pfeiltasten wie bei einer Radiogruppe
document.querySelectorAll(".seg").forEach((seg) =>
  seg.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const btns = [...seg.querySelectorAll("button")].filter((b) => b.offsetParent);
    const i = btns.indexOf(document.activeElement);
    if (i < 0) return;
    const next = btns[(i + (e.key === "ArrowRight" ? 1 : -1) + btns.length) % btns.length];
    next.focus();
    next.click();
  })
);
addEventListener("resize", placeAllIndicators);
if (document.fonts) document.fonts.ready.then(placeAllIndicators);

const formatSeg = $("formatSeg"), bitrateSeg = $("bitrateSeg"), qualitySeg = $("qualitySeg");
const studioChip = $("studioChip"), parallelChip = $("parallelChip"), platformNote = $("platformNote");

function renderOptions() {
  formatSeg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.format === opts.format)));
  bitrateSeg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.value === opts.bitrate)));
  qualitySeg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.value === opts.quality)));
  const mp4 = opts.format === "mp4";
  // Android laedt ohne ffmpeg den fertigen Stream - Bitrate/Aufloesung
  // waehlt dort YouTube, die Schalter haetten keine Wirkung.
  bitrateSeg.classList.toggle("hidden", mp4 || isAndroid);
  qualitySeg.classList.toggle("hidden", !mp4 || isAndroid);
  studioChip.classList.toggle("hidden", mp4);
  studioChip.setAttribute("aria-checked", String(opts.studio));
  formatSeg.querySelector("[data-audio-label]").textContent = isAndroid ? t("Audio") : "MP3";
  parallelChip.querySelector("[data-parallel-label]").textContent = parallelLabel(opts.parallel);
  $("optsSummary").textContent = optsSummary();
  if (isAndroid) {
    platformNote.lastChild && platformNote.lastChild.nodeType === 3 && platformNote.lastChild.remove();
    platformNote.append(t("Auf Android wird Audio als M4A gespeichert und Video in Standard-Qualität – abgespielt wird beides ganz normal."));
    platformNote.classList.remove("hidden");
  }
  requestAnimationFrame(placeAllIndicators);
}

// Eingeklappte Zeile auf dem Handy: was gerade eingestellt ist, in Worten.
function optsSummary() {
  const mp4 = opts.format === "mp4";
  const quality = { best: t("Beste"), 1080: "1080p", 720: "720p", 480: "480p" }[opts.quality];
  const format = mp4
    ? (isAndroid ? "MP4" : `MP4 · ${quality}`)
    : (isAndroid ? t("Audio") : `MP3 · ${opts.bitrate} kbps`);
  return [format, !mp4 && opts.studio ? t("Studio-Audio") : "", parallelLabel(opts.parallel)].filter(Boolean).join(" · ");
}

const optsToggle = $("optsToggle");
optsToggle.addEventListener("click", () => {
  const open = optsToggle.getAttribute("aria-expanded") !== "true";
  optsToggle.setAttribute("aria-expanded", String(open));
  optsToggle.closest(".dl-source").classList.toggle("opts-open", open);
  // Die gleitenden Markierungen messen ihre Knoepfe - die hatten im
  // eingeklappten Zustand noch keine Breite.
  if (open) requestAnimationFrame(placeAllIndicators);
});

formatSeg.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  opts.format = b.dataset.format;
  saveOpts();
  renderOptions();
  updateDock();
});
bitrateSeg.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  opts.bitrate = b.dataset.value;
  selectIn(bitrateSeg, b);
  saveOpts();
  renderOptions();
  updateDock();
});
qualitySeg.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  opts.quality = b.dataset.value;
  selectIn(qualitySeg, b);
  saveOpts();
  renderOptions();
});
studioChip.addEventListener("click", () => {
  opts.studio = !opts.studio;
  studioChip.setAttribute("aria-checked", String(opts.studio));
  saveOpts();
  renderOptions();
});

/* Parallel-Auswahl als kleines Popover (auf dem Handy als Leiste unten) */
const parallelPop = $("parallelPop");
function renderParallelPop() {
  // Gespeicherter Wert, der auf diesem Rechner nicht in der Liste steht
  // (z.B. 8 vom PC, jetzt auf einem 4-Kern-Geraet), bleibt waehlbar.
  const choices = PARALLEL_CHOICES.includes(opts.parallel) ? PARALLEL_CHOICES : [opts.parallel, ...PARALLEL_CHOICES];
  parallelPop.querySelectorAll("[data-n]").forEach((b) => b.remove());
  const hint = parallelPop.querySelector(".dl-pop-hint");
  choices.forEach((n) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "option");
    b.dataset.n = n;
    b.textContent = parallelLabel(n);
    b.setAttribute("aria-selected", String(n === opts.parallel));
    parallelPop.insertBefore(b, hint);
  });
}
function closeParallelPop() { parallelPop.classList.add("hidden"); }
parallelChip.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!parallelPop.classList.contains("hidden")) return closeParallelPop();
  renderParallelPop();
  parallelPop.classList.remove("hidden");
  const r = parallelChip.getBoundingClientRect();
  parallelPop.style.left = Math.min(r.left, innerWidth - parallelPop.offsetWidth - 10) + "px";
  parallelPop.style.top = r.bottom + 8 + "px";
  (parallelPop.querySelector('[aria-selected="true"]') || parallelPop.querySelector("[data-n]")).focus();
});
parallelPop.addEventListener("click", (e) => {
  e.stopPropagation();
  const b = e.target.closest("[data-n]");
  if (!b) return;
  opts.parallel = +b.dataset.n;
  saveOpts();
  renderOptions();
  closeParallelPop();
  parallelChip.focus();
});
parallelPop.addEventListener("keydown", (e) => {
  const btns = [...parallelPop.querySelectorAll("[data-n]")];
  const i = btns.indexOf(document.activeElement);
  if (e.key === "ArrowDown") { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
  if (e.key === "ArrowUp") { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
});
document.addEventListener("click", closeParallelPop);

/* ===== Quelle: Link oder Songtext ===== */
const modeSeg = $("modeSeg"), loadForm = $("loadForm"), lyricsForm = $("lyricsForm");
const urlInput = $("urlInput"), lyricsInput = $("lyricsInput"), loadBtn = $("loadBtn"), lyricsBtn = $("lyricsBtn");
modeSeg.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  selectIn(modeSeg, b);
  const lyrics = b.dataset.mode === "lyrics";
  loadForm.classList.toggle("hidden", lyrics);
  lyricsForm.classList.toggle("hidden", !lyrics);
  (lyrics ? lyricsInput : urlInput).focus();
});

// Einfuegen-Knopf: auf dem Handy ist langes Druecken ins Feld fummelig.
$("pasteBtn").addEventListener("click", async () => {
  try {
    const text = (await navigator.clipboard.readText()).trim();
    if (text) {
      urlInput.value = text;
      if (/^https?:\/\//i.test(text)) loadForm.requestSubmit();
      return;
    }
  } catch (_) { /* kein Zugriff auf die Zwischenablage */ }
  urlInput.focus();
});

/* ===== Meldungen ===== */
const statusEl = $("status");
function setStatus(msg, isError = false) {
  statusEl.textContent = msg || "";
  statusEl.classList.toggle("error", !!isError && !!msg);
}
function showToast(message, type = "info") {
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.innerHTML = window.icon(type === "success" ? "checkmark" : type === "error" ? "alert" : "music");
  el.append(message);
  $("toastContainer").appendChild(el);
  setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 200);
  }, 3600);
}
function fmtDuration(sec) {
  if (!sec && sec !== 0) return "";
  sec = Math.round(sec);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}
function fmtTotal(sec) {
  const m = Math.round(sec / 60);
  return m >= 60 ? t("{h} Std. {m} Min.", { h: Math.floor(m / 60), m: m % 60 }) : t("{m} Min.", { m });
}

/* ===== Zustand ===== */
let tracks = []; // { id, title, uploader, duration, thumbnail, url, selected, state, error, li }
let listTitle = "playlist";
let filter = "all";
let running = null; // laufender Sammel-Download

const results = $("results"), emptyState = $("emptyState"), skeleton = $("skeleton");
const trackList = $("trackList"), dock = $("dock");

function showView(view) {
  emptyState.classList.toggle("hidden", view !== "empty");
  skeleton.classList.toggle("hidden", view !== "loading");
  results.classList.toggle("hidden", view !== "results");
  if (view === "results") requestAnimationFrame(placeAllIndicators);
}

/* ===== Laden ===== */
async function loadList(btn, fetcher) {
  if (running) return showToast(t("Erst den laufenden Download beenden."), "info");
  btn.classList.add("busy");
  btn.disabled = true;
  setStatus("");
  showView("loading");
  dock.classList.add("hidden");
  try {
    await awaitPoToken();
    const data = await fetcher();
    if (!data.entries.length) throw new Error(t("Keine Titel gefunden."));
    renderResults(data);
  } catch (err) {
    showView(tracks.length ? "results" : "empty");
    if (tracks.length) dock.classList.remove("hidden");
    const msg = String(err && err.message ? err.message : err);
    setStatus(msg, true);
  } finally {
    btn.classList.remove("busy");
    btn.disabled = false;
  }
}

loadForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const url = urlInput.value.trim();
  if (!url) return urlInput.focus();
  loadList(loadBtn, async () => {
    const data = await invoke("resolve_playlist", { url });
    if (data.unmatched) showToast(t("{count} Spotify-Titel ohne YouTube-Treffer übersprungen.", { count: data.unmatched }), "info");
    return { title: data.title, kind: data.count > 1 ? t("Playlist") : t("Titel"), entries: data.entries || [] };
  });
});

lyricsForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const query = lyricsInput.value.trim();
  if (!query) return lyricsInput.focus();
  // Keine eigene Songtext-Suche: YouTube-Titel und -Beschreibungen
  // enthalten oft Textzeilen, die normale Suche findet sie also.
  loadList(lyricsBtn, async () => {
    const hits = await invoke("search_online", { query });
    if (!hits.length) throw new Error(t("Kein Song zu diesem Songtext gefunden."));
    return {
      title: t("Songtext-Suche"),
      kind: t("{count} Treffer", { count: hits.length }),
      entries: hits.map((h) => ({ id: h.video_id, title: h.title, uploader: h.artist, duration: h.duration, thumbnail: h.cover, url: h.url })),
    };
  });
});

function thumbFor(entry) {
  return entry.thumbnail || `https://i.ytimg.com/vi/${entry.id}/mqdefault.jpg`;
}

function renderResults(data) {
  listTitle = data.title || "playlist";
  tracks = data.entries.map((e) => ({ ...e, selected: true, state: "idle", error: "" }));
  filter = "all";
  $("findInput").value = "";
  selectIn($("filterSeg"), $("filterSeg").querySelector('[data-filter="all"]'));

  $("plKind").textContent = data.kind;
  $("plTitle").textContent = listTitle;
  const total = tracks.reduce((s, x) => s + (x.duration || 0), 0);
  $("plMeta").textContent = [t("{count} Titel", { count: tracks.length }), total ? fmtTotal(total) : ""].filter(Boolean).join(" · ");
  const cover = $("plCover");
  cover.src = thumbFor(tracks[0]);
  heroColorFrom(cover.src);

  trackList.innerHTML = "";
  const frag = document.createDocumentFragment();
  tracks.forEach((tr, i) => frag.appendChild(buildRow(tr, i)));
  trackList.appendChild(frag);
  showView("results");
  setStatus("");
  updateCounts();
  dock.dataset.state = "select";
  dock.classList.remove("hidden");
  updateDock();
}

// Cover-Farbe fuer den Kopfverlauf (24x24-Durchschnitt, wie im Player).
function heroColorFrom(src) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 24;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, 24, 24);
      const d = ctx.getImageData(0, 0, 24, 24).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4;
      $("heroBg").style.setProperty("--hero-c", `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`);
    } catch (_) {
      $("heroBg").style.removeProperty("--hero-c"); // fremdes Bild ohne CORS: Akzentfarbe
    }
  };
  img.src = src;
}

function buildRow(tr, i) {
  const li = document.createElement("li");
  li.className = "trk";
  li.style.setProperty("--i", i);

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "trk-check";
  cb.checked = true;
  cb.setAttribute("aria-label", tr.title);
  cb.addEventListener("change", () => {
    tr.selected = cb.checked;
    li.classList.toggle("off", !cb.checked);
    updateCounts();
    updateDock();
  });

  const img = document.createElement("img");
  img.className = "trk-thumb";
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  img.src = thumbFor(tr);

  const info = document.createElement("div");
  info.className = "trk-info";
  const title = document.createElement("div");
  title.className = "trk-title";
  title.textContent = tr.title;
  const sub = document.createElement("div");
  sub.className = "trk-sub";
  sub.textContent = tr.uploader || "";
  info.append(title, sub);

  const dur = document.createElement("span");
  dur.className = "trk-dur";
  dur.textContent = fmtDuration(tr.duration);

  const act = document.createElement("div");
  act.className = "trk-act";
  const yt = document.createElement("button");
  yt.type = "button";
  yt.className = "dl-icon-btn trk-yt";
  yt.title = t("Auf YouTube ansehen");
  yt.innerHTML = window.icon("play");
  yt.addEventListener("click", () => window.open(tr.url || `https://www.youtube.com/watch?v=${tr.id}`, "_blank", "noopener"));
  const dl = document.createElement("button");
  dl.type = "button";
  dl.className = "dl-icon-btn trk-dl";
  dl.title = t("Nur diesen Titel laden");
  dl.innerHTML = window.icon("download");
  dl.addEventListener("click", () => {
    if (tr.state === "err") return showReport([{ title: tr.title, reason: tr.error }]);
    if (tr.state === "idle" || tr.state === "done") downloadSingle(tr);
  });
  act.append(yt, dl);

  const bar = document.createElement("div");
  bar.className = "trk-bar";
  bar.appendChild(document.createElement("i"));

  li.append(cb, img, info, dur, act, bar);
  // Ganze Zeile antippbar statt nur des 20px-Kaestchens - auf dem Handy
  // traf man das sonst kaum.
  li.addEventListener("click", (e) => {
    if (e.target.closest("button, input") || cb.disabled) return;
    cb.click();
  });
  tr.li = li;
  tr.els = { cb, sub, dl, bar: bar.firstChild };
  return li;
}

/* Zeile auf ihren Zustand bringen: idle | queue | run | converting | done | err */
function setRowState(tr, state, extra = {}) {
  tr.state = state;
  const { li, els } = tr;
  li.classList.toggle("run", state === "run" || state === "converting");
  li.classList.toggle("converting", state === "converting");
  li.classList.toggle("done", state === "done");
  li.classList.toggle("err", state === "err");
  els.cb.disabled = state === "queue" || state === "run" || state === "converting";
  els.dl.classList.toggle("trk-wait", state === "queue");
  if (state === "queue") {
    els.dl.innerHTML = window.icon("clock");
    els.dl.disabled = true;
  } else if (state === "run" || state === "converting") {
    els.dl.innerHTML = '<span class="trk-spin"></span>';
    els.dl.disabled = true;
  } else {
    els.dl.disabled = false;
    els.dl.innerHTML = window.icon(state === "done" ? "checkmark" : state === "err" ? "alert" : "download");
    els.dl.title = state === "err" ? t("Warum? Fehler anzeigen") : state === "done" ? t("Erneut laden") : t("Nur diesen Titel laden");
  }
  if (state === "run") {
    els.bar.style.width = `${extra.percent || 0}%`;
    const parts = [`${Math.round(extra.percent || 0)} %`];
    if (extra.speed) parts.push(extra.speed);
    if (extra.eta) parts.push(t("noch {eta}", { eta: extra.eta }));
    if (extra.note) parts.splice(0, parts.length, extra.note);
    els.sub.textContent = parts.join(" · ");
  } else if (state === "converting") {
    els.sub.textContent = t("Wird umgewandelt …");
  } else if (state === "queue") {
    els.sub.textContent = t("Wartet …");
  } else if (state === "err") {
    els.sub.textContent = tr.error;
    els.bar.style.width = "0%";
  } else {
    els.sub.textContent = state === "done" ? t("In der Bibliothek") : tr.uploader || "";
    els.bar.style.width = "0%";
  }
  updateCounts();
}

/* ===== Filter und Suche ===== */
$("filterSeg").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  filter = b.dataset.filter;
  selectIn($("filterSeg"), b);
  applyFilter();
});
$("findInput").addEventListener("input", applyFilter);
function applyFilter() {
  const q = $("findInput").value.trim().toLowerCase();
  let shown = 0;
  for (const tr of tracks) {
    const okFilter = filter === "all" || (filter === "done" && tr.state === "done") || (filter === "err" && tr.state === "err");
    const okFind = !q || tr.title.toLowerCase().includes(q) || (tr.uploader || "").toLowerCase().includes(q);
    const show = okFilter && okFind;
    tr.li.classList.toggle("hidden", !show);
    if (show) shown++;
  }
  $("noMatch").classList.toggle("hidden", shown > 0 || !tracks.length);
}
function updateCounts() {
  const c = { all: tracks.length, done: 0, err: 0 };
  tracks.forEach((x) => { if (x.state === "done") c.done++; if (x.state === "err") c.err++; });
  document.querySelectorAll("[data-count]").forEach((el) => (el.textContent = c[el.dataset.count]));
  const allSel = tracks.length && tracks.every((x) => x.selected);
  $("selectAllBtn").querySelector("span").textContent = allSel ? t("Alle abwählen") : t("Alle auswählen");
  requestAnimationFrame(() => placeIndicator($("filterSeg")));
}
$("selectAllBtn").addEventListener("click", () => {
  const target = !tracks.every((x) => x.selected);
  for (const tr of tracks) {
    if (tr.els.cb.disabled) continue;
    tr.selected = target;
    tr.els.cb.checked = target;
    tr.li.classList.toggle("off", !target);
  }
  updateCounts();
  updateDock();
});

// Kante unter der klebenden Werkzeugleiste, sobald sie oben anliegt
const toolbar = document.querySelector(".dl-toolbar");
addEventListener("scroll", () => {
  toolbar.classList.toggle("stuck", toolbar.getBoundingClientRect().top <= 0.5 && !results.classList.contains("hidden"));
}, { passive: true });

/* ===== Herunterladen ===== */
let taskCounter = 0;

async function downloadOne(tr) {
  const taskId = `dl${Date.now().toString(36)}${++taskCounter}`;
  tr.taskId = taskId;
  setRowState(tr, "run", { percent: 0 });
  const unlisten = await listen(`dl-progress-${taskId}`, (e) => {
    const d = e.payload || {};
    if (d.phase === "converting" || (d.percent >= 100 && d.phase !== "retrying")) setRowState(tr, "converting");
    else setRowState(tr, "run", { percent: d.percent || 0, speed: d.speed, eta: d.eta, note: d.phase === "retrying" ? d.note || t("Erneuter Versuch …") : "" });
    if (running) renderRun();
  });
  try {
    await invoke("download_track_progress", {
      taskId,
      videoId: tr.id,
      title: tr.title || "",
      uploader: tr.uploader || "",
      duration: tr.duration || null,
      thumbnail: tr.thumbnail || null,
      bitrate: opts.bitrate,
      format: opts.format,
      quality: opts.quality,
      preferAudio: opts.format === "mp3" && opts.studio,
      playlistName: listTitle,
    });
    tr.error = "";
    setRowState(tr, "done");
    return true;
  } catch (err) {
    tr.error = String(err) || t("Download fehlgeschlagen.");
    setRowState(tr, tr.error === "Abgebrochen." ? "idle" : "err");
    if (tr.error === "Abgebrochen.") tr.error = "";
    return false;
  } finally {
    tr.taskId = null;
    unlisten();
  }
}

async function downloadSingle(tr) {
  if (running) return;
  await awaitPoToken();
  const ok = await downloadOne(tr);
  if (ok) showToast(t("„{title}“ ist in der Bibliothek", { title: tr.title }), "success");
  else if (tr.state === "err") showToast(tr.error, "error");
}

function updateDock() {
  if (running || dock.dataset.state !== "select") return;
  const sel = tracks.filter((x) => x.selected && x.state !== "done");
  $("selCount").textContent = t("{count} Titel ausgewählt", { count: sel.length });
  const total = sel.reduce((s, x) => s + (x.duration || 0), 0);
  $("selInfo").textContent = [
    opts.format === "mp4" ? "MP4" : isAndroid ? "M4A" : `MP3 · ${opts.bitrate} kbps`,
    total ? fmtTotal(total) : "",
  ].filter(Boolean).join(" · ");
  $("startBtn").disabled = !sel.length;
}

let paused = false;
const pauseBtn = $("pauseBtn");
function setPaused(p) {
  paused = p;
  pauseBtn.classList.toggle("paused", p);
  pauseBtn.dataset.icon = p ? "play" : "pause";
  window.hydrateIcons(pauseBtn.parentElement);
  pauseBtn.title = p ? t("Fortsetzen") : t("Pausieren");
  if (running) renderRun();
}
pauseBtn.addEventListener("click", () => setPaused(!paused));

function renderRun() {
  const r = running;
  const doneCount = r.ok + r.failed;
  // Laufende Titel anteilig mitzaehlen, damit der Ring nicht springt
  const partial = r.list.filter((x) => x.state === "run").reduce((s, x) => s + (parseFloat(x.els.bar.style.width) || 0) / 100, 0)
    + r.list.filter((x) => x.state === "converting").length * 0.95;
  const pct = Math.min(100, ((doneCount + partial) / r.list.length) * 100);
  $("ringVal").style.strokeDashoffset = String(100 - pct);
  $("ringPct").textContent = Math.round(pct);
  $("dockFill").style.width = pct + "%";
  const active = r.list.filter((x) => x.state === "run" || x.state === "converting");
  $("runHead").textContent = r.stopping ? t("Wird abgebrochen …")
    : paused ? t("Pausiert – laufende Titel werden fertig")
    : t("{done} von {total} geladen", { done: doneCount, total: r.list.length });
  $("runSub").textContent = active.map((x) => x.title).join(" · ") || (r.failed ? t("{n} übersprungen", { n: r.failed }) : "");
}

$("startBtn").addEventListener("click", async () => {
  const list = tracks.filter((x) => x.selected && x.state !== "done");
  if (!list.length) return showToast(t("Bitte mindestens einen Titel auswählen."), "error");
  running = { list, ok: 0, failed: 0, stopping: false, skipped: [] };
  setPaused(false);
  list.forEach((x) => setRowState(x, "queue"));
  dock.dataset.state = "run";
  renderRun();
  await awaitPoToken();

  let next = 0;
  async function worker() {
    while (next < list.length && !running.stopping) {
      while (paused && !running.stopping) await new Promise((r) => setTimeout(r, 250));
      if (running.stopping) break;
      const tr = list[next++];
      const ok = await downloadOne(tr);
      if (ok) running.ok++;
      else if (tr.state === "err") {
        running.failed++;
        running.skipped.push({ title: tr.title, reason: tr.error });
      }
      renderRun();
    }
  }
  await Promise.all(Array.from({ length: Math.min(parallelCount(), list.length) }, worker));

  // Nach Abbruch zurueck in den Ausgangszustand, was nicht dran war
  list.forEach((x) => { if (x.state === "queue") setRowState(x, "idle"); });
  const r = running;
  running = null;
  finishRun(r);
});

$("stopBtn").addEventListener("click", () => {
  if (!running || running.stopping) return;
  running.stopping = true;
  renderRun();
  const ids = running.list.map((x) => x.taskId).filter(Boolean);
  if (ids.length) invoke("cancel_downloads", { taskIds: ids }).catch(() => {});
});

function finishRun(r) {
  dock.dataset.state = "done";
  $("dockFill").style.width = "100%";
  const head = r.stopping ? t("Abgebrochen") : r.failed ? t("Fertig – mit Lücken") : t("Fertig");
  $("doneHead").textContent = head;
  $("doneSub").textContent = r.failed
    ? t("{ok} geladen, {failed} übersprungen", { ok: r.ok, failed: r.failed })
    : t("{ok} Titel in „{list}“", { ok: r.ok, list: listTitle });
  const rep = $("reportBtn");
  rep.classList.toggle("hidden", !r.skipped.length);
  rep.onclick = () => showReport(r.skipped);
  dock.querySelector(".dock-ok").style.color = r.failed || r.stopping ? "var(--sp-green)" : "";
  // Bibliothek im Player sofort auffrischen, nicht erst beim Schliessen
  try { if (inFrame && typeof window.parent.refreshLibrary === "function") window.parent.refreshLibrary(); } catch (_) { /* fremd */ }
}

$("dockClose").addEventListener("click", () => {
  $("dockFill").style.width = "0";
  dock.dataset.state = "select";
  updateDock();
});

/* ===== Fehlerbericht ===== */
const reportModal = $("reportModal");
let reportOpener = null;
function showReport(items) {
  reportOpener = document.activeElement;
  const body = $("reportBody");
  body.innerHTML = "";
  for (const it of items) {
    const d = document.createElement("div");
    d.className = "rep-item";
    const b = document.createElement("b");
    b.textContent = it.title;
    const s = document.createElement("span");
    s.textContent = it.reason;
    d.append(b, s);
    body.appendChild(d);
  }
  reportModal.classList.remove("hidden");
  $("reportClose").focus();
}
function closeReport() {
  reportModal.classList.add("hidden");
  if (reportOpener) reportOpener.focus();
}
$("reportClose").addEventListener("click", closeReport);
reportModal.addEventListener("click", (e) => { if (e.target === reportModal) closeReport(); });
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!reportModal.classList.contains("hidden")) { e.stopPropagation(); closeReport(); }
  else if (!parallelPop.classList.contains("hidden")) { closeParallelPop(); parallelChip.focus(); }
});

/* ===== Start ===== */
renderOptions();
showView("empty");
