/* Reson-Website: Theme (System/Hell/Dunkel mit Kreis-Uebergang), Sprache,
   Download-Links aus dem neuesten GitHub-Release, Handy-Menue und die
   kleinen Vorfuehrungen (Downloader, QR, Theme-Vorschau). */
(function () {
  "use strict";

  const REPO = "Gaboro030/meine-musik-app";
  const RELEASES = `https://github.com/${REPO}/releases/latest`;
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const mqDark = matchMedia("(prefers-color-scheme: dark)");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* privater Modus */ } },
  };

  /* ================= Sprache ================= */
  const DICT = window.RESON_I18N;
  const LANG_NAMES = { de: "Deutsch", en: "English", tr: "Türkçe" };
  let langPref = store.get("resonSiteLang") || "system";
  let lang = root.lang;

  function resolveLang(pref) {
    const code = pref === "system" ? (navigator.language || "en").slice(0, 2).toLowerCase() : pref;
    return DICT[code] ? code : "en";
  }
  function t(key, vars) {
    let s = (DICT[lang] && DICT[lang][key]) || DICT.de[key] || "";
    if (vars) for (const k in vars) s = s.replace(`{${k}}`, vars[k]);
    return s;
  }
  function applyLang() {
    root.lang = lang;
    document.title = t("docTitle");
    $$("[data-i18n]").forEach((el) => {
      const s = t(el.dataset.i18n);
      if (!s) return;
      if (s.includes("<")) el.innerHTML = s; else el.textContent = s;
    });
    $$("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
    $$("[data-lang-current]").forEach((el) => (el.textContent = lang.toUpperCase()));
    $$("[data-lang-name]").forEach((el) => (el.textContent = langPref === "system" ? t("langSystem") : LANG_NAMES[lang]));
    $$("#langPop [data-lang]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.lang === langPref)));
    renderPlatform();
    renderRelease();
    requestAnimationFrame(placeIndicators);
  }
  function setLang(pref) {
    langPref = pref;
    store.set("resonSiteLang", pref);
    const next = resolveLang(pref);
    if (next === lang || reduceMotion.matches) { lang = next; applyLang(); return; }
    // weiche Ueberblendung statt hartem Textsprung
    root.classList.add("lang-fading");
    setTimeout(() => {
      lang = next;
      applyLang();
      root.classList.remove("lang-fading");
    }, 180);
  }

  /* Sprach-Popover: am Knopf verankert, auf dem Handy als Sheet (CSS) */
  const langPop = $("#langPop");
  let langOpener = null;
  function openLang(btn) {
    langOpener = btn;
    langPop.hidden = false;
    if (innerWidth >= 860) {
      const r = btn.getBoundingClientRect();
      const w = langPop.offsetWidth, h = langPop.offsetHeight;
      const left = Math.min(Math.max(8, r.right - w), innerWidth - w - 8);
      const below = r.bottom + 8 + h < innerHeight;
      langPop.style.left = left + "px";
      langPop.style.top = (below ? r.bottom + 8 : r.top - 8 - h) + "px";
      langPop.style.transformOrigin = below ? "top right" : "bottom right";
    }
    $$("[data-lang-open]").forEach((b) => b.setAttribute("aria-expanded", String(b === btn)));
    requestAnimationFrame(() => {
      langPop.classList.add("open");
      ($(`[data-lang="${langPref}"]`, langPop) || langPop.firstElementChild).focus();
    });
  }
  function closeLang(focusBack) {
    if (langPop.hidden) return;
    langPop.classList.remove("open");
    $$("[data-lang-open]").forEach((b) => b.setAttribute("aria-expanded", "false"));
    setTimeout(() => { if (!langPop.classList.contains("open")) langPop.hidden = true; }, 220);
    if (focusBack && langOpener) langOpener.focus();
  }
  $$("[data-lang-open]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      langPop.hidden || !langPop.classList.contains("open") ? openLang(btn) : closeLang(true);
    })
  );
  langPop.addEventListener("click", (e) => {
    const b = e.target.closest("[data-lang]");
    if (!b) return;
    e.stopPropagation();
    closeLang(true);
    setLang(b.dataset.lang);
  });
  langPop.addEventListener("keydown", (e) => {
    const opts = $$("[data-lang]", langPop);
    const i = opts.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); opts[(i + 1) % opts.length].focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); opts[(i - 1 + opts.length) % opts.length].focus(); }
    if (e.key === "Home") { e.preventDefault(); opts[0].focus(); }
    if (e.key === "End") { e.preventDefault(); opts[opts.length - 1].focus(); }
    if (e.key === "Tab") closeLang(false);
  });
  document.addEventListener("click", (e) => { if (!langPop.contains(e.target)) closeLang(false); });

  /* ================= Theme ================= */
  function themePref() { return store.get("resonSiteTheme") || "system"; }
  function applyTheme(pref, origin) {
    const dark = pref === "dark" || (pref === "system" && mqDark.matches);
    const set = () => {
      root.dataset.theme = dark ? "dark" : "light";
      root.dataset.themePref = pref;
      syncThemeControls();
    };
    store.set("resonSiteTheme", pref);
    const unchanged = root.dataset.theme === (dark ? "dark" : "light");
    if (unchanged || reduceMotion.matches) { set(); return; }
    if (!document.startViewTransition) {
      root.classList.add("theme-fade");
      set();
      setTimeout(() => root.classList.remove("theme-fade"), 300);
      return;
    }
    root.classList.add("theme-switching");
    if (origin) root.classList.add("theme-reveal");
    const tr = document.startViewTransition(set);
    if (origin) {
      const { x, y } = origin;
      const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      tr.ready.then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 700, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" }
        );
      });
    }
    tr.finished.finally(() => root.classList.remove("theme-switching", "theme-reveal"));
  }
  function syncThemeControls() {
    const pref = root.dataset.themePref || "system";
    $$("[data-theme-pref]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.themePref === pref)));
    placeIndicators();
  }
  function placeIndicators() {
    $$(".seg").forEach((seg) => {
      const on = $('[aria-checked="true"]', seg);
      const ind = $(".seg-indicator", seg);
      if (!on || !ind || !on.offsetWidth) return;
      ind.style.width = on.offsetWidth + "px";
      ind.style.transform = `translateX(${on.offsetLeft}px)`;
    });
  }
  $$("[data-theme-pref]").forEach((b) =>
    b.addEventListener("click", () => {
      const r = b.getBoundingClientRect();
      applyTheme(b.dataset.themePref, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    })
  );
  // Pfeiltasten im Segment-Schalter wie bei einer Radiogruppe
  $$(".seg").forEach((seg) =>
    seg.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const opts = $$("[data-theme-pref]", seg);
      const i = opts.indexOf(document.activeElement);
      const next = opts[(i + (e.key === "ArrowRight" ? 1 : -1) + opts.length) % opts.length];
      next.focus();
      next.click();
    })
  );
  mqDark.addEventListener("change", () => { if (themePref() === "system") applyTheme("system"); });
  addEventListener("resize", placeIndicators);

  /* ================= Plattform + Release ================= */
  function detectOS() {
    const ua = navigator.userAgent;
    const p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
    if (/android/i.test(ua)) return "android";
    if (/iPhone|iPad|iPod/.test(ua) || (p === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
    if (/Win/i.test(p) || /Windows/.test(ua)) return "windows";
    if (/Mac/i.test(p)) return "mac";
    if (/Linux|X11|CrOS/i.test(p + ua)) return "linux";
    return "unknown";
  }
  const os = detectOS();
  const OS_INFO = {
    windows: { name: "Windows", icon: "i-windows", asset: "windows", card: "windows" },
    android: { name: "Android", icon: "i-android", asset: "android", card: "android" },
    linux: { name: "Linux", icon: "i-linux", asset: "appimage", card: "linux" },
  };
  // Feste Fallbacks, bis (oder falls nie) die GitHub-API antwortet.
  const assets = {
    windows: { url: RELEASES },
    appimage: { url: RELEASES },
    deb: { url: RELEASES },
    android: { url: `${RELEASES}/download/android-Reson.apk` },
  };
  let release = null;

  function renderPlatform() {
    const info = OS_INFO[os];
    $$("[data-primary-download]").forEach((a) => {
      $("[data-primary-label]", a).textContent = info ? t("ctaFor", { os: info.name }) : t("ctaGeneric");
      $("[data-primary-icon] use", a).setAttribute("href", info ? "#" + info.icon : "#i-download");
      const u = info && assets[info.asset].url;
      a.href = u && u !== RELEASES ? u : "#download";
    });
    $$(".platform").forEach((card) => {
      const cur = info && card.dataset.platform === info.card;
      card.classList.toggle("current", !!cur);
      if (cur) card.dataset.badge = t("yourDevice");
    });
    $("[data-unsupported]").hidden = !(os === "ios" || os === "mac");
  }

  function fmtSize(bytes) {
    return (bytes / 1048576).toLocaleString(lang, { maximumFractionDigits: 0 }) + " MB";
  }
  function renderRelease() {
    $$("[data-asset]").forEach((a) => {
      const it = assets[a.dataset.asset];
      a.href = it.url;
      const s = $("[data-size]", a);
      if (s) s.textContent = it.size ? fmtSize(it.size) : "";
    });
    if (!release) return;
    const v = release.tag_name.replace(/^v/, "");
    const date = new Date(release.published_at).toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" });
    $$("[data-release-line]").forEach((el) => (el.textContent = t("releaseLine", { v, date })));
    $$("[data-release-detail]").forEach((el) => (el.textContent = t("releaseDetail", { v, date })));
  }

  async function loadRelease() {
    let data = null;
    try {
      const cached = JSON.parse(sessionStorage.getItem("resonRelease") || "null");
      if (cached && Date.now() - cached.at < 3600e3) data = cached.data;
    } catch (e) { /* kein Cache */ }
    if (!data) {
      try {
        const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } });
        if (!res.ok) throw new Error(res.status);
        const j = await res.json();
        data = { tag_name: j.tag_name, published_at: j.published_at, assets: j.assets.map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url })) };
        try { sessionStorage.setItem("resonRelease", JSON.stringify({ at: Date.now(), data })); } catch (e) { /* egal */ }
      } catch (e) {
        return; // Fallback-Links (Release-Seite) bleiben stehen
      }
    }
    const pick = (re) => data.assets.find((a) => re.test(a.name));
    const map = { windows: /setup\.exe$/i, appimage: /\.AppImage$/, deb: /\.deb$/, android: /\.apk$/i };
    for (const k in map) {
      const a = pick(map[k]);
      if (a) assets[k] = { url: a.url, size: a.size };
    }
    release = data;
    renderPlatform();
    renderRelease();
  }

  /* ================= Kopfzeile, Handy-Menue, Download-Leiste ================= */
  const topbar = $(".topbar");
  const onScroll = () => topbar.classList.toggle("scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const sheet = $("#menuSheet"), backdrop = $("#menuBackdrop"), menuBtn = $("#menuBtn");
  function openMenu() {
    sheet.hidden = backdrop.hidden = false;
    menuBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      sheet.classList.add("open");
      backdrop.classList.add("open");
      placeIndicators();
      $("a", sheet).focus({ preventScroll: true });
    });
  }
  function closeMenu(focusBack = true) {
    if (sheet.hidden) return;
    sheet.classList.remove("open");
    backdrop.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    setTimeout(() => { if (!sheet.classList.contains("open")) sheet.hidden = backdrop.hidden = true; }, 380);
    if (focusBack) menuBtn.focus({ preventScroll: true });
  }
  menuBtn.addEventListener("click", openMenu);
  backdrop.addEventListener("click", () => closeMenu());
  $$("a", sheet).forEach((a) => a.addEventListener("click", () => closeMenu(false)));
  // Fokus im offenen Sheet halten
  sheet.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || !langPop.hidden) return;
    const f = $$("a, button", sheet).filter((el) => el.offsetParent);
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });
  // Nach unten wischen schliesst das Sheet
  let dragY = null;
  sheet.addEventListener("touchstart", (e) => { if (sheet.scrollTop <= 0) dragY = e.touches[0].clientY; }, { passive: true });
  sheet.addEventListener("touchmove", (e) => {
    if (dragY === null) return;
    const dy = Math.max(0, e.touches[0].clientY - dragY);
    sheet.style.transition = "none";
    sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  sheet.addEventListener("touchend", (e) => {
    if (dragY === null) return;
    const dy = e.changedTouches[0].clientY - dragY;
    dragY = null;
    sheet.style.transition = sheet.style.transform = "";
    if (dy > 90) closeMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!langPop.hidden) closeLang(true);
    else closeMenu();
  });
  addEventListener("resize", () => { if (innerWidth >= 860) closeMenu(false); });

  // Download-Leiste: sichtbar, sobald der Hero-Knopf weg ist - aber nicht im Download-Bereich selbst
  const dock = $("#dock");
  const seen = { hero: true, download: false, final: false };
  const dockIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => (seen[en.target.dataset.watch] = en.isIntersecting));
    const show = !seen.hero && !seen.download && !seen.final;
    dock.classList.toggle("show", show);
    dock.setAttribute("aria-hidden", String(!show));
    $("a", dock).tabIndex = show ? 0 : -1;
  });
  [[".hero-cta", "hero"], ["#download", "download"], [".final", "final"]].forEach(([s, k]) => {
    const el = $(s);
    el.dataset.watch = k;
    dockIO.observe(el);
  });

  // aktiver Abschnitt in der Navigation
  const navLinks = $$(".nav a");
  const navIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  navLinks.forEach((a) => { const s = $(a.getAttribute("href")); if (s) navIO.observe(s); });

  /* ================= Erscheinen beim Scrollen ================= */
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add("in");
      revealIO.unobserve(en.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
  $$(".reveal").forEach((el) => {
    // Geschwister nacheinander einblenden (40 ms Abstand)
    const sibs = $$(":scope > .reveal", el.parentElement);
    el.style.setProperty("--d", Math.min(sibs.indexOf(el), 8) * 40 + "ms");
    revealIO.observe(el);
  });

  /* ================= Downloader-Vorfuehrung ================= */
  (function downloaderDemo() {
    const demo = $(".dl-demo");
    const url = $("[data-typing]", demo);
    const full = url.textContent;
    const rows = $$(".dl-list li", demo).map((li) => ({ state: $(".dl-state", li), fill: $(".fill", li), p: +$(".dl-state", li).dataset.p }));
    const speed = $("[data-dl-speed]", demo);
    const draw = () => rows.forEach((r) => {
      r.fill.style.width = r.p + "%";
      r.state.classList.toggle("ok", r.p >= 100);
      r.state.textContent = r.p >= 100 ? t("dlDone") : r.p + " %";
    });
    draw();
    if (reduceMotion.matches) { url.classList.add("done"); return; }

    let timer = null, typed = 0;
    function tick() {
      if (typed < full.length) { // erst die Adresse "tippen"
        typed = Math.min(full.length, typed + 2);
        url.textContent = full.slice(0, typed);
        if (typed === full.length) url.classList.add("done");
        return;
      }
      const active = rows.find((r) => r.p < 100);
      if (!active) { // alles fertig: kurz stehen lassen, dann von vorn
        rows.forEach((r, i) => (r.p = [100, 100, 0, 0, 0][i]));
        typed = full.length;
        return;
      }
      active.p = Math.min(100, active.p + 3 + Math.round(Math.random() * 5));
      speed.textContent = (3.6 + Math.random() * 2.4).toLocaleString(lang, { maximumFractionDigits: 1 }) + " MB/s";
      draw();
    }
    url.textContent = "";
    new IntersectionObserver(([en]) => {
      clearInterval(timer);
      if (en.isIntersecting) timer = setInterval(tick, 140);
    }).observe(demo);
  })();

  /* ================= Deko-QR-Code fuer den Party-Modus ================= */
  (function qr() {
    const el = $("[data-qr]");
    const N = 21;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const finder = (x, y) => {
      for (const [fx, fy] of [[0, 0], [N - 7, 0], [0, N - 7]]) {
        const dx = x - fx, dy = y - fy;
        if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
          const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
          return ring === 3 || ring <= 1 ? 1 : 0;
        }
        if (dx >= -1 && dx <= 7 && dy >= -1 && dy <= 7) return 0;
      }
      return -1;
    };
    let html = "";
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const f = finder(x, y);
        const on = f === -1 ? (y === 6 || x === 6 ? (x + y) % 2 === 0 : rnd() > 0.52) : f === 1;
        html += on ? "<i></i>" : '<i class="o"></i>';
      }
    el.innerHTML = html;
  })();

  /* ================= Theme-Vorschau ================= */
  const preview = $(".theme-preview");
  const swatchName = $("[data-swatch-name]");
  $$(".swatches button").forEach((b) => {
    b.style.setProperty("--a", b.dataset.acc);
    b.style.setProperty("--b", b.dataset.bg);
    b.addEventListener("click", () => {
      $$(".swatches button").forEach((o) => o.setAttribute("aria-checked", String(o === b)));
      preview.style.setProperty("--mock-acc", b.dataset.acc);
      preview.style.setProperty("--mock-acc-bg", b.dataset.bg);
      swatchName.textContent = b.getAttribute("aria-label");
    });
  });

  /* ================= Start ================= */
  root.dataset.themePref = themePref();
  lang = resolveLang(langPref);
  applyLang();
  syncThemeControls();
  // Schrift nachgeladen: Knopfbreiten aendern sich, Markierung neu setzen
  if (document.fonts) document.fonts.ready.then(placeIndicators);
  loadRelease();
})();
