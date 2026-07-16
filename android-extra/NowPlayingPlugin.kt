// Copy this into src-tauri/gen/android/app/src/main/java/com/meinemusik/app/
// (merge-android-extras.mjs does this automatically after `tauri android
// init`). Rust<->Kotlin bridge for the PlaybackService foreground-service
// notification (see PlaybackService.kt) - updateNowPlaying/clearNowPlaying
// are called from nowplaying.rs whenever a track starts/changes/stops.
// Notification button taps arrive here via a broadcast from
// PlaybackService and get relayed to JS as a "media-control" event.
package com.meinemusik.app

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
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
}

@TauriPlugin
class NowPlayingPlugin(private val activity: Activity) : Plugin(activity) {
    private var receiver: BroadcastReceiver? = null

    override fun load(webView: android.webkit.WebView) {
        super.load(webView)
        val filter = IntentFilter(PlaybackService.ACTION_MEDIA_CONTROL)
        val r = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                val action = intent?.getStringExtra("control") ?: return
                val data = JSObject()
                data.put("action", action)
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
        ContextCompat.startForegroundService(activity, intent)
        invoke.resolve()
    }

    @Command
    fun clearNowPlaying(invoke: Invoke) {
        activity.stopService(Intent(activity, PlaybackService::class.java))
        invoke.resolve()
    }
}
