// Copy this into src-tauri/gen/android/app/src/main/java/com/reson/app/
// (merge-android-extras.mjs does this automatically after `tauri android
// init`). Rust<->Kotlin bridge for the PlaybackService foreground-service
// notification (see PlaybackService.kt) - updateNowPlaying/clearNowPlaying
// are called from nowplaying.rs whenever a track starts/changes/stops.
// Notification button taps arrive here via a broadcast from
// PlaybackService and get relayed to JS as a "media-control" event.
package com.reson.app

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.net.wifi.WifiManager
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.JSObject
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

@InvokeArg
class NowPlayingArgs {
    var title: String = ""
    var artist: String = ""
    var playing: Boolean = false
    /** Dateipfad des Covers, leer wenn keines existiert. */
    var cover: String = ""
    var positionMs: Long = 0
    var durationMs: Long = 0
}

@InvokeArg
class UpdateArgs {
    var url: String = ""
}

@InvokeArg
class NetzSperrenArgs {
    var an: Boolean = false
}

@TauriPlugin
class NowPlayingPlugin(private val activity: Activity) : Plugin(activity) {
    private var receiver: BroadcastReceiver? = null
    private var multicastLock: WifiManager.MulticastLock? = null
    private var wifiLock: WifiManager.WifiLock? = null

    /* ===== In-App-Update =====
       Das APK landet im App-Cache (keine Speicher-Berechtigung noetig, das
       System raeumt dort notfalls selbst auf) und wird NIE aufbewahrt:
       geloescht bei jedem Start (nach einem Update startet die App neu),
       vor jedem neuen Download und bei Fehlern.
       NICHT mehr loeschen, sobald die App wieder vorn ist: manche
       Hersteller-Installer (ColorOS, OxygenOS u.a.) bestehen aus mehreren
       Schritten und lassen die App dazwischen kurz nach vorn - die Datei
       war dann weg, bevor Android sie gelesen hatte, und es kam "Paket
       offenbar ungueltig". */
    private val updateDir get() = File(activity.cacheDir, "updates")

    private fun deleteInstallerFiles() {
        updateDir.deleteRecursively()
    }

    override fun load(webView: android.webkit.WebView) {
        super.load(webView)
        deleteInstallerFiles()
        val filter = IntentFilter(PlaybackService.ACTION_MEDIA_CONTROL)
        val r = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                val action = intent?.getStringExtra("control") ?: return
                val data = JSObject()
                data.put("action", action)
                // Beim Ziehen an der Leiste im System-Player steht das Ziel
                // in Millisekunden dabei.
                if (action == "seek") {
                    data.put("position", intent.getLongExtra("position", 0L))
                }
                trigger("media-control", data)
            }
        }
        receiver = r
        ContextCompat.registerReceiver(activity, r, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
    }

    @Command
    fun updateNowPlaying(invoke: Invoke) {
        val args = invoke.parseArgs(NowPlayingArgs::class.java)
        val intent = Intent(activity, PlaybackService::class.java)
        intent.putExtra("title", args.title)
        intent.putExtra("artist", args.artist)
        intent.putExtra("playing", args.playing)
        intent.putExtra("cover", args.cover)
        intent.putExtra("positionMs", args.positionMs)
        intent.putExtra("durationMs", args.durationMs)
        ContextCompat.startForegroundService(activity, intent)
        invoke.resolve()
    }

    @Command
    fun clearNowPlaying(invoke: Invoke) {
        activity.stopService(Intent(activity, PlaybackService::class.java))
        invoke.resolve()
    }

    /**
     * Wird vom Geraete-Sync (sync.rs) an- und wieder abgeschaltet.
     *
     * MulticastLock: Android reicht eingehende WLAN-Broadcast- und
     * Multicast-Pakete nur an Apps weiter, die diese Sperre halten - ohne
     * sie verwirft der WLAN-Treiber sie, bevor irgendein Socket sie sieht.
     * Der Beacon des PCs kam deshalb nie an, das Handy zeigte eine leere
     * Geraeteliste, obwohl beide im selben Netz waren.
     *
     * WifiLock: haelt das WLAN waehrend einer laufenden Uebertragung wach,
     * damit es bei ausgeschaltetem Bildschirm nicht in den Stromsparmodus
     * faellt und die Verbindung mitten in der Datei einschlaeft.
     *
     * Beides zieht Strom, deshalb nicht dauerhaft, sondern nur solange der
     * Sync laeuft. setReferenceCounted(false): freigeben soll auch dann
     * wirken, wenn zwischendurch mehrfach angefordert wurde.
     */
    @Command
    fun setNetzSperren(invoke: Invoke) {
        val args = invoke.parseArgs(NetzSperrenArgs::class.java)
        val wifi = activity.applicationContext
            .getSystemService(Context.WIFI_SERVICE) as WifiManager
        if (args.an) {
            if (multicastLock == null) {
                multicastLock = wifi.createMulticastLock("reson-sync").apply {
                    setReferenceCounted(false)
                    acquire()
                }
            }
            if (wifiLock == null) {
                // HIGH_PERF gilt seit Android 10 als veraltet; LOW_LATENCY
                // ist der Nachfolger und wirkt, solange die App vorn ist -
                // sonst verhaelt es sich wie der normale Modus, was fuer
                // eine laufende Uebertragung reicht.
                @Suppress("DEPRECATION")
                val modus = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    WifiManager.WIFI_MODE_FULL_LOW_LATENCY
                } else {
                    WifiManager.WIFI_MODE_FULL_HIGH_PERF
                }
                wifiLock = wifi.createWifiLock(modus, "reson-sync").apply {
                    setReferenceCounted(false)
                    acquire()
                }
            }
        } else {
            multicastLock?.let { if (it.isHeld) it.release() }
            multicastLock = null
            wifiLock?.let { if (it.isHeld) it.release() }
            wifiLock = null
        }
        invoke.resolve()
    }

    @Command
    fun updateCanInstall(invoke: Invoke) {
        val ok = Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
            activity.packageManager.canRequestPackageInstalls()
        invoke.resolve(JSObject().put("ok", ok))
    }

    @Command
    fun updateOpenInstallSettings(invoke: Invoke) {
        activity.startActivity(
            Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
        invoke.resolve()
    }

    /** Laedt das APK (Rust hat die Adresse schon gegen das eigene Release geprueft). */
    @Command
    fun updateDownload(invoke: Invoke) {
        val args = invoke.parseArgs(UpdateArgs::class.java)
        Thread {
            deleteInstallerFiles()
            updateDir.mkdirs()
            val file = File(updateDir, "update.apk")
            var conn: HttpURLConnection? = null
            try {
                // GitHub leitet auf seinen Datei-Server um (https -> https,
                // dem folgt HttpURLConnection von selbst).
                conn = (URL(args.url).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 15_000
                    readTimeout = 30_000
                    setRequestProperty("User-Agent", "Reson-Updater")
                }
                val total = conn.contentLengthLong
                conn.inputStream.use { input ->
                    file.outputStream().use { out ->
                        val buf = ByteArray(64 * 1024)
                        var done = 0L
                        var last = -1
                        while (true) {
                            val n = input.read(buf)
                            if (n < 0) break
                            out.write(buf, 0, n)
                            done += n
                            if (total > 0) {
                                val p = (done * 100 / total).toInt()
                                if (p != last) {
                                    last = p
                                    trigger("update-progress", JSObject().put("percent", p))
                                }
                            }
                        }
                        if (total > 0 && done < total) throw java.io.IOException("Download unvollstaendig")
                    }
                }
                invoke.resolve()
            } catch (e: Exception) {
                deleteInstallerFiles()
                invoke.reject(e.message ?: "Download fehlgeschlagen")
            } finally {
                conn?.disconnect()
            }
        }.start()
    }

    /** Uebergibt das geladene APK an Androids eigenen Installationsdialog. */
    @Command
    fun updateInstall(invoke: Invoke) {
        val file = File(updateDir, "update.apk")
        if (!file.isFile) {
            invoke.reject("Kein Update geladen")
            return
        }
        val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)
        activity.startActivity(
            Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        )
        invoke.resolve()
    }
}
