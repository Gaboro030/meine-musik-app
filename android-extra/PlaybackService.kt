// Copy this into src-tauri/gen/android/app/src/main/java/com/reson/app/
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
package com.reson.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat.MediaStyle
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat

class PlaybackService : Service() {
    private lateinit var mediaSession: MediaSessionCompat
    private var lastTitle = "Reson"
    private var lastArtist = ""
    private var lastCoverPath = ""
    private var lastCover: Bitmap? = null
    private var lastPosition = 0L
    private var lastDuration = 0L

    companion object {
        const val CHANNEL_ID = "meine_musik_playback"
        const val NOTIF_ID = 1
        const val ACTION_PLAY = "com.reson.app.PLAY"
        const val ACTION_PAUSE = "com.reson.app.PAUSE"
        const val ACTION_NEXT = "com.reson.app.NEXT"
        const val ACTION_PREV = "com.reson.app.PREV"
        const val ACTION_MEDIA_CONTROL = "com.reson.app.MEDIA_CONTROL"
    }

    override fun onCreate() {
        super.onCreate()
        mediaSession = MediaSessionCompat(this, "ResonSession")

        // DAS war der eigentliche Grund, warum im Player der
        // Schnelleinstellungen (und im Sperrbildschirm) nur der Songtitel
        // stand und die Knoepfe nichts taten: dieser Bereich wird NICHT aus
        // den Knoepfen der Benachrichtigung gespeist, sondern ausschliesslich
        // aus der MediaSession. Ohne Callback hat Android niemanden, dem es
        // den Tastendruck melden koennte - es zeigt die Knoepfe trotzdem an,
        // sie laufen nur ins Leere.
        mediaSession.setCallback(object : MediaSessionCompat.Callback() {
            override fun onPlay() = melden("play")
            override fun onPause() = melden("pause")
            override fun onSkipToNext() = melden("next")
            override fun onSkipToPrevious() = melden("prev")
            override fun onStop() = melden("pause")
            override fun onSeekTo(pos: Long) {
                lastPosition = pos
                sendBroadcast(
                    Intent(ACTION_MEDIA_CONTROL)
                        .putExtra("control", "seek")
                        .putExtra("position", pos)
                        .setPackage(packageName)
                )
            }
        })
        mediaSession.isActive = true

        val mgr = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            mgr.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Wiedergabe", NotificationManager.IMPORTANCE_LOW)
            )
        }
    }

    /** Ein Tastendruck von aussen - weiterreichen an die WebView. */
    private fun melden(control: String) {
        sendBroadcast(
            Intent(ACTION_MEDIA_CONTROL).putExtra("control", control).setPackage(packageName)
        )
    }

    private fun controlPendingIntent(action: String): PendingIntent {
        val intent = Intent(this, PlaybackService::class.java).setAction(action)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        return PendingIntent.getService(this, action.hashCode(), intent, flags)
    }

    /** Tippen auf die Benachrichtigung selbst holt die App nach vorn. */
    private fun openAppIntent(): PendingIntent? {
        val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return null
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        return PendingIntent.getActivity(
            this, 0, launch,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    /**
     * Kein Cover vorhanden - statt der grauen Flaeche, die Android sonst
     * zeigt, ein eigenes Bild bauen: Farbverlauf, dessen Farbton sich aus
     * dem Titel ergibt (derselbe Song bekommt also immer dieselbe Farbe),
     * plus der Anfangsbuchstabe. Sieht nach Absicht aus statt nach Fehler.
     */
    private fun ersatzCover(title: String): Bitmap {
        val groesse = 512
        val bmp = Bitmap.createBitmap(groesse, groesse, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)

        val ton = ((title.hashCode().toLong() and 0xFFFFFFFFL) % 360L).toFloat()
        val oben = Color.HSVToColor(floatArrayOf(ton, 0.55f, 0.42f))
        val unten = Color.HSVToColor(floatArrayOf((ton + 40f) % 360f, 0.65f, 0.16f))
        val farbe = Paint().apply {
            isAntiAlias = true
            shader = LinearGradient(
                0f, 0f, groesse.toFloat(), groesse.toFloat(),
                oben, unten, Shader.TileMode.CLAMP
            )
        }
        canvas.drawRect(0f, 0f, groesse.toFloat(), groesse.toFloat(), farbe)

        val buchstabe = title.trim().firstOrNull()?.uppercase() ?: "♪"
        val schrift = Paint().apply {
            isAntiAlias = true
            color = Color.argb(230, 255, 255, 255)
            textSize = groesse * 0.44f
            textAlign = Paint.Align.CENTER
        }
        // Vertikal wirklich mittig: baseline liegt nicht in der Mitte des
        // Buchstabens, deshalb um die halbe Texthoehe nach unten versetzen.
        val mitte = groesse / 2f
        val versatz = (schrift.descent() + schrift.ascent()) / 2f
        canvas.drawText(buchstabe, mitte, mitte - versatz, schrift)
        return bmp
    }

    /** Cover laden und merken - erneutes Dekodieren pro Update spart das. */
    private fun coverBild(pfad: String, title: String): Bitmap {
        if (pfad.isNotEmpty() && pfad == lastCoverPath) {
            lastCover?.let { return it }
        }
        val geladen = if (pfad.isNotEmpty()) {
            try {
                BitmapFactory.decodeFile(pfad)
            } catch (e: Throwable) {
                null
            }
        } else null
        val bild = geladen ?: ersatzCover(title)
        lastCoverPath = pfad
        lastCover = bild
        return bild
    }

    /**
     * Metadaten und Zustand an die MediaSession. Der System-Player liest
     * genau hier - Titel, Interpret, Cover als Hintergrund und, ueber
     * DURATION plus die Position im PlaybackState, die Fortschrittsleiste
     * mit der Minutenangabe.
     */
    private fun sessionAktualisieren(playing: Boolean, cover: Bitmap) {
        mediaSession.setMetadata(
            MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, lastTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, lastArtist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, lastArtist)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, lastDuration)
                .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, cover)
                .putBitmap(MediaMetadataCompat.METADATA_KEY_ART, cover)
                .build()
        )
        mediaSession.setPlaybackState(
            PlaybackStateCompat.Builder()
                // Ohne diese Liste blendet Android die entsprechenden
                // Knoepfe aus oder laesst sie wirkungslos.
                .setActions(
                    PlaybackStateCompat.ACTION_PLAY or
                        PlaybackStateCompat.ACTION_PAUSE or
                        PlaybackStateCompat.ACTION_PLAY_PAUSE or
                        PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                        PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                        PlaybackStateCompat.ACTION_SEEK_TO or
                        PlaybackStateCompat.ACTION_STOP
                )
                .setState(
                    if (playing) PlaybackStateCompat.STATE_PLAYING
                    else PlaybackStateCompat.STATE_PAUSED,
                    lastPosition,
                    if (playing) 1.0f else 0.0f
                )
                .build()
        )
    }

    private fun buildNotification(playing: Boolean, cover: Bitmap): Notification {
        val playPauseIcon = if (playing) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play
        val playPauseLabel = if (playing) "Pause" else "Abspielen"
        val playPauseAction = if (playing) ACTION_PAUSE else ACTION_PLAY

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(lastTitle)
            .setContentText(lastArtist)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setLargeIcon(cover)
            .addAction(android.R.drawable.ic_media_previous, "Zurück", controlPendingIntent(ACTION_PREV))
            .addAction(playPauseIcon, playPauseLabel, controlPendingIntent(playPauseAction))
            .addAction(android.R.drawable.ic_media_next, "Vor", controlPendingIntent(ACTION_NEXT))
            .setStyle(
                MediaStyle()
                    .setMediaSession(mediaSession.sessionToken)
                    .setShowActionsInCompactView(0, 1, 2)
            )
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(playing)
        openAppIntent()?.let { builder.setContentIntent(it) }
        return builder.build()
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
        lastPosition = intent?.getLongExtra("positionMs", lastPosition) ?: lastPosition
        lastDuration = intent?.getLongExtra("durationMs", lastDuration) ?: lastDuration
        val playing = intent?.getBooleanExtra("playing", true) ?: true
        val cover = coverBild(intent?.getStringExtra("cover") ?: lastCoverPath, lastTitle)

        sessionAktualisieren(playing, cover)
        val notification = buildNotification(playing, cover)
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
