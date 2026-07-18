<div align="center">

<img src="icons-source.png" width="120" alt="Meine Musik" />

# 🎵 Meine Musik

### Dein eigener Spotify-Klon — Windows · Linux · Android

**Playlists · YouTube/Spotify-Import · Party-Modus · Themes · 100 % lokal, keine Cloud**

[![Download](https://img.shields.io/badge/⬇_Download-Neueste_Version-1db954?style=for-the-badge)](../../actions/workflows/build.yml)
&nbsp;
[![Build](https://img.shields.io/github/actions/workflow/status/Gaboro030/meine-musik-app/build.yml?style=for-the-badge&label=Build)](../../actions)

![Windows](https://img.shields.io/badge/Windows-0078D6?style=flat-square&logo=windows&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-FCC624?style=flat-square&logo=linux&logoColor=black)
![Android](https://img.shields.io/badge/Android-3DDC84?style=flat-square&logo=android&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-000000?style=flat-square&logo=rust&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri_v2-24C8DB?style=flat-square&logo=tauri&logoColor=white)

</div>

---

## 🌍 Was ist das?

**Meine Musik** ist ein nativer Musik-Player mit eingebautem Downloader:
Spotify-, YouTube- oder YouTube-Music-Link reinwerfen, Titel auswählen,
fertig — alles landet als MP3 (oder MP4) in deiner lokalen Bibliothek.
Keine Cloud, kein Konto, keine Werbung. Deine Musik gehört dir.

---

## ✨ Features

| | |
|---|---|
| 🎧 **Player** | Shuffle, Repeat, Crossfade, Equalizer, Lyrics, Dynamic Glow |
| 📥 **Downloader** | Spotify-/YouTube-/YT-Music-Playlists, MP3 128–320 kbps oder MP4 bis 1080p, Live-Fortschritt mit Speed + ETA, automatische Qualitäts-Fallbacks |
| 🎉 **Party-Modus** | Alle Geräte im WLAN hören synchron mit — Gäste scannen einfach den QR-Code |
| 🌍 **Internet-Link** | Freunde können auch **ohne gleiches WLAN** beitreten (Gratis-Tunnel, kein Konto nötig) |
| 👥 **Warteschlange** | Gäste wünschen sich Songs direkt vom Handy in deine Queue |
| 🎨 **19 Themes + Editor** | Von AMOLED-Schwarz bis Vaporwave — Rechtsklick entscheidet, was ein Theme ändern darf; eigenes Theme komplett frei gestaltbar |
| 🗑️ **Papierkorb** | Gelöschte Songs sind wiederherstellbar, nichts ist sofort weg |
| 🔎 **Entdecken** | Empfehlungen passend zu deiner Bibliothek + Online-Suche |
| ⌨️ **Hotkeys** | Jede Tastenkombination frei belegbar |

---

## ⬇️ Download & Installation

1. Auf **[Actions](../../actions)** klicken → obersten grünen Lauf öffnen
2. Unten bei **Artifacts** dein System herunterladen:

| Plattform | Artifact | Installation |
|---|---|---|
| 🪟 Windows | `dist-app-windows` | ZIP entpacken → `.exe`-Installer starten |
| 🐧 Ubuntu/Debian | `dist-app-ubuntu` | `.deb` installieren: `sudo dpkg -i *.deb` |
| 🤖 Android | `dist-app-android` | ZIP entpacken → `MeineMusik.apk` aufs Handy → antippen → installieren |

> **Android:** Beim ersten Mal fragt das Handy nach „Unbekannte Apps installieren" — einmal erlauben, fertig.

> **Spotify-Import** braucht einmalig kostenlose API-Zugangsdaten von
> [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard):
> `SPOTIFY_CLIENT_ID` und `SPOTIFY_CLIENT_SECRET` als Umgebungsvariablen
> setzen. YouTube/YT-Music-Links funktionieren ohne jedes Setup.

---

## 📸 Party-Modus in 3 Schritten

```
   ┌─────────────┐      ┌──────────────┐      ┌───────────────────┐
   │ 👥 anklicken │ ───▶ │ QR scannen   │ ───▶ │ 🎉 Alle hören mit  │
   │  (Sidebar)   │      │ (Handy-Kam.) │      │  & wünschen Songs │
   └─────────────┘      └──────────────┘      └───────────────────┘
```

Mit **🌍 Internet-Link** klappt das sogar über mobile Daten — der Link
läuft über einen kostenlosen Cloudflare-Tunnel, ohne Portfreigabe.

---

## 🛠️ Tech-Stack

| Schicht | Technologie | Warum |
|---|---|---|
| Core | Rust + Tauri v2 | Nativ, klein, schnell — ein Codebase für 3 Plattformen |
| Downloads | yt-dlp + ffmpeg (Sidecar) | Das bewährteste Extraktions-Duo überhaupt |
| Party-Server | axum (eingebettet) | LAN-/Internet-Gäste ohne externe Infrastruktur |
| UI | Vanilla JS + CSS | Kein Framework-Ballast, startet sofort |

---

## 🧑‍💻 Selbst bauen

```bash
# Voraussetzungen: Rust (rustup.rs), Node 20+
npm install
npx tauri icon icons-source.png       # App-Icons generieren
# yt-dlp + cloudflared nach src-tauri/binaries/ legen (Sidecar-Namensschema,
# siehe .github/workflows/build.yml - CI macht genau das automatisch)
npm run dev                            # Desktop-Dev-Fenster
npm run build                          # Release -> dist-app/
```

**Android:** `npm run android:init` (Android SDK + NDK nötig), dann
`node scripts/merge-android-extras.mjs`, dann `npm run build:android` —
ergibt genau eine Datei: `dist-app/android-MeineMusik.apk`, Debug-signiert,
direkt installierbar (kein `.aab`, kein Play-Store-Umweg).

## Android-Downloads & PoToken
yt-dlp gibt's nicht für Android, also läuft der Download-Pfad dort nativ
über YouTubes Innertube-API (`src-tauri/src/innertube.rs`) statt über den
Sidecar. Seit 2025 verlangt YouTube dafür meist einen **PoToken** (eine
kryptografische Bestätigung, dass eine echte Google-JS-Umgebung die
Anfrage stellt) - reines Client-Spoofing reicht nicht mehr aus.

Da die Tauri-WebView selbst eine echte Chromium/WebView2/WKWebView-
Engine ist, generiert die App den PoToken clientseitig: `src/bgutils.js`
(unverändert von [bgutils-js](https://github.com/LuanRT/BgUtils), MIT)
orchestriert Googles eigenes BotGuard-Attestierungsskript (live pro
Sitzung geladen, nie gespeichert), `src/potoken.js`/`potoken-init.js`
starten das beim Laden von `index.html`/`downloader.html` auf Android im
Hintergrund und übergeben das Ergebnis per `set_po_token` an Rust.
`innertube.rs` hängt den Token an jeden `/player`-Call
(`serviceIntegrityDimensions`) und an die eigentliche Stream-URL (`&pot=`)
an. Ohne WebView-JS-Ausführung (`script-src 'unsafe-eval'` in der CSP)
geht das nicht - das ist eine echte, unvermeidbare Voraussetzung von
BotGuard, kein Sicherheitsloch, das wir aus Bequemlichkeit geöffnet haben.

<details>
<summary>📁 Projekt-Layout</summary>

```
tauri-app/
├── src/                  # Frontend (Player, Downloader, Themes, Shim)
│   ├── index.html        # Player-UI
│   ├── player.js         # Playback-Engine (1:1 vom Flask-Original)
│   ├── themes.js         # Theme-System 2.0 + Custom-Editor
│   ├── tauri-shim.js     # fetch() -> Tauri-invoke()-Übersetzung
│   └── downloader.*      # Downloader-Seite
├── src-tauri/
│   ├── src/commands.rs   # Bibliothek, Streaming, Downloads
│   ├── src/party.rs      # Eingebetteter LAN-/Internet-Server + QR
│   ├── src/playlist.rs   # Spotify/YouTube/YT-Music-Auflösung
│   ├── src/discovery.rs  # Empfehlungen + Online-Suche
│   ├── src/trash.rs      # Papierkorb
│   └── src/lyrics.rs     # Songtexte
├── android-extra/        # Hintergrund-Playback-Service (Android)
└── .github/workflows/    # CI: baut Windows + Linux + Android parallel
```
</details>

---

## ⚠️ Hinweise

- Nur für Inhalte verwenden, an denen du die **Rechte besitzt**.
- Beim ersten Party-Modus-Start fragt die **Windows-Firewall** — „Zulassen" klicken, sonst kommen Gäste nicht rein.
- Track-Dauer bei manchen Formaten noch „—" (kein vollständiger Decoder eingebaut).

---

<div align="center">

**Gebaut mit 🦀 Rust, ☕ und viel zu vielen CI-Läufen.**

</div>
