// Copy this into src-tauri/gen/android/app/src/main/java/com/meinemusik/app/
// (that package dir only exists after `npm run android:init`).
//
// Why this is needed: Tauri's Android WebView pauses JS/audio once the
// Activity goes to background (screen off / app switched away) - there is
// no way around that from the webview side. A foreground Service with a
// MediaSession is the only way Android keeps audio playing and shows
// lockscreen/notification playback controls, same as Spotify/YouTube Music.
//
// Started/updated/stopped by NowPlayingPlugin.kt (the Rust<->Kotlin bridge,
// see nowplaying.rs) whenever a track starts, changes, or playback stops.
// Notification button taps get broadcast back out (ACTION_MEDIA_CONTROL) -
// NowPlayingPlugin listens for that and relays it to JS as "media-control".
package com.meinemusik.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat.MediaStyle
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat

class PlaybackService : Service() {
    private lateinit var mediaSession: MediaSessionCompat
    private var lastTitle = "Meine Musik"
    private var lastArtist = ""

    companion object {
        const val CHANNEL_ID = "meine_musik_playback"
        const val NOTIF_ID = 1
        const val ACTION_PLAY = "com.meinemusik.app.PLAY"
        const val ACTION_PAUSE = "com.meinemusik.app.PAUSE"
        const val ACTION_NEXT = "com.meinemusik.app.NEXT"
        const val ACTION_PREV = "com.meinemusik.app.PREV"
        const val ACTION_MEDIA_CONTROL = "com.meinemusik.app.MEDIA_CONTROL"
    }

    override fun onCreate() {
        super.onCreate()
        mediaSession = MediaSessionCompat(this, "MeineMusikSession")
        mediaSession.isActive = true

        val mgr = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            mgr.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Wiedergabe", NotificationManager.IMPORTANCE_LOW)
            )
        }
    }

    private fun controlPendingIntent(action: String): PendingIntent {
        val intent = Intent(this, PlaybackService::class.java).setAction(action)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        return PendingIntent.getService(this, action.hashCode(), intent, flags)
    }

    private fun buildNotification(title: String, artist: String, playing: Boolean): Notification {
        val playPauseIcon = if (playing) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play
        val playPauseLabel = if (playing) "Pause" else "Abspielen"
        val playPauseAction = if (playing) ACTION_PAUSE else ACTION_PLAY

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(artist)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .addAction(android.R.drawable.ic_media_previous, "Zurück", controlPendingIntent(ACTION_PREV))
            .addAction(playPauseIcon, playPauseLabel, controlPendingIntent(playPauseAction))
            .addAction(android.R.drawable.ic_media_next, "Vor", controlPendingIntent(ACTION_NEXT))
            .setStyle(
                MediaStyle()
                    .setMediaSession(mediaSession.sessionToken)
                    .setShowActionsInCompactView(0, 1, 2)
            )
            .setOngoing(playing)
            .build()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_PLAY, ACTION_PAUSE, ACTION_NEXT, ACTION_PREV -> {
                // Button tap in the notification/lockscreen - not a JS
                // update - forward to NowPlayingPlugin's receiver, which
                // relays it to the actual <audio> element in the webview.
                val control = when (intent.action) {
                    ACTION_PLAY -> "play"
                    ACTION_PAUSE -> "pause"
                    ACTION_NEXT -> "next"
                    else -> "prev"
                }
                sendBroadcast(Intent(ACTION_MEDIA_CONTROL).putExtra("control", control).setPackage(packageName))
                return START_STICKY
            }
        }

        // Plain update from JS (nowplaying.rs) with the currently playing
        // track's metadata - rebuild the notification to match.
        lastTitle = intent?.getStringExtra("title") ?: lastTitle
        lastArtist = intent?.getStringExtra("artist") ?: lastArtist
        val playing = intent?.getBooleanExtra("playing", true) ?: true

        val notification = buildNotification(lastTitle, lastArtist, playing)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        } else {
            startForeground(NOTIF_ID, notification)
        }
        return START_STICKY
    }

    override fun onDestroy() {
        mediaSession.release()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
