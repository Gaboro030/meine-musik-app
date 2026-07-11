/* Android-only bootstrap: kicks off PoToken generation (potoken.js) as
   soon as the page loads, in the background, so it's ready by the time
   the user actually tries to search/download something. Desktop's
   yt-dlp path doesn't need any of this. Module script (ES import), loaded
   separately from tauri-shim.js/player.js which aren't modules. */
// window.__poTokenReady: resolves once PoToken generation is done (or has
// given up) - request-firing code (tauri-shim.js, downloader.js) awaits
// this before its first Innertube-touching call so it doesn't race the
// BotGuard flow and fire the very first download/search without a token
// that would've been ready a second later. Desktop/no-Android: already
// resolved, so awaiting it elsewhere is a free no-op.
window.__poTokenReady = Promise.resolve(true);

if (/android/i.test(navigator.userAgent)) {
  window.__poTokenReady = import("./potoken.js")
    .then((m) => {
      const invoke = window.__TAURI__.core.invoke;
      return m.initPoToken(invoke);
    })
    .then((ok) => {
      if (!ok) console.warn("PoToken-Generierung nach mehreren Versuchen fehlgeschlagen - Downloads großer/geschützter Videos könnten weiter fehlschlagen.");
      return ok;
    })
    .catch((err) => {
      console.warn("PoToken-Init-Fehler:", err);
      return false;
    });
}
