// Runs after `tauri android init` (which generates src-tauri/gen/android/
// from scratch every time) and before the actual build - copies in the
// PlaybackService.kt foreground-service/MediaSession code and patches the
// generated AndroidManifest.xml with the permissions + <service> entry it
// needs. Idempotent: safe to run multiple times.
import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const androidRoot = join(root, "src-tauri", "gen", "android");
const pkgDir = join(androidRoot, "app", "src", "main", "java", "com", "meinemusik", "app");
const manifestPath = join(androidRoot, "app", "src", "main", "AndroidManifest.xml");

if (!existsSync(androidRoot)) {
  console.error("gen/android not found - run `tauri android init` first.");
  process.exit(1);
}

mkdirSync(pkgDir, { recursive: true });
copyFileSync(join(root, "android-extra", "PlaybackService.kt"), join(pkgDir, "PlaybackService.kt"));
console.log("-> copied PlaybackService.kt");

let manifest = readFileSync(manifestPath, "utf8");

const permissions = [
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />',
  '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
  '<uses-permission android:name="android.permission.WAKE_LOCK" />',
];
for (const perm of permissions) {
  if (!manifest.includes(perm)) {
    manifest = manifest.replace(/(<manifest[^>]*>)/, `$1\n    ${perm}`);
  }
}

const serviceTag =
  '<service android:name=".PlaybackService" android:foregroundServiceType="mediaPlayback" android:exported="false" />';
if (!manifest.includes('android:name=".PlaybackService"')) {
  manifest = manifest.replace(/(<\/application>)/, `    ${serviceTag}\n$1`);
}

writeFileSync(manifestPath, manifest);
console.log("-> patched AndroidManifest.xml");
