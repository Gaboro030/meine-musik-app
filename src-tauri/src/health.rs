use crate::commands::AppState;
use regex::Regex;
use serde::Serialize;
use std::collections::HashSet;
use std::path::Path;
use std::sync::OnceLock;

#[derive(Serialize, Clone)]
pub struct OrphanedSidecar {
    pub playlist: String,
    pub filename: String,
}

#[derive(Serialize, Clone)]
pub struct BrokenTrashEntry {
    pub id: String,
    pub filename: String,
    pub playlist: String,
}

#[derive(Serialize, Default)]
pub struct HealthReport {
    pub orphaned_sidecars: Vec<OrphanedSidecar>,
    pub broken_trash_entries: Vec<BrokenTrashEntry>,
}

// Laengste/spezifischste Endung zuerst - ".cover_cache.jpg" muss vor dem
// allgemeineren ".jpg" geprueft werden, sonst wuerde dessen Basisname noch
// die eigentlich nicht dazugehoerende ".cover_cache"-Silbe enthalten.
const SIDECAR_SUFFIXES: &[&str] = &[".cover_cache.jpg", ".jpg", ".album.txt", ".artist.txt", ".lyrics.json"];
const AUDIO_EXTS: &[&str] = &["mp3", "m4a", "mp4"];

/// Sidecar-Dateien (Cover/.jpg, Album/Interpret-Sidecars, Lyrics-Cache), zu
/// denen der eigentliche Track nicht mehr existiert - z.B. weil der Track
/// geloescht/umbenannt wurde, der Sidecar aber liegen blieb.
fn find_orphaned_sidecars_in(dir: &Path, playlist: &str) -> Vec<OrphanedSidecar> {
    let mut out = Vec::new();
    let Ok(entries) = std::fs::read_dir(dir) else {
        return out;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        let Some(suffix) = SIDECAR_SUFFIXES.iter().find(|s| name.ends_with(**s)) else {
            continue;
        };
        let base = &name[..name.len() - suffix.len()];
        if base.is_empty() {
            continue;
        }
        let has_track = AUDIO_EXTS.iter().any(|ext| dir.join(format!("{base}.{ext}")).is_file());
        if !has_track {
            out.push(OrphanedSidecar {
                playlist: playlist.to_string(),
                filename: name.to_string(),
            });
        }
    }
    out
}

fn health_check_inner(state: &AppState) -> HealthReport {
    let mut report = HealthReport::default();

    if let Ok(entries) = std::fs::read_dir(&state.music_root) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            report.orphaned_sidecars.extend(find_orphaned_sidecars_in(&path, &name));
        }
    }

    // Papierkorb-Eintrag ohne die dazugehoerige Datei im Papierkorb-Ordner -
    // "Wiederherstellen" wuerde da mit "Datei fehlt im Papierkorb" scheitern.
    for e in crate::trash::load_index(&state.trash_index_file) {
        let path = state.trash_dir.join(format!("{}.mp3", e.id));
        if !path.is_file() {
            report.broken_trash_entries.push(BrokenTrashEntry {
                id: e.id,
                filename: e.filename,
                playlist: e.playlist,
            });
        }
    }

    report
}

#[tauri::command]
pub fn health_check(state: tauri::State<AppState>) -> Result<HealthReport, String> {
    Ok(health_check_inner(&state))
}

#[derive(Serialize)]
pub struct HealthCleanupResult {
    pub removed_sidecars: usize,
    pub removed_trash_entries: usize,
}

/// Loescht alle aktuell gefundenen verwaisten Sidecars und raeumt kaputte
/// Papierkorb-Eintraege aus dem Index (die Datei ist da eh schon weg, nur
/// der Eintrag verwaist). Scannt intern nochmal frisch statt sich auf einen
/// vorherigen health_check()-Aufruf zu verlassen - zwischen Anzeigen und
/// Klick auf "Bereinigen" koennte sich sonst etwas geaendert haben.
#[tauri::command]
pub fn health_check_cleanup(state: tauri::State<AppState>) -> Result<HealthCleanupResult, String> {
    let report = health_check_inner(&state);

    let mut removed_sidecars = 0usize;
    for s in &report.orphaned_sidecars {
        let path = state.music_root.join(&s.playlist).join(&s.filename);
        if std::fs::remove_file(&path).is_ok() {
            removed_sidecars += 1;
        }
    }

    let mut removed_trash_entries = 0usize;
    if !report.broken_trash_entries.is_empty() {
        let broken_ids: HashSet<&str> = report.broken_trash_entries.iter().map(|e| e.id.as_str()).collect();
        let mut entries = crate::trash::load_index(&state.trash_index_file);
        let before = entries.len();
        entries.retain(|e| !broken_ids.contains(e.id.as_str()));
        removed_trash_entries = before - entries.len();
        crate::trash::save_index(&state.trash_index_file, &entries);
    }

    Ok(HealthCleanupResult { removed_sidecars, removed_trash_entries })
}

/* ===== Auto-Trim Stille (Anfang/Ende) =====
   Eigene Erweiterung, kein Teil des normalen health_check() - der laeuft
   bei jedem Oeffnen der Health-Check-Seite automatisch und darf dafuer
   nicht pro Track ein komplettes ffmpeg-Decoding anstossen (bei einer
   groesseren Bibliothek waere das spuerbar langsam). Stattdessen ein
   eigener, vom Nutzer explizit angestossener Scan-Button.

   Nutzt System-ffmpeg ueber PATH (nicht gebuendelt wie yt-dlp/cloudflared -
   siehe capabilities/default.json), da ffmpeg als eigenes Sidecar-Binary
   pro Plattform mehrere zig MB zusaetzlich in jeden Build packen wuerde.
   Der bestehende Download-Pfad (build_ytdlp_args: --embed-thumbnail,
   --audio-format mp3) haengt ohnehin schon stillschweigend an System-
   ffmpeg, das ist also keine neue Abhaengigkeitsklasse fuer diese App -
   nur die erste Stelle, die das offen zugibt, statt es yt-dlp intern
   erledigen zu lassen. Fehlt ffmpeg, scheitert scan_silence/trim_silence
   mit einer verstaendlichen Fehlermeldung statt eines rohen OS-Fehlers.
   Desktop-only wie yt-dlp selbst - Android hat weder das eine noch das
   andere. */

/// Wird auch als Abbruch-Erkennung benutzt (scan_loudness bricht bei
/// genau diesem Text ab, statt sinnlos ueber die ganze Bibliothek zu
/// laufen) - deshalb eine Konstante statt drei getippter Kopien.
const FFMPEG_MISSING: &str =
    "ffmpeg nicht gefunden - dafuer wird ein auf System-PATH installiertes ffmpeg benoetigt.";
const ANDROID_NO_FFMPEG: &str = "Auf Android nicht verfuegbar (kein ffmpeg).";

#[derive(Serialize, Clone)]
pub struct SilenceHit {
    pub playlist: String,
    pub filename: String,
    pub title: String,
    pub leading: f64,
    pub trailing: f64,
}

fn ffmpeg_duration_re() -> &'static Regex {
    static CELL: OnceLock<Regex> = OnceLock::new();
    CELL.get_or_init(|| Regex::new(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)").unwrap())
}
fn silence_start_re() -> &'static Regex {
    static CELL: OnceLock<Regex> = OnceLock::new();
    CELL.get_or_init(|| Regex::new(r"silence_start:\s*(-?[\d.]+)").unwrap())
}
fn silence_end_re() -> &'static Regex {
    static CELL: OnceLock<Regex> = OnceLock::new();
    CELL.get_or_init(|| Regex::new(r"silence_end:\s*(-?[\d.]+)").unwrap())
}

/// ffmpegs eigene "-i <file>"-Kopfzeile enthaelt die Gesamtlaenge
/// ("Duration: 00:01:23.45, ..."), egal ob ein Filter angehaengt ist -
/// spart einen zweiten Aufruf/eine zweite Dependency nur fuer die Dauer.
fn parse_ffmpeg_duration(stderr: &str) -> Option<f64> {
    let c = ffmpeg_duration_re().captures(stderr)?;
    let h: f64 = c[1].parse().ok()?;
    let m: f64 = c[2].parse().ok()?;
    let s: f64 = c[3].parse().ok()?;
    Some(h * 3600.0 + m * 60.0 + s)
}

/// Wertet die silencedetect-Filter-Ausgabe aus (Paare aus "silence_start"/
/// "silence_end" in chronologischer Reihenfolge) und liefert (Stille am
/// Anfang, Stille am Ende) in Sekunden. Ein "silence_start" ohne
/// nachfolgendes "silence_end" bedeutet: die Stille laeuft bis zum
/// Dateiende durch (ffmpeg emittiert silence_end nur, wenn die Stille
/// endet, bevor der Stream zu Ende ist).
fn parse_edge_silence(stderr: &str, total_duration: f64) -> (f64, f64) {
    let starts: Vec<f64> = silence_start_re()
        .captures_iter(stderr)
        .filter_map(|c| c[1].parse::<f64>().ok())
        .collect();
    let ends: Vec<f64> = silence_end_re()
        .captures_iter(stderr)
        .filter_map(|c| c[1].parse::<f64>().ok())
        .collect();

    let leading = match (starts.first(), ends.first()) {
        (Some(s), Some(e)) if *s < 0.1 => *e,
        _ => 0.0,
    };

    let trailing = if starts.len() > ends.len() {
        // Letzter silence_start hat kein Ende mehr bekommen -> laeuft bis EOF.
        (total_duration - starts[starts.len() - 1]).max(0.0)
    } else {
        match (starts.last(), ends.last()) {
            (Some(s), Some(e)) if (*e - total_duration).abs() < 0.3 => (total_duration - s).max(0.0),
            _ => 0.0,
        }
    };

    (leading, trailing)
}

const SILENCE_THRESHOLD_SECONDS: f64 = 0.5;

async fn ffmpeg_analyze(app: &tauri::AppHandle, path: &Path) -> Result<(f64, f64, f64), String> {
    use tauri_plugin_shell::ShellExt;
    let output = app
        .shell()
        .command("ffmpeg")
        .args([
            "-i",
            &path.to_string_lossy(),
            "-af",
            "silencedetect=noise=-35dB:d=0.3",
            "-f",
            "null",
            "-",
        ])
        .output()
        .await
        .map_err(|_| FFMPEG_MISSING.to_string())?;
    let stderr = String::from_utf8_lossy(&output.stderr);
    let total = parse_ffmpeg_duration(&stderr).ok_or_else(|| "Audiodauer konnte nicht ermittelt werden.".to_string())?;
    let (leading, trailing) = parse_edge_silence(&stderr, total);
    Ok((leading, trailing, total))
}

fn track_full_path(state: &AppState, playlist: &str, filename: &str) -> Result<std::path::PathBuf, String> {
    crate::commands::safe_join(
        &state.music_root,
        &format!("{}/{}", crate::commands::safe_filename(playlist), filename),
    )
}

/// Scannt alle .mp3-Tracks der Bibliothek auf nennenswerte Stille (>= 0.5s)
/// am Anfang oder Ende. Bewusst NICHT Teil von health_check() - siehe
/// Modul-Kommentar oben.
#[tauri::command]
pub async fn scan_silence(app: tauri::AppHandle, state: tauri::State<'_, AppState>) -> Result<Vec<SilenceHit>, String> {
    if cfg!(target_os = "android") {
        return Err(ANDROID_NO_FFMPEG.into());
    }
    let playlists = crate::commands::list_playlists_inner(&state.music_root);
    let mut hits = Vec::new();
    for pl in &playlists {
        for tr in &pl.tracks {
            if !tr.file.to_lowercase().ends_with(".mp3") {
                continue;
            }
            let Ok(full) = track_full_path(&state, &pl.name, &tr.file) else { continue };
            if !full.is_file() {
                continue;
            }
            if let Ok((leading, trailing, _)) = ffmpeg_analyze(&app, &full).await {
                if leading >= SILENCE_THRESHOLD_SECONDS || trailing >= SILENCE_THRESHOLD_SECONDS {
                    hits.push(SilenceHit {
                        playlist: pl.name.clone(),
                        filename: tr.file.clone(),
                        title: tr.title.clone(),
                        leading,
                        trailing,
                    });
                }
            }
        }
    }
    Ok(hits)
}

/// Schneidet Stille am Anfang/Ende einer einzelnen Datei weg (verlustfreier
/// Stream-Copy-Trim via ffmpeg -ss/-to -c copy, kein Re-Encode noetig - MP3
/// braucht dafuer keine Keyframe-Ausrichtung wie Video). Das Original wird
/// vorher als Kopie in den bestehenden Papierkorb-Index eingetragen (siehe
/// trash.rs) statt einfach ueberschrieben - "Rueckgaengig" ist damit ueber
/// denselben Mechanismus moeglich wie beim normalen Loeschen.
#[tauri::command]
pub async fn trim_silence(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    playlist: String,
    filename: String,
) -> Result<String, String> {
    if cfg!(target_os = "android") {
        return Err(ANDROID_NO_FFMPEG.into());
    }
    let full = track_full_path(&state, &playlist, &filename)?;
    if !full.is_file() {
        return Err("Datei nicht gefunden.".into());
    }
    let (leading, trailing, total) = ffmpeg_analyze(&app, &full).await?;
    if leading < SILENCE_THRESHOLD_SECONDS && trailing < SILENCE_THRESHOLD_SECONDS {
        return Err("Keine nennenswerte Stille gefunden.".into());
    }
    let end = (total - trailing).max(leading);

    use tauri_plugin_shell::ShellExt;
    let tmp = full.with_extension("trim_tmp.mp3");
    let out = app
        .shell()
        .command("ffmpeg")
        .args([
            "-y",
            "-i",
            &full.to_string_lossy(),
            "-ss",
            &leading.to_string(),
            "-to",
            &end.to_string(),
            "-c",
            "copy",
            &tmp.to_string_lossy(),
        ])
        .output()
        .await
        .map_err(|e| e.to_string())?;
    if !out.status.success() || !tmp.is_file() {
        let _ = std::fs::remove_file(&tmp);
        return Err("Trimmen fehlgeschlagen.".into());
    }

    std::fs::create_dir_all(&state.trash_dir).map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let backup_dest = state.trash_dir.join(format!("{id}.mp3"));
    if let Err(e) = std::fs::copy(&full, &backup_dest) {
        let _ = std::fs::remove_file(&tmp);
        return Err(e.to_string());
    }
    let trashed_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0);
    let mut entries = crate::trash::load_index(&state.trash_index_file);
    entries.push(crate::trash::TrashEntry {
        id: id.clone(),
        filename: filename.clone(),
        playlist: playlist.clone(),
        trashed_at,
    });
    crate::trash::save_index(&state.trash_index_file, &entries);

    std::fs::rename(&tmp, &full).map_err(|e| e.to_string())?;
    // Getrimmte Datei ist eine andere Datei - abgeleitete Zwischenstaende
    // (Cover-Cache, ReplayGain-Messwert) muessen neu entstehen.
    invalidate_derived_data(&state, &playlist, &filename, &full);
    Ok(id)
}

/// Macht trim_silence rueckgaengig - siehe restore_backup_over_track weiter
/// unten, dieselbe Umsetzung nutzt auch das Qualitaets-Upgrade.
#[tauri::command]
pub fn undo_trim_silence(
    state: tauri::State<AppState>,
    trash_id: String,
    playlist: String,
    filename: String,
) -> Result<(), String> {
    restore_backup_over_track(&state, &trash_id, &playlist, &filename)
}

/* ===== Lautstaerke-Normalisierung (echtes ReplayGain) =====
   Vorher machte das nur ein DynamicsCompressorNode im Frontend: Echtzeit-
   Leveling ohne jede Vorab-Analyse. Das nimmt zwar die groebsten Spruenge
   raus, veraendert aber die Dynamik JEDES Songs dauerhaft (leise Stellen
   werden mit hochgezogen) und kann per Definition nicht wissen, wie laut
   ein Song insgesamt gemeistert ist.

   Jetzt: ffmpegs loudnorm-Filter misst pro Datei einmal die integrierte
   Lautheit (LUFS) und den True-Peak, daraus faellt EIN Korrekturwert in dB
   pro Track ab. Den legt das Frontend auf einen eigenen GainNode - die
   Dynamik im Song bleibt unangetastet, nur das Gesamtniveau wird
   angeglichen. Gemessen wird nur auf ausdruecklichen Knopfdruck (ein
   kompletter Decode pro Track ist zu teuer fuer einen Automatismus), das
   Ergebnis landet in loudness.json im App-Datenverzeichnis und ueberlebt
   damit Neustarts.

   ffmpeg-Abhaengigkeit + Android-Ausschluss: exakt wie beim Auto-Trim
   oben, siehe dortigen Kommentar. */

#[derive(Serialize, serde::Deserialize, Clone, Copy)]
pub struct LoudnessEntry {
    /// Korrektur in dB, die das Frontend auf den Track legen soll.
    pub gain_db: f64,
    /// Gemessene integrierte Lautheit (LUFS) - nur zur Anzeige/Diagnose.
    pub lufs: f64,
    /// Gemessener True-Peak (dBTP) - nur zur Anzeige/Diagnose.
    pub peak_db: f64,
}

pub type LoudnessMap = std::collections::HashMap<String, LoudnessEntry>;

/// Referenzpegel nach ReplayGain 2.0. Bewusst nicht die -14 LUFS der
/// Streaming-Dienste: die Bibliothek wird lokal ueber die eigene
/// Systemlautstaerke gehoert, und -18 laesst mehr Headroom, sodass fuer
/// laute Tracks seltener stark heruntergeregelt werden muss.
const LOUDNESS_TARGET_LUFS: f64 = -18.0;
/// Ueber diesen True-Peak wird nie hochverstaerkt (Clipping-Schutz).
const LOUDNESS_PEAK_CEILING_DB: f64 = -1.0;
/// Deckel gegen Ausreisser: eine kaputt gemasterte oder fast stille Datei
/// soll nicht mit +25 dB ins Ohr springen.
const LOUDNESS_MAX_GAIN_DB: f64 = 12.0;

fn loudness_file(state: &AppState) -> std::path::PathBuf {
    state.data_dir.join("loudness.json")
}

pub(crate) fn load_loudness(state: &AppState) -> LoudnessMap {
    std::fs::read_to_string(loudness_file(state))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_loudness(state: &AppState, map: &LoudnessMap) {
    let _ = std::fs::create_dir_all(&state.data_dir);
    if let Ok(s) = serde_json::to_string(map) {
        let _ = std::fs::write(loudness_file(state), s);
    }
}

/// Schluessel eines Tracks in loudness.json. Playlist + Dateiname, weil
/// dieselbe Datei in zwei Playlists liegen darf und dann zweimal (aber
/// identisch) gemessen wird - eine reine Dateinamen-Kennung waere dagegen
/// zwischen zwei wirklich verschiedenen Songs kollisionsgefaehrdet.
pub(crate) fn loudness_key(playlist: &str, filename: &str) -> String {
    format!("{playlist}/{filename}")
}

/// Zieht die Messwerte aus loudnorms JSON-Block. Der steht mitten in
/// ffmpegs stderr (danach kommen noch Zusammenfassungszeilen), deshalb
/// wird gezielt der Block um "input_i" herum ausgeschnitten statt einfach
/// die letzte geschweifte Klammer im Text zu nehmen.
fn parse_loudnorm_json(stderr: &str) -> Option<(f64, f64)> {
    let marker = stderr.find("\"input_i\"")?;
    let start = stderr[..marker].rfind('{')?;
    let end = start + stderr[start..].find('}')?;
    let v: serde_json::Value = serde_json::from_str(&stderr[start..=end]).ok()?;
    // Achtung: eine komplett stille Datei liefert "-inf", und Rusts
    // f64::from_str parst genau das erfolgreich zu f64::NEG_INFINITY. Ohne
    // die is_finite()-Pruefung waere der Korrekturwert dafuer rechnerisch
    // +inf und wuerde am Deckel zu vollen +12 dB - fuer eine stumme Datei.
    let num = |key: &str| -> Option<f64> {
        let n = v.get(key)?.as_str()?.trim().parse::<f64>().ok()?;
        n.is_finite().then_some(n)
    };
    Some((num("input_i")?, num("input_tp")?))
}

/// Absenken ist immer erlaubt, Anheben nur so weit, wie der True-Peak noch
/// Luft bis LOUDNESS_PEAK_CEILING_DB hat - sonst wuerde ein leise
/// gemasterter, aber bis Vollaussteuerung gepeakter Track beim Anheben
/// clippen.
fn gain_for(lufs: f64, peak_db: f64) -> f64 {
    let raw = LOUDNESS_TARGET_LUFS - lufs;
    let gain = if raw > 0.0 {
        raw.min((LOUDNESS_PEAK_CEILING_DB - peak_db).max(0.0))
    } else {
        raw
    };
    gain.clamp(-LOUDNESS_MAX_GAIN_DB, LOUDNESS_MAX_GAIN_DB)
}

async fn ffmpeg_loudness(app: &tauri::AppHandle, path: &Path) -> Result<LoudnessEntry, String> {
    use tauri_plugin_shell::ShellExt;
    let output = app
        .shell()
        .command("ffmpeg")
        .args([
            "-nostdin",
            "-i",
            &path.to_string_lossy(),
            "-af",
            &format!("loudnorm=I={LOUDNESS_TARGET_LUFS}:print_format=json"),
            "-f",
            "null",
            "-",
        ])
        .output()
        .await
        .map_err(|_| FFMPEG_MISSING.to_string())?;
    let stderr = String::from_utf8_lossy(&output.stderr);
    let (lufs, peak_db) = parse_loudnorm_json(&stderr).ok_or_else(|| "Lautheit konnte nicht gemessen werden.".to_string())?;
    Ok(LoudnessEntry { gain_db: gain_for(lufs, peak_db), lufs, peak_db })
}

#[derive(Serialize)]
pub struct LoudnessScanResult {
    pub analyzed: usize,
    pub skipped: usize,
    pub failed: usize,
    pub gains: LoudnessMap,
}

/// Misst jeden noch nicht vermessenen Track der Bibliothek. `rescan=true`
/// wirft die alten Werte weg und misst alles neu (z.B. nachdem Tracks per
/// Trim/Qualitaets-Upgrade veraendert wurden).
///
/// Der Fortschritt geht als "loudness-progress"-Event ans Frontend - ein
/// Durchlauf ueber eine groessere Bibliothek dauert Minuten, ein
/// wortloses, minutenlang haengendes invoke() waere nicht zumutbar.
#[tauri::command]
pub async fn scan_loudness(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    rescan: bool,
) -> Result<LoudnessScanResult, String> {
    use tauri::Emitter;
    if cfg!(target_os = "android") {
        return Err(ANDROID_NO_FFMPEG.into());
    }
    let mut map = if rescan { LoudnessMap::new() } else { load_loudness(&state) };
    let playlists = crate::commands::list_playlists_inner(&state.music_root);

    let todo: Vec<(String, String)> = playlists
        .iter()
        .flat_map(|pl| pl.tracks.iter().map(move |tr| (pl.name.clone(), tr.file.clone())))
        .filter(|(pl, file)| !map.contains_key(&loudness_key(pl, file)))
        .collect();
    let total = todo.len();

    let (mut analyzed, mut failed) = (0usize, 0usize);
    for (i, (playlist, filename)) in todo.into_iter().enumerate() {
        let _ = app.emit(
            "loudness-progress",
            serde_json::json!({ "done": i, "total": total, "file": filename }),
        );
        let Ok(full) = track_full_path(&state, &playlist, &filename) else {
            failed += 1;
            continue;
        };
        if !full.is_file() {
            failed += 1;
            continue;
        }
        match ffmpeg_loudness(&app, &full).await {
            Ok(entry) => {
                map.insert(loudness_key(&playlist, &filename), entry);
                analyzed += 1;
            }
            // Ein einzelner kaputter/nicht dekodierbarer Track darf den
            // ganzen Durchlauf nicht abbrechen - fehlendes ffmpeg schon,
            // sonst laeuft der Scan sinnlos ueber die ganze Bibliothek.
            Err(e) if e == FFMPEG_MISSING => return Err(e),
            Err(_) => failed += 1,
        }
    }

    save_loudness(&state, &map);
    let _ = app.emit("loudness-progress", serde_json::json!({ "done": total, "total": total, "file": "" }));
    Ok(LoudnessScanResult { analyzed, skipped: map.len() - analyzed, failed, gains: map })
}

/// Die gespeicherten Werte, die das Frontend beim Start einmal einliest.
#[tauri::command]
pub fn get_loudness(state: tauri::State<AppState>) -> LoudnessMap {
    load_loudness(&state)
}

/* ===== Qualitaets-Upgrade-Scan =====
   Findet Tracks, die als schlechte Kopie in der Bibliothek gelandet sind
   (z.B. ein 96-kbps-Rip, weil damals nichts Besseres verfuegbar war), und
   holt ueber dieselbe Discovery-Logik wie beim normalen Download eine
   bessere Quelle nach - bevorzugt einen "- Topic"-Upload, also YouTube
   Musics automatisch erzeugte, reine Audiospur.

   Bewusst nur .mp3: der Ersatz behaelt zwingend den ALTEN Dateinamen, denn
   an dem haengen Playlist-Reihenfolge, Wiedergabe-Zaehler, Verlauf, die
   ReplayGain-Messwerte und saemtliche Sidecars. Eine .m4a durch eine .mp3
   zu ersetzen wuerde den Namen aendern und all das reissen. */

#[derive(Serialize, Clone)]
pub struct LowQualityHit {
    pub playlist: String,
    pub filename: String,
    pub title: String,
    pub artist: String,
    pub kbps: u32,
}

/// Unterhalb dieser Rate gilt ein Track als aufwertbar. 192 ist die
/// Grenze, ab der ein MP3 gemeinhin als "transparent genug" durchgeht -
/// darunter hoert man Artefakte auf ordentlichen Kopfhoerern.
const LOW_BITRATE_KBPS: u32 = 192;

fn audio_bitrate_re() -> &'static Regex {
    static CELL: OnceLock<Regex> = OnceLock::new();
    // Bewusst die "Stream ... Audio:"-Zeile und nicht die "bitrate:"-Angabe
    // der Duration-Kopfzeile: letztere ist die Container-Gesamtrate (bei
    // einer 128er-MP3 z.B. 130 kb/s, inkl. Tag-/Framing-Overhead) und bei
    // einer Datei mit Videospur voellig danebenliegend.
    CELL.get_or_init(|| Regex::new(r"Audio:[^\n]*?(\d+)\s*kb/s").unwrap())
}

fn parse_audio_bitrate(stderr: &str) -> Option<u32> {
    audio_bitrate_re().captures(stderr)?[1].parse().ok()
}

async fn ffmpeg_bitrate(app: &tauri::AppHandle, path: &Path) -> Result<u32, String> {
    use tauri_plugin_shell::ShellExt;
    let output = app
        .shell()
        .command("ffmpeg")
        .args(["-nostdin", "-i", &path.to_string_lossy(), "-f", "null", "-"])
        .output()
        .await
        .map_err(|_| FFMPEG_MISSING.to_string())?;
    parse_audio_bitrate(&String::from_utf8_lossy(&output.stderr))
        .ok_or_else(|| "Bitrate konnte nicht gelesen werden.".to_string())
}

/// Listet alle .mp3-Tracks unterhalb von LOW_BITRATE_KBPS. Reines Lesen
/// der ffmpeg-Kopfzeilen, kein Decoding - deutlich schneller als der
/// Lautheits-Scan, aber aus demselben Grund trotzdem ein eigener Knopf.
#[tauri::command]
pub async fn scan_bitrates(app: tauri::AppHandle, state: tauri::State<'_, AppState>) -> Result<Vec<LowQualityHit>, String> {
    use tauri::Emitter;
    if cfg!(target_os = "android") {
        return Err(ANDROID_NO_FFMPEG.into());
    }
    let playlists = crate::commands::list_playlists_inner(&state.music_root);
    let all: Vec<_> = playlists
        .iter()
        .flat_map(|pl| pl.tracks.iter().map(move |tr| (pl.name.clone(), tr.clone())))
        .filter(|(_, tr)| tr.file.to_lowercase().ends_with(".mp3"))
        .collect();
    let total = all.len();

    let mut hits = Vec::new();
    for (i, (playlist, tr)) in all.into_iter().enumerate() {
        let _ = app.emit("bitrate-progress", serde_json::json!({ "done": i, "total": total, "file": tr.file }));
        let Ok(full) = track_full_path(&state, &playlist, &tr.file) else { continue };
        if !full.is_file() {
            continue;
        }
        match ffmpeg_bitrate(&app, &full).await {
            Ok(kbps) if kbps < LOW_BITRATE_KBPS => hits.push(LowQualityHit {
                playlist,
                filename: tr.file.clone(),
                title: tr.title.clone(),
                artist: tr.artist.clone(),
                kbps,
            }),
            Ok(_) => {}
            Err(e) if e == FFMPEG_MISSING => return Err(e),
            Err(_) => {}
        }
    }
    let _ = app.emit("bitrate-progress", serde_json::json!({ "done": total, "total": total, "file": "" }));
    Ok(hits)
}

#[derive(Serialize)]
pub struct UpgradeResult {
    pub trash_id: String,
    pub old_kbps: u32,
    pub new_kbps: u32,
    pub source_title: String,
}

/// Sucht die beste Audio-Quelle zum Track und ersetzt die Datei damit -
/// aber nur, wenn sie wirklich besser ist. Das Original wandert vorher als
/// Kopie in den Papierkorb-Index, "Rueckgaengig" laeuft also ueber
/// denselben Weg wie beim Auto-Trim.
#[tauri::command]
pub async fn upgrade_track(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    playlist: String,
    filename: String,
    title: String,
    artist: String,
) -> Result<UpgradeResult, String> {
    use tauri_plugin_shell::ShellExt;
    if cfg!(target_os = "android") {
        return Err(ANDROID_NO_FFMPEG.into());
    }
    if !filename.to_lowercase().ends_with(".mp3") {
        return Err("Nur MP3-Dateien koennen aufgewertet werden.".into());
    }
    let full = track_full_path(&state, &playlist, &filename)?;
    if !full.is_file() {
        return Err("Datei nicht gefunden.".into());
    }
    let old_kbps = ffmpeg_bitrate(&app, &full).await?;

    // Dauer der VORHANDENEN Datei als Vergleichswert: hier wird die eigene
    // Datei ersetzt, ein Treffer auf eine andere Aufnahme (Live-Mitschnitt,
    // Extended Mix, anderer Song mit gleichem Namen) waere also nicht bloss
    // ein schlechter Download, sondern stiller Datenverlust.
    let eigene_dauer = crate::commands::read_track_meta(&full).duration;
    let best = crate::discovery::best_audio_match(&app, &title, &artist, eigene_dauer)
        .await
        .ok_or_else(|| "Keine passende Quelle gefunden.".to_string())?;

    // In eine Nebendatei laden: schlaegt der Download fehl oder ist das
    // Ergebnis nicht besser, bleibt das Original voellig unangetastet.
    let tmp = full.with_extension("upgrade_tmp.mp3");
    let tmp_template = full.with_extension("upgrade_tmp.%(ext)s");
    let _ = std::fs::remove_file(&tmp);

    let mut last_err = String::new();
    let mut ok = false;
    for attempt in &crate::commands::build_attempts("mp3", "320", "best") {
        let args = crate::commands::build_ytdlp_args(&tmp_template, &best.video_id, "mp3", attempt);
        let out = match app.shell().sidecar("yt-dlp") {
            Ok(cmd) => cmd.args(args).output().await.map_err(|e| e.to_string()),
            Err(e) => Err(e.to_string()),
        };
        match out {
            Ok(o) if o.status.success() && tmp.is_file() => {
                ok = true;
                break;
            }
            Ok(o) => last_err = String::from_utf8_lossy(&o.stderr).to_string(),
            Err(e) => last_err = e,
        }
    }
    if !ok {
        let _ = std::fs::remove_file(&tmp);
        return Err(crate::commands::friendly_download_error(&last_err));
    }

    let new_kbps = match ffmpeg_bitrate(&app, &tmp).await {
        Ok(k) => k,
        Err(e) => {
            let _ = std::fs::remove_file(&tmp);
            return Err(e);
        }
    };
    if new_kbps <= old_kbps {
        let _ = std::fs::remove_file(&tmp);
        return Err(format!(
            "Keine bessere Quelle gefunden (beste gefundene Fassung: {new_kbps} kbps, vorhanden: {old_kbps} kbps)."
        ));
    }

    // Original sichern, danach erst ersetzen.
    std::fs::create_dir_all(&state.trash_dir).map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    if let Err(e) = std::fs::copy(&full, state.trash_dir.join(format!("{id}.mp3"))) {
        let _ = std::fs::remove_file(&tmp);
        return Err(e.to_string());
    }
    let trashed_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0);
    let mut entries = crate::trash::load_index(&state.trash_index_file);
    entries.push(crate::trash::TrashEntry {
        id: id.clone(),
        filename: filename.clone(),
        playlist: playlist.clone(),
        trashed_at,
    });
    crate::trash::save_index(&state.trash_index_file, &entries);

    std::fs::rename(&tmp, &full).map_err(|e| e.to_string())?;
    invalidate_derived_data(&state, &playlist, &filename, &full);

    Ok(UpgradeResult {
        trash_id: id,
        old_kbps,
        new_kbps,
        source_title: best.title,
    })
}

/// Nach einem Datei-Austausch gelten zwei zwischengespeicherte Sachen
/// nicht mehr, obwohl der Dateiname gleich blieb: der aus der ALTEN Datei
/// extrahierte Cover-Cache und der an ihr gemessene ReplayGain-Wert. Beide
/// hier wegwerfen, damit sie beim naechsten Zugriff frisch entstehen -
/// sonst zeigt die Bibliothek das Cover der alten Fassung und der Player
/// korrigiert die neue mit einem Wert, der zu ihr gar nicht passt.
fn invalidate_derived_data(state: &AppState, playlist: &str, filename: &str, full: &Path) {
    let _ = std::fs::remove_file(full.with_extension("cover_cache.jpg"));
    let mut gains = load_loudness(state);
    if gains.remove(&loudness_key(playlist, filename)).is_some() {
        save_loudness(state, &gains);
    }
}

/// Gemeinsame Umsetzung fuer "Rueckgaengig" nach Trim und nach Upgrade:
/// die gesicherte Original-Kopie ersetzt die veraenderte Datei an
/// derselben Stelle. Bewusst NICHT der normale restore_trash-Weg - der
/// wuerde bei einem noch existierenden Ziel-Dateinamen stattdessen
/// "Song (2).mp3" danebenlegen, statt die Aenderung zurueckzunehmen.
fn restore_backup_over_track(
    state: &AppState,
    trash_id: &str,
    playlist: &str,
    filename: &str,
) -> Result<(), String> {
    let backup = state.trash_dir.join(format!("{trash_id}.mp3"));
    if !backup.is_file() {
        return Err("Sicherung nicht mehr vorhanden.".into());
    }
    let full = track_full_path(state, playlist, filename)?;
    std::fs::rename(&backup, &full).map_err(|e| e.to_string())?;
    invalidate_derived_data(state, playlist, filename, &full);
    let mut entries = crate::trash::load_index(&state.trash_index_file);
    entries.retain(|e| e.id != trash_id);
    crate::trash::save_index(&state.trash_index_file, &entries);
    Ok(())
}

#[tauri::command]
pub fn undo_upgrade_track(
    state: tauri::State<AppState>,
    trash_id: String,
    playlist: String,
    filename: String,
) -> Result<(), String> {
    restore_backup_over_track(&state, &trash_id, &playlist, &filename)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Echte ffmpeg-Ausgabe (silencedetect=noise=-35dB:d=0.3) fuer eine
    // synthetische Testdatei aus 1s Stille + 2s Ton + 1.5s Stille - per Hand
    // gegen ein reales ffmpeg verifiziert, nicht ausgedacht.
    const SAMPLE_STDERR: &str = "Input #0, mp3, from 'test_silence.mp3':\n  Duration: 00:00:04.50, start: 0.023021, bitrate: 128 kb/s\n[Parsed_silencedetect_0 @ 0000000000000000] silence_start: 0\n[Parsed_silencedetect_0 @ 0000000000000000] silence_end: 1.000091 | silence_duration: 1.000091\n[Parsed_silencedetect_0 @ 0000000000000000] silence_start: 2.999977\n[Parsed_silencedetect_0 @ 0000000000000000] silence_end: 4.5 | silence_duration: 1.500023\n";

    #[test]
    fn parses_duration_from_ffmpeg_header() {
        assert_eq!(parse_ffmpeg_duration(SAMPLE_STDERR), Some(4.5));
    }

    #[test]
    fn detects_leading_and_trailing_silence() {
        let (leading, trailing) = parse_edge_silence(SAMPLE_STDERR, 4.5);
        assert!((leading - 1.000091).abs() < 0.001);
        assert!((trailing - 1.500023).abs() < 0.001);
    }

    #[test]
    fn no_silence_markers_means_no_edge_silence() {
        let stderr = "Input #0, mp3, from 'x.mp3':\n  Duration: 00:00:03.00, start: 0.0, bitrate: 128 kb/s\n";
        assert_eq!(parse_edge_silence(stderr, 3.0), (0.0, 0.0));
    }

    #[test]
    fn dangling_silence_start_runs_to_end_of_file() {
        // Stille beginnt, aber die Datei endet mittendrin - ffmpeg emittiert
        // dann nie ein silence_end dafuer.
        let stderr = "Duration: 00:00:05.00, start: 0.0\nsilence_start: 3.5\n";
        let (leading, trailing) = parse_edge_silence(stderr, 5.0);
        assert_eq!(leading, 0.0);
        assert!((trailing - 1.5).abs() < 0.001);
    }

    #[test]
    fn silence_only_in_the_middle_is_not_counted_as_edge_silence() {
        // silence_start liegt nicht bei ~0 und silence_end nicht nahe der
        // Gesamtdauer -> weder Anfang noch Ende betroffen.
        let stderr = "Duration: 00:00:10.00, start: 0.0\nsilence_start: 4.0\nsilence_end: 4.8 | silence_duration: 0.8\n";
        assert_eq!(parse_edge_silence(stderr, 10.0), (0.0, 0.0));
    }

    // Echte ffmpeg-8-Ausgabe (loudnorm=I=-18:print_format=json) fuer eine
    // synthetische 440-Hz-Testdatei bei -12 dB - per Hand gegen ein reales
    // ffmpeg verifiziert, nicht ausgedacht. Wichtig fuer den Parser: nach
    // dem JSON-Block kommen noch weitere ffmpeg-Zeilen, der Block ist also
    // NICHT einfach "alles ab der letzten geschweiften Klammer".
    const SAMPLE_LOUDNORM: &str = "  Stream #0:0: Audio: pcm_s16le, 192000 Hz, mono\n[Parsed_loudnorm_0 @ 00000000007281c0] \n{\n\t\"input_i\" : \"-34.25\",\n\t\"input_tp\" : \"-30.49\",\n\t\"input_lra\" : \"0.00\",\n\t\"input_thresh\" : \"-44.25\",\n\t\"output_i\" : \"-17.95\",\n\t\"normalization_type\" : \"dynamic\",\n\t\"target_offset\" : \"-0.05\"\n}\n[out#0/null @ 00000000007283c0] video:0KiB audio:1125KiB\nsize=N/A time=00:00:03.00 bitrate=N/A speed=95x\n";

    #[test]
    fn parses_loudnorm_measurements() {
        let (lufs, peak) = parse_loudnorm_json(SAMPLE_LOUDNORM).unwrap();
        assert!((lufs - (-34.25)).abs() < 0.001);
        assert!((peak - (-30.49)).abs() < 0.001);
    }

    #[test]
    fn loudnorm_parser_rejects_output_without_measurements() {
        assert!(parse_loudnorm_json("kein json hier").is_none());
        // Voellig stille Datei: ffmpeg liefert "-inf", nicht parsebar.
        assert!(parse_loudnorm_json("{\n\"input_i\" : \"-inf\",\n\"input_tp\" : \"-inf\"\n}").is_none());
    }

    #[test]
    fn quiet_track_gets_boosted_towards_target() {
        // -34.25 LUFS liegt 16.25 dB unter dem -18er Ziel, der Peak laesst
        // mit -30.49 dBTP reichlich Luft - begrenzt also nur der Deckel.
        let gain = gain_for(-34.25, -30.49);
        assert!((gain - LOUDNESS_MAX_GAIN_DB).abs() < 0.001, "gain war {gain}");
    }

    #[test]
    fn loud_track_gets_turned_down() {
        // Modernes lautes Mastering: -6 LUFS -> 12 dB leiser.
        let gain = gain_for(-6.0, -0.1);
        assert!((gain - (-12.0)).abs() < 0.001, "gain war {gain}");
    }

    #[test]
    fn boost_is_capped_by_available_true_peak_headroom() {
        // Leise gemastert (-24 LUFS, waeren +6 dB), aber schon bis 0 dBTP
        // ausgesteuert: mehr als bis -1 dBTP darf nicht angehoben werden.
        let gain = gain_for(-24.0, 0.0);
        assert!(gain.abs() < 0.001, "gain war {gain}");
    }

    #[test]
    fn attenuation_is_never_blocked_by_peak_headroom() {
        // Absenken kann nie clippen - der fehlende Headroom darf hier also
        // nichts begrenzen (sonst wuerde ein zu lauter Track laut bleiben).
        let gain = gain_for(-8.0, 0.5);
        assert!((gain - (-10.0)).abs() < 0.001, "gain war {gain}");
    }

    #[test]
    fn track_at_reference_level_needs_no_correction() {
        assert!(gain_for(LOUDNESS_TARGET_LUFS, -3.0).abs() < 0.001);
    }

    // Echte ffmpeg-8-Kopfzeilen dreier per Hand erzeugter Testdateien
    // (96k CBR / 320k CBR / VBR), gegen ein reales ffmpeg verifiziert.
    const HDR_96: &str = "  Duration: 00:00:02.00, start: 0.025057, bitrate: 99 kb/s\n  Stream #0:0: Audio: mp3 (mp3float), 44100 Hz, mono, fltp, 96 kb/s, start 0.025057\n";
    const HDR_320: &str = "  Duration: 00:00:02.00, start: 0.025057, bitrate: 330 kb/s\n  Stream #0:0: Audio: mp3 (mp3float), 44100 Hz, mono, fltp, 320 kb/s, start 0.025057\n";

    #[test]
    fn reads_audio_stream_bitrate_not_container_bitrate() {
        // Die Container-Angabe der Duration-Zeile (99 bzw. 330) enthaelt
        // Tag-/Framing-Overhead - gefragt ist die reine Audiorate.
        assert_eq!(parse_audio_bitrate(HDR_96), Some(96));
        assert_eq!(parse_audio_bitrate(HDR_320), Some(320));
    }

    #[test]
    fn low_bitrate_threshold_separates_upgradable_from_fine() {
        assert!(parse_audio_bitrate(HDR_96).unwrap() < LOW_BITRATE_KBPS);
        assert!(parse_audio_bitrate(HDR_320).unwrap() >= LOW_BITRATE_KBPS);
    }

    #[test]
    fn bitrate_parser_ignores_video_stream_line() {
        // Bei einer Datei mit Videospur darf nicht deren (viel hoehere)
        // Rate als Audioqualitaet durchgehen.
        let stderr = "  Stream #0:0: Video: h264, yuv420p, 1920x1080, 2500 kb/s\n  Stream #0:1: Audio: aac (LC), 44100 Hz, stereo, fltp, 128 kb/s\n";
        assert_eq!(parse_audio_bitrate(stderr), Some(128));
    }

    #[test]
    fn bitrate_parser_returns_none_without_audio_line() {
        assert_eq!(parse_audio_bitrate("  Duration: 00:00:02.00, bitrate: 99 kb/s\n"), None);
    }

    fn temp_dir() -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("mm_health_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn finds_sidecar_without_matching_track() {
        let dir = temp_dir();
        std::fs::write(dir.join("Orphan.jpg"), b"x").unwrap();

        let found = find_orphaned_sidecars_in(&dir, "MyPlaylist");

        assert_eq!(found.len(), 1);
        assert_eq!(found[0].filename, "Orphan.jpg");
        assert_eq!(found[0].playlist, "MyPlaylist");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn ignores_sidecar_with_matching_track() {
        let dir = temp_dir();
        std::fs::write(dir.join("Song.mp3"), b"x").unwrap();
        std::fs::write(dir.join("Song.jpg"), b"x").unwrap();
        std::fs::write(dir.join("Song.lyrics.json"), b"x").unwrap();

        let found = find_orphaned_sidecars_in(&dir, "MyPlaylist");

        assert!(found.is_empty());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn distinguishes_cover_cache_suffix_from_plain_jpg() {
        let dir = temp_dir();
        std::fs::write(dir.join("Song.m4a"), b"x").unwrap();
        // .cover_cache.jpg gehoert zu "Song" (Track existiert -> kein Waisenkind).
        std::fs::write(dir.join("Song.cover_cache.jpg"), b"x").unwrap();
        // Ein zweites, komplett unabhaengiges .jpg ohne Track dazu.
        std::fs::write(dir.join("Leftover.jpg"), b"x").unwrap();

        let found = find_orphaned_sidecars_in(&dir, "MyPlaylist");

        assert_eq!(found.len(), 1);
        assert_eq!(found[0].filename, "Leftover.jpg");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn ignores_non_sidecar_files() {
        let dir = temp_dir();
        std::fs::write(dir.join("random.txt"), b"x").unwrap();

        let found = find_orphaned_sidecars_in(&dir, "MyPlaylist");

        assert!(found.is_empty());
        std::fs::remove_dir_all(&dir).ok();
    }
}
