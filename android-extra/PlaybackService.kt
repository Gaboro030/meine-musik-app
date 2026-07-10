// Copy this into src-tauri/gen/android/app/src/main/java/com/meinemusik/app/
// (that package dir only exists after `npm run android:init`).
//
// Why this is needed: Tauri's Android WebView pauses JS/audio once the
// Activity goes to background (screen off / app switched away) - there is
// no way around that from the webview side. A foreground Service with a
// MediaSession is the only way Android keeps audio playing and shows
// lockscreen/notification playback controls, same as Spotify/YouTube Music.
package com.meinemusik.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
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

    companion object {
        const val CHANNEL_ID = "meine_musik_playback"
        const val NOTIF_ID = 1
        const val ACTION_PLAY = "com.meinemusik.app.PLAY"
        const val ACTION_PAUSE = "com.meinemusik.app.PAUSE"
        const val ACTION_NEXT = "com.meinemusik.app.NEXT"
        const val ACTION_PREV = "com.meinemusik.app.PREV"
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

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_PLAY, ACTION_PAUSE, ACTION_NEXT, ACTION_PREV -> {
                // Forward to the webview via Tauri's JS-side event listener
                // (registered in MainActivity / a small Tauri mobile plugin).
                MainActivity.emitMediaControl(intent.action!!)
            }
        }

        val title = intent?.getStringExtra("title") ?: "Meine Musik"
        val artist = intent?.getStringExtra("artist") ?: ""

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(artist)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setStyle(MediaStyle().setMediaSession(mediaSession.sessionToken))
            .setOngoing(true)
            .build()

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
