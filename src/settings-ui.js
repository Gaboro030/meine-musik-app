/* ===== Einstellungen: Kategorien, Suche, abhaengige Optionen =====
   Die Einstellungen waren eine einzige lange Liste. Jetzt: links (Handy:
   oben) Kategorien, rechts nur deren Optionen. Die Suche oben findet jede
   Option ueber alle Kategorien. Optionen, die nur mit einem anderen
   Schalter Sinn ergeben (Crossfade-Dauer, Discord-ID, Sprachchat-Geraete),
   klappen erst auf, wenn dieser Schalter an ist. Lange Erklaerungen sind
   auf zwei Zeilen gekuerzt und klappen per Klick auf.

   Reine Anordnung: alle Schalter und Felder behalten ihre IDs, die
   eigentliche Logik bleibt in player.js, sprachchat.js usw. */
(function () {
  "use strict";
  const modal = document.getElementById("settingsModal");
  const nav = document.getElementById("settingsNav");
  const panes = document.getElementById("settingsPanes");
  const search = document.getElementById("settingsSearch");
  const noMatch = document.getElementById("settingsNoMatch");
  if (!modal || !nav || !panes) return;

  const CAT_KEY = "settingsCategory";
  const tabs = [...nav.querySelectorAll("[data-cat]")];
  const sections = [...panes.querySelectorAll(".settings-section[data-cat]")];
  const ind = nav.querySelector(".settings-nav-ind");
  const visible = (el) => !!el.offsetParent || getComputedStyle(el).display !== "none";

  /* ---------- Kategorien ---------- */
  function placeIndicator() {
    const on = nav.querySelector('[aria-selected="true"]');
    if (!on || !ind || !on.offsetWidth) return;
    const horizontal = getComputedStyle(nav).flexDirection === "row";
    ind.style.width = (horizontal ? on.offsetWidth : nav.clientWidth - 12) + "px";
    ind.style.height = on.offsetHeight + "px";
    ind.style.transform = `translate(${horizontal ? on.offsetLeft : 6}px, ${on.offsetTop}px)`;
  }
  function showCat(cat, focusTab) {
    let tab = tabs.find((t) => t.dataset.cat === cat && visible(t)) || tabs.find(visible);
    if (!tab) return;
    cat = tab.dataset.cat;
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
    sections.forEach((s) => s.classList.toggle("is-active", s.dataset.cat === cat));
    try { localStorage.setItem(CAT_KEY, cat); } catch (_) { /* egal */ }
    panes.scrollTop = 0;
    placeIndicator();
    // Auf dem Handy den aktiven Chip ins Bild holen
    tab.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (focusTab) tab.focus();
  }
  nav.addEventListener("click", (e) => {
    const t = e.target.closest("[data-cat]");
    if (!t) return;
    if (search.value) clearSearch();
    showCat(t.dataset.cat);
  });
  nav.addEventListener("keydown", (e) => {
    const keys = ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const list = tabs.filter(visible);
    const i = list.indexOf(document.activeElement);
    let n = i;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") n = (i + 1) % list.length;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") n = (i - 1 + list.length) % list.length;
    if (e.key === "Home") n = 0;
    if (e.key === "End") n = list.length - 1;
    showCat(list[n].dataset.cat, true);
  });

  /* ---------- Suche ---------- */
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  function clearSearch() {
    search.value = "";
    applySearch();
  }
  function applySearch() {
    const q = norm(search.value.trim());
    panes.classList.toggle("is-searching", !!q);
    nav.classList.toggle("is-dimmed", !!q);
    let any = false;
    for (const sec of sections) {
      let secHit = false;
      const title = norm(sec.querySelector(".settings-section-title").textContent);
      for (const grp of sec.querySelectorAll(".settings-group")) {
        let grpHit = false;
        const gTitle = grp.querySelector(".settings-group-title");
        const groupMatches = !!q && (title.includes(q) || (gTitle && norm(gTitle.textContent).includes(q)));
        // Hotkeys: keine einzelnen Zeilen, die Liste zaehlt als Ganzes
        if (!grp.querySelector(".settings-row")) {
          grpHit = !q || groupMatches || norm(grp.textContent).includes(q);
        }
        for (const row of grp.querySelectorAll(".settings-row")) {
          const hit = !q || groupMatches || norm(row.textContent).includes(q);
          row.classList.toggle("search-hidden", !hit);
          const slider = row.nextElementSibling;
          if (slider && slider.classList.contains("settings-slider-row")) slider.classList.toggle("search-hidden", !hit);
          if (hit && row.textContent.trim()) grpHit = true;
        }
        grp.classList.toggle("search-hidden", !grpHit);
        if (grpHit) secHit = true;
      }
      sec.classList.toggle("search-hit", !!q && secHit);
      if (secHit) any = true;
    }
    noMatch.classList.toggle("hidden", !q || any);
    if (!q) showCat(currentCat());
  }
  function currentCat() {
    try { return localStorage.getItem(CAT_KEY) || "look"; } catch (_) { return "look"; }
  }
  search.addEventListener("input", applySearch);
  search.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && search.value) {
      e.stopPropagation();
      clearSearch();
    }
  });

  /* ---------- Abhaengige Optionen ---------- */
  for (const sub of panes.querySelectorAll(".settings-sub[data-depends]")) {
    const sw = document.getElementById(sub.dataset.depends);
    if (!sw) continue;
    const sync = () => {
      const on = sw.classList.contains("active") || sw.getAttribute("aria-checked") === "true";
      sub.classList.toggle("is-open", on);
      sub.inert = !on; // eingeklappte Felder nicht per Tab erreichbar
    };
    sync();
    new MutationObserver(sync).observe(sw, { attributes: true, attributeFilter: ["class", "aria-checked"] });
  }

  /* ---------- Leere Hinweiszeilen ausblenden ----------
     z.B. der Sprachchat-Hinweis: ohne Text und ohne sichtbaren Knopf
     waere das nur eine leere Luecke. */
  function syncEmptyRows() {
    for (const row of panes.querySelectorAll(".settings-row")) {
      if (row.querySelector(".settings-row-label")) continue;
      const hasText = [...row.querySelectorAll(".settings-row-desc")].some((d) => d.textContent.trim());
      const hasCtl = [...row.querySelectorAll("button, input, select")].some((c) => c.style.display !== "none");
      const empty = !hasText && !hasCtl;
      if (row.classList.contains("is-empty") !== empty) row.classList.toggle("is-empty", empty);
    }
  }
  syncEmptyRows();
  new MutationObserver(syncEmptyRows).observe(panes, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["style"] });

  /* ---------- Lange Erklaerungen einklappen ---------- */
  function setupDescs() {
    for (const d of panes.querySelectorAll(".settings-row-desc")) {
      if (d.id) continue; // Statuszeilen (Version, Anmeldung …) immer ganz zeigen
      const long = d.textContent.trim().length > 110;
      d.classList.toggle("is-clamped", long && !d.classList.contains("is-open"));
      if (long && !d.dataset.wired) {
        d.dataset.wired = "1";
        d.tabIndex = 0;
        d.setAttribute("role", "button");
        d.setAttribute("aria-expanded", "false");
        const toggle = () => {
          const open = !d.classList.contains("is-open");
          d.classList.toggle("is-open", open);
          d.classList.toggle("is-clamped", !open);
          d.setAttribute("aria-expanded", String(open));
        };
        d.addEventListener("click", toggle);
        d.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
        });
      }
    }
  }
  setupDescs();
  document.addEventListener("i18n-changed", () => {
    setupDescs();
    requestAnimationFrame(placeIndicator);
  });

  /* ---------- Oeffnen ---------- */
  new MutationObserver(() => {
    if (modal.classList.contains("hidden")) return;
    if (search.value) clearSearch();
    showCat(currentCat());
    requestAnimationFrame(placeIndicator);
  }).observe(modal, { attributes: true, attributeFilter: ["class"] });
  addEventListener("resize", placeIndicator);

  showCat(currentCat());
})();
