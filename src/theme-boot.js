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
  } catch (e) { /* ohne Speicher: dunkler Standard */ }
})();
