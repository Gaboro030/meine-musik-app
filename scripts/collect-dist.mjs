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
  // .apk zum direkten Antippen auf dem eigenen Handy, .aab fuer den
  // Play-Store-Upload (ein AAB laesst sich NICHT sideloaden, ein APK
  // nimmt Play bei neuen Apps nicht an - man braucht also beides, je
  // nachdem wohin es geht). Der Release-Build erzeugt beide; der
  // Debug-Build ohne Schluessel nur das APK.
  files = walk(join(root, "src-tauri", "gen", "android", "app", "build", "outputs"), [".apk", ".aab"]);
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
  // Gradle nennt seine Ergebnisse "app-universal-release.apk" bzw.
  // "app-release.aab" - daraus wird hier ein Name, dem man ansieht, was
  // er ist und wohin er gehoert. Pro Endung gibt es genau eine Datei
  // (ein universelles APK, ein Bundle), deshalb reicht die Endung als
  // Unterscheidung.
  const endung = f.slice(f.lastIndexOf(".")).toLowerCase();
  const name =
    mode === "android" && (endung === ".apk" || endung === ".aab")
      ? `Reson${endung}`
      : f.split(/[\\/]/).pop();
  const dest = join(distApp, `${mode}-${name}`);
  copyFileSync(f, dest);
  console.log(`-> dist-app/${dest.split(/[\\/]/).pop()}`);
}
