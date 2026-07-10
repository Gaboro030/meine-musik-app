# Meine Musik — Tauri v2 rewrite (scaffold)

Status: scaffold written, **not built or tested** — this machine has no Rust
toolchain (`cargo`/`rustc` missing), so nothing here has compiled yet.

## What's here
- `src-tauri/` — Rust core: `commands.rs` (playlists, path-traversal-safe
  streaming, SSRF-checked thumbnail fetch, yt-dlp sidecar download),
  `main.rs` (window setup, `stream://` protocol registration).
- `src/` — frontend (`index.html`, `styles.css`, `app.js`): mobile-first
  CSS (44px+ touch targets, swipe-to-skip on the player bar), configurable
  hotkeys, Dynamic Glow, settings modal, add-to-playlist menu.
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
   `npm run build:android`.

## Known gaps vs. the old Flask app (not yet ported)
- No YouTube *search*/playlist-URL resolution in Rust yet — `download_track`
  only takes a raw video ID. Porting `ytmusicapi`'s search/matching logic
  needs its own pass (likely: shell out to `yt-dlp --dump-json` for search
  too, since there's no ytmusicapi equivalent in Rust).
- No lyrics, party-mode/LAN-sync, QR guest page, or trash/recycle-bin yet.
- Icons are not generated (build will fail on `tauri build` until step 4 is done).
