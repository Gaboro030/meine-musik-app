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

const mode = process.argv[2] === "android" ? "android" : "desktop";

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
  files = walk(
    join(root, "src-tauri", "gen", "android", "app", "build", "outputs"),
    [".apk", ".aab"]
  );
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
  const dest = join(distApp, `${mode}-${f.split(/[\\/]/).pop()}`);
  copyFileSync(f, dest);
  console.log(`-> dist-app/${dest.split(/[\\/]/).pop()}`);
}
