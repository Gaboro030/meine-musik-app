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
const gradlePath = join(androidRoot, "app", "build.gradle.kts");

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

// PlaybackService.kt uses MediaSessionCompat/MediaStyle from the
// androidx.media artifact (which, confusingly, still publishes under the
// android.support.v4.media package for compat reasons) - Tauri's generated
// build.gradle.kts doesn't include it by default, so the Kotlin compile
// fails with "Unresolved reference" until this dependency is added.
let gradle = readFileSync(gradlePath, "utf8");
const mediaDep = 'implementation("androidx.media:media:1.7.0")';
if (!gradle.includes(mediaDep)) {
  gradle = gradle.replace(/(dependencies\s*\{)/, `$1\n    ${mediaDep}`);
  writeFileSync(gradlePath, gradle);
  console.log("-> added androidx.media dependency to build.gradle.kts");
} else {
  console.log("-> androidx.media dependency already present");
}
