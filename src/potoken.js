/* ===== PoToken generation (Android download path) =====
   As of 2025 YouTube's Innertube /player endpoint increasingly refuses
   playback (LOGIN_REQUIRED "bot-check") without a valid PoToken - a
   cryptographic attestation that a real Google-approved JS environment
   (BotGuard) produced the request. Spoofing a mobile client's identity
   alone (what innertube.rs's client cascade does) stopped being enough
   for a growing share of content.

   The Tauri webview IS a real Chromium/WebView2/WKWebView JS+DOM engine,
   so - unlike a plain Rust process - this app can run Google's actual
   BotGuard attestation script itself, exactly like a real browser would,
   and hand the resulting token to Rust for its reqwest-based Innertube
   calls. bgutils.js (vendored from the bgutils-js npm package) is the
   orchestration; the attestation code itself is fetched fresh from
   Google every session in fetchChallenge() below and only ever eval'd,
   never stored.

   Runs once per app session (triggered from tauri-shim.js on Android
   only - desktop's yt-dlp path doesn't need any of this). */
import * as BG from './bgutils.js';

const REQUEST_KEY = 'O43z0dpjhgX20SCx4KAo'; // YouTube's public web requestKey (stable, not a secret - baked into youtube.com's own player bundle)
const SEARCH_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

/** Innertube hands back a visitorData/session id on virtually any call - a
 * throwaway search is the cheapest way to get a fresh one to attest against. */
async function fetchVisitorData() {
  const resp = await fetch(`https://www.youtube.com/youtubei/v1/search?key=${SEARCH_KEY}&prettyPrint=false`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      context: { client: { clientName: "WEB", clientVersion: "2.20240101.00.00", hl: "de", gl: "DE" } },
      query: "music",
    }),
  });
  const data = await resp.json();
  const visitorData = data?.responseContext?.visitorData;
  if (!visitorData) throw new Error("Keine visitorData von YouTube erhalten.");
  return visitorData;
}

/** Runs the full BotGuard challenge/attest/mint flow and returns a fresh
 * PoToken bound to `visitorData`. Takes a couple seconds (network + VM). */
export async function generatePoToken() {
  const visitorData = await fetchVisitorData();

  const bgConfig = {
    fetch: (input, init) => fetch(input, init),
    globalObj: window,
    identifier: visitorData,
    requestKey: REQUEST_KEY,
  };

  const challenge = await BG.Challenge.create(bgConfig);
  if (!challenge) throw new Error("Keine BotGuard-Challenge von Google erhalten.");

  const interpreterJavascript = challenge.interpreterJavascript.privateDoNotAccessOrElseSafeScriptWrappedValue;
  if (!interpreterJavascript) throw new Error("Kein Interpreter-Skript in der Challenge.");
  // This IS the actual Google/BotGuard attestation program - fetched fresh
  // just above, executed once, never persisted. Defines window[globalName].
  new Function(interpreterJavascript)();

  const result = await BG.PoToken.generate({
    program: challenge.program,
    globalName: challenge.globalName,
    bgConfig,
  });

  return { poToken: result.poToken, visitorData };
}

/** Generates a token and hands it to Rust; retries a few times since the
 * challenge/attestation round trip can transiently fail (network hiccup,
 * Google-side rate limiting). Safe to call multiple times - Rust just
 * keeps whatever the most recent successful token was. */
export async function initPoToken(invoke, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      const { poToken, visitorData } = await generatePoToken();
      await invoke("set_po_token", { poToken, visitorData });
      return true;
    } catch (err) {
      console.warn(`PoToken-Generierung fehlgeschlagen (Versuch ${i + 1}/${attempts}):`, err);
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return false;
}
