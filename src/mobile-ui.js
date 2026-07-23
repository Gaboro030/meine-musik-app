/* ===== Mobile: hide bottom UI while scrolling down, bring it back on
   scroll up =====
   On the phone layout (MOBILE LAYOUT 2.0 in styles.css) the action dock,
   round "add music" button and player bar are all fixed at the bottom of
   the screen at once - a lot of a small screen permanently spent on
   controls. This hides them while the user is actively scrolling down
   through a list and brings them right back on scroll-up or at the top/
   bottom of the page. Desktop is untouched - the CSS class this toggles
   only has an effect inside the max-width:900px media query.

   Rewritten to not depend on a single scroll source: some WebViews don't
   fire (or heavily throttle) `scroll` events on the actual scrolling
   element during inertial touch scrolling, which made the previous
   version silently do nothing on a real device. This tracks touch
   movement directly (immune to that - it doesn't need the browser to ever
   fire a scroll event) and ALSO listens to both window- and container-
   level `scroll` as a fallback for non-touch input. */
(function () {
  "use strict";
  const scroller = document.querySelector(".content-scroll");
  if (!scroller) return;

  const mq = window.matchMedia("(max-width: 900px)");
  // Nur echte Touch-Geraete duerfen die Bar per Scroll auto-ausblenden -
  // ein Desktop-Fenster im Vollbild auf einem Hochkant-2.-Monitor faellt
  // CSS-Breiten-technisch auch unter 900px, wird aber mit der Maus bedient.
  // Ohne diese Sperre versteckte sich die Player-Bar (samt Songtext-Button)
  // dort beim normalen Mausrad-Scrollen genauso wie auf dem Handy und blieb
  // unklickbar stehen ("Songtext auf 2. Monitor im Vollbild blockiert").
  const pointerMq = window.matchMedia("(pointer: coarse)");

  // Touchmove wird global auf `document` beobachtet (siehe unten) - ohne
  // diese Sperre zaehlte Scrollen INNERHALB eines offenen Vollbild-Overlays
  // (Songtext/Video/Visualizer/Warteschlange/Settings) genauso wie Scrollen
  // in der Track-Liste und blendete die Player-Bar aus. Bei Songtext heisst
  // das: die Bar verschwand ausgerechnet in der Luecke, die .lyrics-overlay
  // extra fuer sie freilaesst ("die Bar soll doch unten sein").
  const OVERLAY_SELECTOR =
    ".lyrics-overlay:not(.hidden), .visualizer-overlay:not(.hidden), " +
    ".video-overlay:not(.hidden), .modal-overlay:not(.hidden), .queue-panel:not(.hidden)";
  function anyOverlayOpen() {
    return !!document.querySelector(OVERLAY_SELECTOR);
  }

  function setHidden(hidden) {
    if (anyOverlayOpen()) hidden = false;
    document.body.classList.toggle("mobile-bars-hidden", mq.matches && hidden);
  }

  function docScrollTop() {
    const doc = document.scrollingElement || document.documentElement;
    return doc ? doc.scrollTop : 0;
  }

  function nearTop() {
    return docScrollTop() < 24 && scroller.scrollTop < 24;
  }

  function nearBottom() {
    const doc = document.scrollingElement || document.documentElement;
    const docAtBottom = !doc || doc.scrollTop + doc.clientHeight >= doc.scrollHeight - 4;
    const innerAtBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
    return docAtBottom && innerAtBottom;
  }

  let lastTop = docScrollTop() + scroller.scrollTop;
  let ticking = false;

  function evaluate() {
    ticking = false;
    if (!mq.matches || !pointerMq.matches) return;
    const top = docScrollTop() + scroller.scrollTop;
    if (nearTop() || nearBottom()) {
      setHidden(false);
      lastTop = top;
    } else {
      const delta = top - lastTop;
      if (delta > 6) setHidden(true);
      else if (delta < -6) setHidden(false);
      lastTop = top;
    }
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(evaluate);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  scroller.addEventListener("scroll", onScroll, { passive: true });

  // Direct touch tracking - reacts immediately and never depends on
  // whether a `scroll` event actually fires for this gesture. Measures
  // CUMULATIVE movement from a baseline instead of the per-touchmove-event
  // delta: touchmove fires very often (60-120x/s), so a slow/gentle scroll
  // - completely normal when reading through the middle of a list instead
  // of flicking fast - moves only 1-3px per single event, which never
  // crossed the old per-event threshold. That's why "es kommt nur ganz
  // selten" only showed up away from the very top/bottom (where nearTop/
  // nearBottom bypassed the threshold entirely and always worked). The
  // baseline only resets once a direction actually triggers, so any
  // continued movement keeps accumulating until it does.
  let baselineY = null;
  document.addEventListener(
    "touchstart",
    (e) => {
      baselineY = e.touches[0].clientY;
    },
    { passive: true }
  );
  document.addEventListener(
    "touchmove",
    (e) => {
      if (baselineY === null || !mq.matches) return;
      const y = e.touches[0].clientY;
      const dy = baselineY - y; // positive = finger moved up = content scrolling down
      if (nearTop() || nearBottom()) {
        setHidden(false);
        baselineY = y;
      } else if (dy > 8) {
        setHidden(true);
        baselineY = y;
      } else if (dy < -8) {
        setHidden(false);
        baselineY = y;
      }
    },
    { passive: true }
  );
  document.addEventListener("touchend", () => {
    baselineY = null;
  });

  // Neue Playlist/Ansicht geoeffnet (Track-Liste im Scroll-Container wird
  // ersetzt) - Bar muss sofort da sein, nicht erst nach der ersten Beruehrung
  // ("das soll auch am Anfang direkt erstmal da sein"). Ohne das blieb sie
  // faelschlich versteckt, wenn man sie vorher in einer ANDEREN Playlist
  // durch Runterscrollen ausgeblendet hatte und dann eine neue oeffnet, ohne
  // gleich zu scrollen.
  const contentObserver = new MutationObserver(() => setHidden(false));
  contentObserver.observe(scroller, { childList: true, subtree: false });

  setHidden(false);
  mq.addEventListener("change", () => setHidden(false));

  // ===== Wischen auf der Player-Bar = vor/zurück =====
  // Bewusst nur auf .player-bar-left (Cover+Titel) statt der ganzen Bar:
  // dort liegt kein anderes Drag-Gesture (Scrubber/Lautstärke sind
  // eigene, weiter rechts liegende Elemente) - eine grosse, klare
  // horizontale Bewegung dort kann also gefahrlos als "skip" gedeutet
  // werden, ohne mit Tipp-auf-Buttons oder Scrubber-Ziehen zu kollidieren.
  const swipeZone = document.querySelector(".player-bar-left");
  if (swipeZone) {
    let swipeStartX = null;
    let swipeStartY = null;
    swipeZone.addEventListener(
      "touchstart",
      (e) => {
        if (!mq.matches) return;
        swipeStartX = e.touches[0].clientX;
        swipeStartY = e.touches[0].clientY;
      },
      { passive: true }
    );
    swipeZone.addEventListener(
      "touchend",
      (e) => {
        if (swipeStartX === null || !mq.matches) return;
        const dx = e.changedTouches[0].clientX - swipeStartX;
        const dy = e.changedTouches[0].clientY - swipeStartY;
        swipeStartX = null;
        // Deutlich mehr horizontal als vertikal, sonst war es Scrollen/ein
        // schräger Tipp, kein Skip-Wisch.
        if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6) {
          if (dx < 0 && typeof nextTrack === "function") nextTrack();
          else if (dx > 0 && typeof prevTrack === "function") prevTrack();
        }
      },
      { passive: true }
    );
  }

  // ===== Pull-to-Refresh in der Bibliothek =====
  // Nur wenn bereits ganz oben gescrollt ist (nearTop) UND weiter nach
  // unten gezogen wird, zaehlt es als Pull-Geste statt als normales
  // Scrollen - sonst wuerde jeder Scroll-Start versehentlich mit
  // auslösen.
  const pullIndicator = document.createElement("div");
  pullIndicator.className = "pull-refresh-indicator";
  pullIndicator.textContent = t("↓ Loslassen zum Aktualisieren");
  document.body.appendChild(pullIndicator);

  let pullStartY = null;
  let pulling = false;
  const PULL_THRESHOLD = 70;

  document.addEventListener(
    "touchstart",
    (e) => {
      if (!mq.matches) return;
      pullStartY = nearTop() ? e.touches[0].clientY : null;
      pulling = false;
    },
    { passive: true }
  );
  document.addEventListener(
    "touchmove",
    (e) => {
      if (pullStartY === null || !mq.matches) return;
      const dy = e.touches[0].clientY - pullStartY;
      if (dy > 10 && nearTop()) {
        pulling = true;
        const pct = Math.min(dy / PULL_THRESHOLD, 1);
        pullIndicator.style.opacity = String(pct);
        pullIndicator.style.transform = `translateX(-50%) translateY(${Math.min(dy * 0.4, 40)}px)`;
        pullIndicator.classList.toggle("ready", dy > PULL_THRESHOLD);
      } else if (dy <= 0) {
        pulling = false;
        pullIndicator.style.opacity = "0";
      }
    },
    { passive: true }
  );
  document.addEventListener("touchend", (e) => {
    if (pulling) {
      const dy = (e.changedTouches[0].clientY || 0) - (pullStartY || 0);
      if (dy > PULL_THRESHOLD && typeof refreshLibrary === "function") {
        pullIndicator.textContent = t("⟳ Wird aktualisiert …");
        Promise.resolve(refreshLibrary()).finally(() => {
          pullIndicator.style.opacity = "0";
          pullIndicator.textContent = t("↓ Loslassen zum Aktualisieren");
        });
      } else {
        pullIndicator.style.opacity = "0";
      }
    }
    pulling = false;
    pullStartY = null;
  });
})();
