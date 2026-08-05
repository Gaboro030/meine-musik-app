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
import android.net.wifi.WifiManager
import android.os.Build
import androidx.core.content.ContextCompat
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
class NetzSperrenArgs {
    var an: Boolean = false
}

@TauriPlugin
class NowPlayingPlugin(private val activity: Activity) : Plugin(activity) {
    private var receiver: BroadcastReceiver? = null
    private var multicastLock: WifiManager.MulticastLock? = null
    private var wifiLock: WifiManager.WifiLock? = null

    override fun load(webView: android.webkit.WebView) {
        super.load(webView)
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
}
