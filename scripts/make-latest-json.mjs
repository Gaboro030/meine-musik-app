// Baut latest.json fuer tauri-plugin-updater aus den signierten
// Desktop-Installern eines Releases (CI, build.yml -> Job "release").
// Aufruf: node scripts/make-latest-json.mjs <ordner> <tag> [notes-datei]
// Die App holt die Datei ueber
// https://github.com/<repo>/releases/latest/download/latest.json
// und prueft jede Signatur gegen den pubkey in tauri.conf.json.
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const [, , dir, tag, notesFile] = process.argv;
const repo = process.env.GITHUB_REPOSITORY || "Gaboro030/meine-musik-app";
const files = readdirSync(dir);

// Plattform-Schluessel wie ihn der Updater erwartet -> Installer-Datei.
const targets = {
  "windows-x86_64": (f) => f.startsWith("windows-") && f.endsWith("-setup.exe"),
  "linux-x86_64": (f) => f.startsWith("ubuntu-") && f.endsWith(".AppImage"),
};

const platforms = {};
for (const [platform, match] of Object.entries(targets)) {
  const installer = files.find(match);
  if (!installer || !files.includes(`${installer}.sig`)) {
    throw new Error(`${platform}: Installer oder .sig fehlt in ${dir}`);
  }
  platforms[platform] = {
    signature: readFileSync(join(dir, `${installer}.sig`), "utf8").trim(),
    url: `https://github.com/${repo}/releases/download/${tag}/${installer}`,
  };
}

const latest = {
  version: tag.replace(/^v/, ""),
  notes: notesFile && existsSync(notesFile) ? readFileSync(notesFile, "utf8").trim() : "",
  pub_date: new Date().toISOString(),
  platforms,
};
writeFileSync(join(dir, "latest.json"), JSON.stringify(latest, null, 2));
console.log(JSON.stringify(latest, null, 2));
