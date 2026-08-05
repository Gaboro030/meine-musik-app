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
const pkgDir = join(androidRoot, "app", "src", "main", "java", "com", "reson", "app");
const manifestPath = join(androidRoot, "app", "src", "main", "AndroidManifest.xml");
const gradlePath = join(androidRoot, "app", "build.gradle.kts");

if (!existsSync(androidRoot)) {
  console.error("gen/android not found - run `tauri android init` first.");
  process.exit(1);
}

mkdirSync(pkgDir, { recursive: true });
copyFileSync(join(root, "android-extra", "PlaybackService.kt"), join(pkgDir, "PlaybackService.kt"));
console.log("-> copied PlaybackService.kt");
copyFileSync(join(root, "android-extra", "NowPlayingPlugin.kt"), join(pkgDir, "NowPlayingPlugin.kt"));
console.log("-> copied NowPlayingPlugin.kt");

let manifest = readFileSync(manifestPath, "utf8");

const permissions = [
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />',
  '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
  '<uses-permission android:name="android.permission.WAKE_LOCK" />',
  // Geraete-Sync: ohne CHANGE_WIFI_MULTICAST_STATE laesst sich keine
  // MulticastLock anfordern, und ohne die verwirft Android eingehende
  // WLAN-Broadcasts - das Handy sieht den PC dann nie (NowPlayingPlugin.kt,
  // setNetzSperren).
  '<uses-permission android:name="android.permission.CHANGE_WIFI_MULTICAST_STATE" />',
  '<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />',
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
  console.log("-> added androidx.media dependency to build.gradle.kts");
} else {
  console.log("-> androidx.media dependency already present");
}

/* ===== R8/Minify im Release abschalten =====
   Der Debug-Build (bisher der einzige) laeuft mit isMinifyEnabled = false,
   der Release-Build mit true. R8 wirft dabei alles weg, was es fuer
   unerreichbar haelt - und erkennt Reflection nicht. Tauri laedt seine
   Kotlin-Plugins aber genau so: NowPlayingPlugin wird ueber seinen
   Klassennamen geladen und seine @Command-Methoden per Reflection
   aufgerufen. Die mitgelieferten Keep-Regeln (proguard-tauri.pro,
   proguard-wry.pro) decken nur Tauris eigene Klassen ab, nicht unsere.

   Das Tueckische: der Build bliebe gruen, der Fehler zeigte sich erst auf
   dem Handy als Absturz oder als tote Medien-Benachrichtigung. Der Gewinn
   waere dabei minimal - der Loewenanteil des APK sind die nativen
   Rust-Bibliotheken und die WebView-Assets, an die R8 gar nicht rangeht. */
const minifyAn = "isMinifyEnabled = true";
if (gradle.includes(minifyAn)) {
  gradle = gradle.replace(minifyAn, "isMinifyEnabled = false");
  console.log("-> R8/Minify im Release abgeschaltet");
} else {
  console.log("-> R8/Minify bereits aus");
}

/* ===== Signatur fuer den Play-Store =====
   Google Play nimmt nur Uploads an, die mit einem echten Schluessel
   signiert sind - die Debug-Signatur, mit der Gradle sonst baut, lehnt es
   ab. Das generierte Projekt weiss davon nichts, also wird der
   Signatur-Block hier nachtraeglich eingesetzt.

   Angeschaltet wird das allein durch die Anwesenheit von
   gen/android/keystore.properties (schreibt die CI aus den hinterlegten
   Geheimnissen, siehe build.yml). Fehlt die Datei - etwa in einer Kopie
   des Projekts ohne Schluessel -, bleibt alles wie vorher und der Build
   laeuft weiter durch, statt mit einem Fehler stehenzubleiben.

   Der Schluessel selbst gehoert NIE ins Projekt: weder die .jks-Datei
   noch die Passwoerter. Wer ihn verliert, kann die App bei Play nie
   wieder aktualisieren - deshalb liegt er beim Besitzer und in den
   GitHub-Geheimnissen, sonst nirgends. */
const keystorePropsPath = join(androidRoot, "keystore.properties");
if (existsSync(keystorePropsPath)) {
  if (!gradle.includes('signingConfigs.getByName("release")')) {
    // Importe muessen in einem Kotlin-Skript ganz oben stehen. Das
    // generierte Skript bringt Properties schon selbst mit - deshalb hier
    // nur nachlegen, wenn es fehlt, und sonst nichts anfassen. Gelesen wird
    // bewusst ueber propsFile.inputStream() statt FileInputStream: sonst
    // haengt der eingesetzte Block an einem zweiten Import, der bei
    // vorhandenem Properties-Import nie mitkaeme (genau daran ist der Build
    // gescheitert - "Unresolved reference: FileInputStream").
    if (!gradle.includes("import java.util.Properties")) {
      gradle = `import java.util.Properties\n\n${gradle}`;
    }

    const signingBlock = `
    signingConfigs {
        create("release") {
            val propsFile = rootProject.file("keystore.properties")
            if (propsFile.exists()) {
                val props = Properties()
                propsFile.inputStream().use { props.load(it) }
                // ?: error(...) statt "as String": fehlt ein Wert (leeres
                // GitHub-Geheimnis, vertippter Name), sagt Gradle sonst nur
                // "null cannot be cast to non-null type kotlin.String" und
                // man sucht im falschen Eck.
                keyAlias = props.getProperty("keyAlias")
                    ?: error("keystore.properties: keyAlias fehlt")
                keyPassword = props.getProperty("password")
                    ?: error("keystore.properties: password fehlt")
                // rootProject.file und NICHT file(): dieses Skript gehoert
                // zum app-Modul, file() wuerde also in gen/android/app/
                // suchen - die Schluesseldatei liegt aber eine Ebene
                // hoeher neben keystore.properties.
                storeFile = rootProject.file(
                    props.getProperty("storeFile")
                        ?: error("keystore.properties: storeFile fehlt")
                )
                storePassword = props.getProperty("storePassword")
                    ?: error("keystore.properties: storePassword fehlt")
            }
        }
    }
`;
    gradle = gradle.replace(/(android\s*\{)/, `$1\n${signingBlock}`);

    // Eine schon vorhandene Zuweisung im release-Block muss weg: in Kotlin
    // gewinnt die LETZTE, eine danebengesetzte Zeile waere also wirkungslos.
    gradle = gradle.replace(
      /(getByName\("release"\)\s*\{)([\s\S]*?)(\n\s*\})/,
      (_m, kopf, inhalt, ende) =>
        kopf +
        inhalt.replace(/\n\s*signingConfig\s*=.*/g, "") +
        '\n            signingConfig = signingConfigs.getByName("release")' +
        ende
    );
    console.log("-> Signatur-Konfiguration in build.gradle.kts eingesetzt");
  } else {
    console.log("-> Signatur-Konfiguration bereits vorhanden");
  }
} else {
  console.log("-> kein keystore.properties gefunden - Build bleibt unsigniert (Debug)");
}

writeFileSync(gradlePath, gradle);
