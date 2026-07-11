/* Android-only bootstrap: kicks off PoToken generation (potoken.js) as
   soon as the page loads, in the background, so it's ready by the time
   the user actually tries to search/download something. Desktop's
   yt-dlp path doesn't need any of this. Module script (ES import), loaded
   separately from tauri-shim.js/player.js which aren't modules. */
if (/android/i.test(navigator.userAgent)) {
  import("./potoken.js").then((m) => {
    const invoke = window.__TAURI__.core.invoke;
    m.initPoToken(invoke).then((ok) => {
      if (!ok) console.warn("PoToken-Generierung nach mehreren Versuchen fehlgeschlagen - Downloads großer/geschützter Videos könnten weiter fehlschlagen.");
    });
  });
}
