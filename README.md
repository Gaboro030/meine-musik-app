# Meine Musik — Tauri v2 rewrite

Status: Windows + Linux builds are green in CI (GitHub Actions). Android
builds too, but see the gaps below - background playback control isn't
wired up yet. Verified via `.github/workflows/build.yml`, not locally
(this dev machine has no Rust toolchain installed).

## What's here
- `src-tauri/` — Rust core: `commands.rs` (playlist CRUD, real ID3 tag/cover
  reading via the `id3` crate, path-traversal-safe streaming, SSRF-checked
  thumbnail fetch, yt-dlp sidecar download), `lib.rs`/`main.rs` (window
  setup, `stream://` protocol registration - the library has no separate
  JSON index, `music_root/<playlist>/*.mp3` on disk IS the library, same
  model the old Flask `scan_library()` used).
- `src/` — full 1:1 visual port of the Flask player's UI (`styles.css` is
  the same Spotify-style CSS incl. all 13 color themes, `index.html`/
  `app.js` are a trimmed port - same playback engine, shuffle, equalizer,
  soft crossfade, drag-and-drop playlist import, add-to-playlist menu,
  configurable hotkeys, Dynamic Glow, settings modal).
- `android-extra/` — `PlaybackService.kt` + manifest additions for Android
  background/lockscreen playback. Not merged into `gen/android` yet because
  that folder only exists after `tauri android init` runs.
- `scripts/collect-dist.mjs` — copies build output into `dist-app/`
  (Tauri/cargo always write to `src-tauri/target/.../bundle/` or
  `gen/android/.../outputs/`; there's no config to redirect that directly).

## To actually build this, in order
1. Install Rust: https://rustup.rs
2. `npm install` in this folder.
3. `cargo install tauri-cli --version "^2"` (or use `npm run tauri` once
   `@tauri-apps/cli` is installed via npm — either works).
4. Generate real app icons: `npx tauri icon path/to/source-1024.png`
   (writes into `src-tauri/icons/`, referenced by `tauri.conf.json`).
5. **yt-dlp sidecar**: download the `yt-dlp` binary for each target platform,
   name it per Tauri's sidecar convention (`yt-dlp-x86_64-pc-windows-msvc.exe`,
   `yt-dlp-x86_64-unknown-linux-gnu`, ...) into `src-tauri/binaries/`, and add
   `"externalBin": ["binaries/yt-dlp"]` to `tauri.conf.json`'s `bundle`
   section. `download_track` in `commands.rs` calls it via
   `tauri-plugin-shell`'s sidecar API.
6. `npm run dev` — desktop dev build, opens a native window.
7. `npm run build` — Windows/Linux release build, then copies installers
   into `dist-app/`.
8. Android: `npm run android:init` (needs Android SDK + NDK installed and
   `ANDROID_HOME`/`NDK_HOME` set), then copy `android-extra/PlaybackService.kt`
   into the generated `gen/android/app/src/main/java/com/meinemusik/app/`,
   merge `AndroidManifest.additions.xml` into the generated manifest, then
   `npm run build:android` - produces exactly one file, `dist-app/android-MeineMusik.apk`,
   debug-keystore-signed so it installs straight from the phone by tapping
   it (no `.aab`, no Play Store detour, no separate signing step needed).

## Party mode (ported)
Party mode/LAN sync + QR guest page now live in `party.rs`: an embedded
axum server on port 8765 (falls back to a random free port) serves the
`/guest` page, `/api/party/state`, `/api/queue`, `/stream/...` and an SSE
`/api/events` bus to every device on the same WiFi. The host app talks to
the same shared Hub through Tauri commands (`party_info`, `party_set_state`,
`queue_list`, ...) and receives guest events over Tauri's event bus
(`party-queue_update`, `party-party_sync`) via the fake EventSource in
`tauri-shim.js`. First launch on Windows triggers a firewall prompt -
"Allow" is required for guests to connect.

## Known gaps vs. the old Flask app (not yet ported)
- Discover/recommendations, search-online, and lyrics are now implemented
  in Rust (`discovery.rs`, `lyrics.rs`) - but discovery uses yt-dlp's own
  `ytsearchN:` search instead of ytmusicapi (no Rust equivalent exists),
  so result quality/ranking won't be identical to the old YT-Music-backed
  version. Trash/recycle-bin is implemented (`trash.rs`) - deleting a track
  moves it to a trash folder + JSON index, restorable from the Papierkorb
  view, same as before.
- No home-screen "Mehr von <Artist>" per-artist rows (just the one generic
  "Andere Songs entdecken" shelf) - straightforward to add on top of
  `discover_tracks`, just trimmed for scope in this pass.
- Track duration shows "—" always - `id3` only reads tags, not audio frame
  structure, so getting exact duration needs an MP3-decoding crate
  (`symphonia` or similar), not done yet.
- `upload_track` sends file bytes as a JSON number array over the Tauri IPC
  bridge - correct but not the fastest way to move large files; fine for
  a personal library, would want a real binary transfer for very large
  bulk imports.
- **YouTube downloads are desktop-only.** yt-dlp doesn't publish official
  Android/ARM binaries, so there's no real sidecar to bundle for Android -
  `download_track` will fail there until a proper on-device downloader
  exists (either a statically-linked ARM yt-dlp build you compile yourself,
  or reimplementing extraction natively). `tauri.android.conf.json` clears
  `bundle.externalBin` for the Android build so it doesn't fail looking for
  sidecar files that were never going to work anyway. Streaming/playing
  already-downloaded tracks is unaffected - only fetching *new* ones from
  YouTube is desktop-only for now.
