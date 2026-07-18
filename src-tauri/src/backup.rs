use crate::commands::AppState;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

/// Recursively adds every file under `dir` to `zip`, with paths relative to
/// `root` (so the archive, unpacked anywhere, reproduces the same
/// Playlist/Datei-Struktur as music_root itself).
fn add_dir_to_zip<W: Write + std::io::Seek>(
    zip: &mut zip::ZipWriter<W>,
    root: &Path,
    dir: &Path,
    options: zip::write::SimpleFileOptions,
) -> Result<(), String> {
    let entries = std::fs::read_dir(dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            add_dir_to_zip(zip, root, &path, options)?;
        } else {
            let rel = path.strip_prefix(root).map_err(|e| e.to_string())?;
            // ZIP-Pfade sind immer "/"-getrennt, unabhaengig vom OS.
            let rel_str = rel.to_string_lossy().replace('\\', "/");
            zip.start_file(rel_str, options).map_err(|e| e.to_string())?;
            let mut f = std::fs::File::open(&path).map_err(|e| e.to_string())?;
            std::io::copy(&mut f, zip).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// Zippt die komplette Bibliothek (alle Playlist-Ordner samt Audiodateien
/// und Cover-Sidecars) an den vom Nutzer per Speichern-Dialog gewaehlten
/// Pfad - laeuft in einem Blocking-Thread, weil ZipWriter synchron ist und
/// eine grosse Bibliothek durchaus laenger dauert.
#[tauri::command]
pub async fn export_library_zip(state: tauri::State<'_, AppState>, dest_path: String) -> Result<(), String> {
    let root = state.music_root.clone();
    tokio::task::spawn_blocking(move || {
        let file = std::fs::File::create(&dest_path).map_err(|e| e.to_string())?;
        let mut zip = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        add_dir_to_zip(&mut zip, &root, &root, options)?;
        zip.finish().map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Entpackt ein zuvor mit export_library_zip erstelltes Backup zurueck in
/// die Bibliothek. Ueberschreibt NIE eine bestehende Datei (Backup wird
/// zum Wiederherstellen auf einem neuen/leeren Geraet gedacht, nicht zum
/// Zurueckrollen ueber eine aktuelle Bibliothek) - Namenskollisionen
/// werden uebersprungen und gezaehlt statt einfach zu ueberschreiben.
#[tauri::command]
pub async fn import_library_zip(state: tauri::State<'_, AppState>, src_path: String) -> Result<u32, String> {
    let root = state.music_root.clone();
    tokio::task::spawn_blocking(move || {
        let file = std::fs::File::open(&src_path).map_err(|e| e.to_string())?;
        let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
        let mut imported = 0u32;
        for i in 0..archive.len() {
            let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
            if entry.is_dir() {
                continue;
            }
            let rel: PathBuf = match entry.enclosed_name() {
                Some(p) => p,
                None => continue, // Path-Traversal-Eintrag (zip slip) - ueberspringen
            };
            let dest = root.join(&rel);
            if dest.exists() {
                continue;
            }
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut buf = Vec::new();
            entry.read_to_end(&mut buf).map_err(|e| e.to_string())?;
            std::fs::write(&dest, &buf).map_err(|e| e.to_string())?;
            imported += 1;
        }
        Ok(imported)
    })
    .await
    .map_err(|e| e.to_string())?
}
