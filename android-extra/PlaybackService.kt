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
//
// Zugleich der MediaBrowserService fuer Android Auto: das Auto bindet sich
// hier an, blaettert durch Playlists und Titel (onGetRoot/onLoadChildren)
// und waehlt per mediaId oder Sprachsuche. Die Bibliothek kennt nur die
// Web-Seite - sie schickt eine Kopie (NowPlayingPlugin.setAutoLibrary), die
// hier als Datei liegt, damit das Auto sie auch vor dem ersten Start zeigt.
package com.reson.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.Process
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.media.MediaBrowserServiceCompat
import androidx.media.app.NotificationCompat.MediaStyle
import android.support.v4.media.MediaBrowserCompat.MediaItem
import android.support.v4.media.MediaDescriptionCompat
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import org.json.JSONArray
import java.io.File
import java.util.Locale
import java.util.UUID

class PlaybackService : MediaBrowserServiceCompat() {
    private lateinit var mediaSession: MediaSessionCompat
    private var lastTitle = "Reson"
    private var lastArtist = ""
    private var lastCoverPath = ""
    private var lastCover: Bitmap? = null
    private var lastPosition = 0L
    private var lastDuration = 0L

    /**
     * Kopfhoerer abgezogen / Bluetooth getrennt: Android meldet das als
     * "AUDIO_BECOMING_NOISY". Ohne Reaktion lief die Musik einfach ueber den
     * Handy-Lautsprecher weiter - jede Musik-App pausiert in dem Moment.
     */
    private val kopfhoererWeg = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) melden("pause")
        }
    }

    companion object {
        const val CHANNEL_ID = "meine_musik_playback"
        const val NOTIF_ID = 1
        const val ACTION_PLAY = "com.reson.app.PLAY"
        const val ACTION_PAUSE = "com.reson.app.PAUSE"
        const val ACTION_NEXT = "com.reson.app.NEXT"
        const val ACTION_PREV = "com.reson.app.PREV"
        const val ACTION_MEDIA_CONTROL = "com.reson.app.MEDIA_CONTROL"

        /**
         * Der Dienst ist exportiert (Android Auto muss sich binden koennen).
         * Damit nicht jede App per startService die Benachrichtigung
         * umschreiben oder die Wiedergabe steuern kann, tragen unsere
         * eigenen Intents dieses Kennwort - es entsteht neu mit jedem
         * Prozess und verlaesst ihn nie.
         */
        const val EXTRA_TOKEN = "com.reson.app.TOKEN"
        val TOKEN: String = UUID.randomUUID().toString()

        /** Laeuft die Web-Seite (und damit das <audio>)? Setzt NowPlayingPlugin. */
        @Volatile var webAktiv = false

        /**
         * Auswahl aus dem Auto, die ankam, bevor die Seite zuhoerte (das Auto
         * hat die App erst gestartet). NowPlayingPlugin reicht sie nach.
         */
        @Volatile var wartend: Pair<String, String?>? = null

        @Volatile private var instanz: PlaybackService? = null

        private const val ROOT = "__root__"
        private const val LEER = "__leer__"
        private const val PLAYLISTS = "__playlists__"
        private const val ALLE = "__alle__"
        /** Mehr zeigt das Auto ohnehin nicht sinnvoll an. */
        private const val MAX_ALLE = 500

        /** Diese duerfen blaettern; alle anderen sehen eine leere Liste. */
        private val VERTRAUT = setOf(
            "com.google.android.projection.gearhead", // Android Auto
            "com.google.android.carassistant",
            "com.google.android.googlequicksearchbox", // Assistant
            "com.google.android.wearable.app",
            "com.google.android.autosimulator", // Desktop Head Unit
            "com.android.car.media", // Android Automotive
            "com.google.android.apps.automotive.templates.host",
        )

        private const val AKTIONEN =
            PlaybackStateCompat.ACTION_PLAY or
                PlaybackStateCompat.ACTION_PAUSE or
                PlaybackStateCompat.ACTION_PLAY_PAUSE or
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                PlaybackStateCompat.ACTION_SEEK_TO or
                PlaybackStateCompat.ACTION_STOP or
                PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID or
                PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH

        private fun bibliothekDatei(context: Context) = File(context.filesDir, "auto-library.json")

        /** Von NowPlayingPlugin.setAutoLibrary (Hintergrund-Thread). */
        fun bibliothekSpeichern(context: Context, json: String) {
            val ziel = bibliothekDatei(context)
            val tmp = File(ziel.path + ".tmp")
            tmp.writeText(json)
            if (!tmp.renameTo(ziel)) {
                ziel.writeText(json)
                tmp.delete()
            }
            instanz?.bibliothekGeaendert()
        }
    }

    private data class AutoTitel(val file: String, val title: String, val artist: String)
    private data class AutoPlaylist(val name: String, val tracks: List<AutoTitel>)

    private var bibliothek: List<AutoPlaylist> = emptyList()
    private var bibliothekStand = -1L
    private val abonniert = mutableSetOf<String>()
    private val haupt = Handler(Looper.getMainLooper())

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
            // Android Auto / Assistant
            override fun onPlayFromMediaId(mediaId: String?, extras: Bundle?) {
                if (mediaId != null) melden("playMedia", mediaId)
            }
            override fun onPlayFromSearch(query: String?, extras: Bundle?) = melden("search", query ?: "")
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
        // Ohne PLAY_FROM_MEDIA_ID in den Aktionen laesst Android Auto die
        // Eintraege der Bibliothek nicht antippen - auch bevor hier je etwas
        // lief, muss das also schon stehen.
        mediaSession.setPlaybackState(
            PlaybackStateCompat.Builder()
                .setActions(AKTIONEN)
                .setState(PlaybackStateCompat.STATE_NONE, 0L, 0f)
                .build()
        )
        sessionToken = mediaSession.sessionToken
        instanz = this
        // NOT_EXPORTED reicht: System-Broadcasts kommen trotzdem an.
        ContextCompat.registerReceiver(
            this,
            kopfhoererWeg,
            IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )

        val mgr = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            mgr.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Wiedergabe", NotificationManager.IMPORTANCE_LOW)
            )
        }
    }

    /**
     * Ein Tastendruck oder eine Auswahl von aussen - weiterreichen an die
     * WebView. Laeuft die gar nicht (Android Auto hat nur diesen Dienst
     * geweckt), merken und die App starten; NowPlayingPlugin reicht die
     * Auswahl nach, sobald die Seite zuhoert.
     */
    private fun melden(control: String, value: String? = null) {
        if (!webAktiv) {
            if (control == "pause") return
            wartend = control to value
            appStarten()
            return
        }
        sendBroadcast(
            Intent(ACTION_MEDIA_CONTROL)
                .putExtra("control", control)
                .putExtra("value", value)
                .setPackage(packageName)
        )
    }

    private fun appStarten() {
        val gestartet = try {
            packageManager.getLaunchIntentForPackage(packageName)?.let {
                startActivity(it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                true
            } ?: false
        } catch (e: Exception) {
            false
        }
        zustandOhneSeite(
            if (gestartet) PlaybackStateCompat.STATE_CONNECTING else PlaybackStateCompat.STATE_ERROR
        )
        // Hintergrund-Starts kann Android still verweigern - dann nach ein
        // paar Sekunden sagen, was zu tun ist, statt ewig zu "verbinden".
        haupt.postDelayed({ if (!webAktiv) zustandOhneSeite(PlaybackStateCompat.STATE_ERROR) }, 8000)
    }

    private fun zustandOhneSeite(state: Int) {
        val b = PlaybackStateCompat.Builder().setActions(AKTIONEN).setState(state, 0L, 0f)
        if (state == PlaybackStateCompat.STATE_ERROR) {
            b.setErrorMessage(
                PlaybackStateCompat.ERROR_CODE_APP_ERROR,
                text("Öffne Reson einmal auf dem Handy.", "Open Reson on your phone once.")
            )
        }
        mediaSession.setPlaybackState(b.build())
    }

    private fun text(de: String, en: String) =
        if (Locale.getDefault().language == "de") de else en

    private fun controlPendingIntent(action: String): PendingIntent {
        val intent = Intent(this, PlaybackService::class.java).setAction(action).putExtra(EXTRA_TOKEN, TOKEN)
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

    /**
     * Grosse Cover (1200px und mehr) sprengen sonst die Groessengrenze, mit
     * der Android Metadaten an Sperrbildschirm und Auto weiterreicht - das
     * Bild fehlte dann einfach.
     */
    private fun verkleinert(bmp: Bitmap): Bitmap {
        val max = 720
        val seite = maxOf(bmp.width, bmp.height)
        if (seite <= max) return bmp
        val f = max.toFloat() / seite
        return Bitmap.createScaledBitmap(bmp, (bmp.width * f).toInt(), (bmp.height * f).toInt(), true)
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
        val bild = geladen?.let { verkleinert(it) } ?: ersatzCover(title)
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
                .setActions(AKTIONEN)
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
        // null = Neustart nach START_STICKY, das ist in Ordnung. Alles andere
        // muss von uns selbst kommen (siehe TOKEN).
        if (intent != null && intent.getStringExtra(EXTRA_TOKEN) != TOKEN) return START_NOT_STICKY
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
        instanz = null
        haupt.removeCallbacksAndMessages(null)
        try {
            unregisterReceiver(kopfhoererWeg)
        } catch (e: IllegalArgumentException) {
            // war nie registriert
        }
        mediaSession.release()
        super.onDestroy()
    }

    /* ===== Android Auto: Bibliothek zum Durchblaettern =====
       Aufbau: Wurzel -> "Playlists" und "Alle Titel" (zwei Reiter im Auto).
       Playlist -> "Zufaellig abspielen" + ihre Titel. mediaIds sind JSON,
       damit Namen mit beliebigen Zeichen eindeutig bleiben - die Web-Seite
       liest sie wieder aus (nowplaying-native.js, playMediaId). */
    override fun onGetRoot(clientPackageName: String, clientUid: Int, rootHints: Bundle?): BrowserRoot? {
        // "Zuletzt gespielt" fuer die Wiederaufnahme nach einem Neustart
        // bieten wir nicht an - ohne laufende Seite gibt es nichts zu spielen.
        if (rootHints?.getBoolean(BrowserRoot.EXTRA_RECENT) == true) return null
        val vertraut = clientUid == Process.myUid() || clientUid == Process.SYSTEM_UID || clientPackageName in VERTRAUT
        if (!vertraut) return BrowserRoot(LEER, null)
        val extras = Bundle().apply {
            putBoolean("android.media.browse.SEARCH_SUPPORTED", true)
            putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 1) // Liste
            putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1)
        }
        return BrowserRoot(ROOT, extras)
    }

    override fun onLoadChildren(parentId: String, result: Result<MutableList<MediaItem>>) {
        synchronized(abonniert) { abonniert.add(parentId) }
        result.sendResult(kinder(parentId).toMutableList())
    }

    override fun onSearch(query: String, extras: Bundle?, result: Result<MutableList<MediaItem>>) {
        val q = query.trim().lowercase()
        val treffer = mutableListOf<MediaItem>()
        if (q.isNotEmpty()) {
            for (pl in bibliothekLesen()) {
                for (t in pl.tracks) {
                    if ("${t.title} ${t.artist}".lowercase().contains(q)) treffer.add(titel(pl, t))
                    if (treffer.size >= 50) break
                }
                if (treffer.size >= 50) break
            }
        }
        result.sendResult(treffer)
    }

    private fun kinder(parentId: String): List<MediaItem> {
        if (parentId == LEER) return emptyList()
        val pls = bibliothekLesen()
        return when (parentId) {
            ROOT -> listOf(
                ordner(PLAYLISTS, text("Playlists", "Playlists"), null),
                ordner(ALLE, text("Alle Titel", "All songs"), null),
            )
            PLAYLISTS -> pls.map { pl ->
                ordner(id("p", pl.name), pl.name, text("${pl.tracks.size} Titel", "${pl.tracks.size} songs"))
            }
            ALLE -> {
                val alle = pls.flatMap { pl -> pl.tracks.map { pl to it } }
                    .sortedBy { it.second.title.lowercase() }
                    .take(MAX_ALLE)
                listOf(abspielbar(id("s"), text("Alles mischen", "Shuffle all"), null)) +
                    alle.map { (pl, t) -> titel(pl, t) }
            }
            else -> {
                val teile = try { JSONArray(parentId) } catch (e: Exception) { return emptyList() }
                if (teile.optString(0) != "p") return emptyList()
                val pl = pls.firstOrNull { it.name == teile.optString(1) } ?: return emptyList()
                listOf(abspielbar(id("ps", pl.name), text("Zufällig abspielen", "Shuffle play"), pl.name)) +
                    pl.tracks.map { titel(pl, it) }
            }
        }
    }

    private fun id(vararg teile: String) = JSONArray(teile.toList()).toString()

    private fun ordner(mediaId: String, title: String, subtitle: String?) = MediaItem(
        MediaDescriptionCompat.Builder().setMediaId(mediaId).setTitle(title).setSubtitle(subtitle).build(),
        MediaItem.FLAG_BROWSABLE
    )

    private fun abspielbar(mediaId: String, title: String, subtitle: String?) = MediaItem(
        MediaDescriptionCompat.Builder().setMediaId(mediaId).setTitle(title).setSubtitle(subtitle).build(),
        MediaItem.FLAG_PLAYABLE
    )

    private fun titel(pl: AutoPlaylist, t: AutoTitel) =
        abspielbar(id("t", pl.name, t.file), t.title, t.artist.ifEmpty { pl.name })

    /** Datei nur neu lesen, wenn die Seite eine neue Fassung geschickt hat. */
    @Synchronized
    private fun bibliothekLesen(): List<AutoPlaylist> {
        val datei = bibliothekDatei(this)
        val stand = if (datei.isFile) datei.lastModified() else 0L
        if (stand == bibliothekStand) return bibliothek
        bibliothekStand = stand
        bibliothek = try {
            val arr = JSONArray(datei.readText())
            (0 until arr.length()).map { i ->
                val pl = arr.getJSONObject(i)
                val tr = pl.optJSONArray("tracks") ?: JSONArray()
                AutoPlaylist(
                    pl.optString("name"),
                    (0 until tr.length()).map { j ->
                        val t = tr.getJSONObject(j)
                        AutoTitel(t.optString("file"), t.optString("title"), t.optString("artist"))
                    }
                )
            }
        } catch (e: Exception) {
            emptyList()
        }
        return bibliothek
    }

    /** Neue Fassung von der Seite: jede offene Ansicht im Auto auffrischen. */
    private fun bibliothekGeaendert() {
        val ids = synchronized(abonniert) { abonniert.toList() }
        haupt.post { ids.forEach { notifyChildrenChanged(it) } }
    }
}
