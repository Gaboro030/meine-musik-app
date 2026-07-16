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
    // visualViewport can (rarely, but reproducibly - caught this in
    // testing) report 0 for a moment right around load/resize before
    // layout has settled. Committing that 0 into --vvw/--vvh collapses
    // html/body/.app-shell to width:0 - the ENTIRE app goes blank, far
    // worse than the zoom bug this file exists to fix. Only ever write a
    // real, positive reading; a bad one just leaves the last good value
    // (or the CSS fallback of 100%/100vh) in place instead.
    if (w > 0) root.style.setProperty("--vvw", `${w}px`);
    if (h > 0) root.style.setProperty("--vvh", `${h}px`);
  }

  sync();
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", sync);
    window.visualViewport.addEventListener("scroll", sync);
  }
  window.addEventListener("resize", sync);
  window.addEventListener("orientationchange", sync);

  // Der allererste sync() oben lief bevor die Android-WebView ihr Layout
  // fertig vermessen hat (Statusleiste/Geste-Leiste/Sicherheitsabstaende
  // sind da teils noch nicht final) - das Ergebnis ist positiv, aber zu
  // klein, und bleibt so stehen, bis der Nutzer zufaellig scrollt oder
  // zoomt (das feuert erst ein echtes resize/scroll-Event). Genau das war
  // der gemeldete Bug: oben/normal gezoomt fehlten die Player-Bar-Controls,
  // erst "ganz runter und wieder ein bisschen hoch scrollen" holte sie
  // zurueck. Fix: mehrfach nachsyncen, bis das Layout sicher fertig ist -
  // ohne dass der Nutzer je scrollen oder zoomen muss.
  window.addEventListener("load", sync);
  for (const delay of [50, 150, 300, 600, 1200, 2000]) {
    setTimeout(sync, delay);
  }
})();
