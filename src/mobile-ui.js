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

  function setHidden(hidden) {
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
    if (!mq.matches) return;
    if (nearTop() || nearBottom()) {
      setHidden(false);
    } else {
      const top = docScrollTop() + scroller.scrollTop;
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
  // whether a `scroll` event actually fires for this gesture.
  let touchY = null;
  document.addEventListener(
    "touchstart",
    (e) => {
      touchY = e.touches[0].clientY;
    },
    { passive: true }
  );
  document.addEventListener(
    "touchmove",
    (e) => {
      if (touchY === null || !mq.matches) return;
      const y = e.touches[0].clientY;
      const dy = touchY - y; // positive = finger moved up = content scrolling down
      touchY = y;
      if (nearTop() || nearBottom()) {
        setHidden(false);
      } else if (dy > 4) {
        setHidden(true);
      } else if (dy < -4) {
        setHidden(false);
      }
    },
    { passive: true }
  );
  document.addEventListener("touchend", () => {
    touchY = null;
  });

  mq.addEventListener("change", () => setHidden(false));
})();
