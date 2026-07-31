// Umschaltbares App-Symbol (dunkle/helle Fassung des Reson-Zeichens).
//
// WICHTIG, damit die Erwartung stimmt: was hier zur Laufzeit umgeschaltet
// wird, ist das Symbol des laufenden FENSTERS - Titelleiste, Taskleiste,
// Alt+Tab. Das Symbol der installierten Anwendung (Verknuepfung, Startmenue,
// die .exe selbst, das Android-Startbildschirm-Symbol) steckt fest in der
// gebauten Datei bzw. im Paket und kann von einem laufenden Programm gar
// nicht geaendert werden - dafuer zaehlt allein, welches Bild beim Bauen
// eingebettet wurde. Standard ist dort die dunkle Fassung
// (icons-source.png, siehe tauri.conf.json + CI).
//
// Beide Fassungen kommen aus denselben beiden Quellbildern, aus denen auch
// `tauri icon` alle Paketformate ableitet - so gibt es genau eine Wahrheit
// und keine Kopie, die irgendwann auseinanderlaeuft.

#[cfg(desktop)]
const ICON_DUNKEL: &[u8] = include_bytes!("../../icons-source.png");
#[cfg(desktop)]
const ICON_HELL: &[u8] = include_bytes!("../../icons-source-hell.png");

/// Fenster-Symbol auf "dunkel" (Standard) oder "hell" setzen.
///
/// Auf Android gibt es kein Fenster-Symbol - der Aufruf ist dort bewusst
/// wirkungslos statt ein Fehler, damit das Frontend nicht pro Plattform
/// unterscheiden muss.
#[tauri::command]
pub fn set_app_icon(window: tauri::Window, variant: String) -> Result<(), String> {
    #[cfg(desktop)]
    {
        use image::GenericImageView;
        let bytes = if variant == "hell" { ICON_HELL } else { ICON_DUNKEL };
        let img = image::load_from_memory(bytes).map_err(|e| e.to_string())?;
        // Die Quellbilder sind 1024x1024 - als Fenster-Symbol ist das
        // unnoetig gross (4 MB roh). 256 reicht fuer jede Stelle, an der
        // das Symbol auftaucht, und wird von Windows/GTK ohnehin
        // heruntergerechnet.
        let img = if img.dimensions().0 > 256 {
            img.resize_exact(256, 256, image::imageops::FilterType::Lanczos3)
        } else {
            img
        };
        let rgba = img.to_rgba8();
        let (w, h) = rgba.dimensions();
        window
            .set_icon(tauri::image::Image::new_owned(rgba.into_raw(), w, h))
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(desktop))]
    {
        let _ = (&window, &variant);
    }
    Ok(())
}
