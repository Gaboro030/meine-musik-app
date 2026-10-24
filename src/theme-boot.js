/* Laeuft im <head>, VOR dem ersten Bild: setzt die helle Fassung des
   Reson-Themes, falls sie gilt - sonst blitzte bei hellem Modus beim
   Start kurz das dunkle Design auf, bis themes.js geladen ist. */
(function () {
  try {
    var theme = localStorage.getItem("meineMusikTheme") || "reson";
    if (theme === "spotify-green" && !localStorage.getItem("themeResonMigrated")) theme = "reson";
    var mode = localStorage.getItem("themeMode") || "system";
    var dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    if (theme === "reson" && !dark) document.documentElement.dataset.scheme = "light";
  } catch (e) { /* ohne Speicher: dunkler Standard */ }
})();
