// Tauri/cargo always write build output under src-tauri/target/.../bundle/
// - there is no config option to redirect that. This script runs after
// `tauri build` and copies the final installers/packages into dist-app/,
// which is the single folder the app is supposed to hand you at the end.
import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distApp = join(root, "dist-app");
mkdirSync(distApp, { recursive: true });

// Both the Windows and Linux CI jobs call this script identically via
// `npm run build` (no arg) - so the file-prefix can't be a fixed "desktop"
// literal, or Windows and Linux artifacts collide/mismatch the CI upload
// step's per-OS "dist-app/windows-*" / "dist-app/ubuntu-*" path filter.
// Deriving it from process.platform makes each runner tag its own output
// correctly without the workflow having to pass anything in. "ubuntu" (not
// generic "linux") because the bundle only produces a .deb now - a real
// Ubuntu/Debian package, not a distro-agnostic AppImage anymore.
const platformPrefix = { win32: "windows", linux: "ubuntu", darwin: "macos" }[process.platform] || "desktop";
const mode = process.argv[2] === "android" ? "android" : platformPrefix;

function walk(dir, exts) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p, exts));
    else if (exts.some((e) => name.toLowerCase().endsWith(e))) out.push(p);
  }
  return out;
}

let files = [];
if (mode === "android") {
  // .apk only - the user installs this by tapping it directly on their
  // phone. An .aab (Android App Bundle) can't be sideloaded at all, it
  // only exists for Play Store uploads, so it's deliberately excluded here
  // (and "npm run build:android" now passes --apk to skip building one).
  files = walk(join(root, "src-tauri", "gen", "android", "app", "build", "outputs"), [".apk"]);
} else {
  files = walk(join(root, "src-tauri", "target", "release", "bundle"), [
    ".exe",
    ".msi",
    ".deb",
    ".appimage",
    ".rpm",
  ]);
}

if (!files.length) {
  console.warn(`No build artifacts found for mode="${mode}" - did the build actually succeed?`);
}
for (const f of files) {
  // One universal (non-split-per-abi) debug-signed APK is expected in
  // android mode - give it a clean, predictable name instead of Gradle's
  // "app-universal-debug.apk" so it's obvious which file to install.
  const name = mode === "android" && files.length === 1 ? "MeineMusik.apk" : f.split(/[\\/]/).pop();
  const dest = join(distApp, `${mode}-${name}`);
  copyFileSync(f, dest);
  console.log(`-> dist-app/${dest.split(/[\\/]/).pop()}`);
}
