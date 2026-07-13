/* ===== Mobile: hide bottom UI while scrolling down, bring it back on
   scroll up =====
   On the phone layout (MOBILE LAYOUT 2.0 in styles.css) the tool bar,
   round "add music" button and player bar are all fixed at the bottom of
   the screen at once - a lot of a small screen permanently spent on
   controls. Scrolling through a long playlist felt cramped with all three
   always in the way; this hides them while the user is actively scrolling
   down through a list and brings them right back the moment they scroll
   up again (or reach the top) since that's exactly when skip/pause is
   needed. Desktop is untouched - the CSS class this toggles only has an
   effect inside the max-width:900px media query. */
(function () {
  "use strict";
  const scroller = document.querySelector(".content-scroll");
  if (!scroller) return;

  const mq = window.matchMedia("(max-width: 900px)");
  let lastTop = 0;
  let ticking = false;

  function apply() {
    ticking = false;
    if (!mq.matches) {
      document.body.classList.remove("mobile-bars-hidden");
      lastTop = scroller.scrollTop;
      return;
    }
    const top = scroller.scrollTop;
    const delta = top - lastTop;
    if (top < 24) {
      document.body.classList.remove("mobile-bars-hidden");
    } else if (delta > 6) {
      document.body.classList.add("mobile-bars-hidden");
    } else if (delta < -6) {
      document.body.classList.remove("mobile-bars-hidden");
    }
    lastTop = top;
  }

  scroller.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    },
    { passive: true }
  );

  mq.addEventListener("change", () => document.body.classList.remove("mobile-bars-hidden"));
})();
