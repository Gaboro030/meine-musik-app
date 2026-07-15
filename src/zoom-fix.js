/* Pinch-Zoom soll erlaubt bleiben, aber Android-WebViews legen Prozent-
   breiten (100%/100vw) beim Reinzoomen/Rauszoomen auf den unveränderten
   LAYOUT-Viewport fest statt auf den tatsächlich sichtbaren VISUAL-
   Viewport - beim Rauszoomen wird dadurch rechts (bzw. unten) ein Streifen
   des reinen Hintergrunds sichtbar, den kein Element mehr abdeckt. Fix:
   die echte, gerade sichtbare Breite/Höhe per visualViewport-API in zwei
   CSS-Variablen spiegeln, die styles.css statt fixer 100%-Werte für
   html/body/.app-shell benutzt - das hält den Zoom nutzbar UND den Inhalt
   passend zur aktuellen Zoomstufe. */
(function () {
  "use strict";
  const root = document.documentElement;

  function sync() {
    const vv = window.visualViewport;
    const w = vv ? vv.width : window.innerWidth;
    const h = vv ? vv.height : window.innerHeight;
    root.style.setProperty("--vvw", `${w}px`);
    root.style.setProperty("--vvh", `${h}px`);
  }

  sync();
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", sync);
    window.visualViewport.addEventListener("scroll", sync);
  }
  window.addEventListener("resize", sync);
  window.addEventListener("orientationchange", sync);
})();
