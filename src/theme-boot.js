/* Laeuft im <head>, VOR dem ersten Bild: setzt die helle Fassung des
   Reson-Themes, falls sie gilt - sonst blitzte bei hellem Modus beim
   Start kurz das dunkle Design auf, bis themes.js geladen ist. */
(function () {
  // Linux-Desktop (WebKitGTK) markieren: dort sind Weichzeichner hinter
  // Ebenen (backdrop-filter) so teuer, dass die ganze App ruckelt.
  if (/Linux/.test(navigator.userAgent) && !/Android/i.test(navigator.userAgent)) {
    document.documentElement.classList.add("os-linux");
  }
  if (/Android/i.test(navigator.userAgent)) document.documentElement.classList.add("os-android");
  try {
    var theme = localStorage.getItem("meineMusikTheme") || "reson";
    if (theme === "spotify-green" && !localStorage.getItem("themeResonMigrated")) theme = "reson";
    var mode = localStorage.getItem("themeMode") || "system";
    var dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    if (theme === "reson" && !dark) document.documentElement.dataset.scheme = "light";
    // Gewaehlte UI-Farbe schon vor dem ersten Bild (themes.js verfeinert
    // Hover-/Schriftfarbe danach) - sonst blitzt kurz der Theme-Akzent auf.
    var accent = localStorage.getItem("uiAccentColor");
    if (/^#[0-9a-f]{6}$/i.test(accent || "")) {
      document.documentElement.style.setProperty("--sp-green", accent);
      document.documentElement.style.setProperty("--sp-green-hover", accent);
      // Gleiche WCAG-Helligkeit wie luminance() in themes.js
      var lum = [1, 3, 5].map(function (i) {
        var c = parseInt(accent.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      var light = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2] > 0.35;
      document.documentElement.style.setProperty("--sp-on-accent", light ? "#111111" : "#ffffff");
    }
  } catch (e) { /* ohne Speicher: dunkler Standard */ }
})();
