use crate::commands::AppState;
use serde::Serialize;
use std::collections::HashMap;

#[derive(Serialize, Clone)]
pub struct DuplicateTrack {
    pub playlist: String,
    pub file: String,
    pub title: String,
    pub artist: String,
    pub duration: Option<f64>,
    pub cover: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct DuplicateGroup {
    pub label: String,
    pub tracks: Vec<DuplicateTrack>,
}

/// Lowercase + auf alphanumerische Wort-Tokens reduziert, damit
/// Gross-/Kleinschreibung, doppelte Leerzeichen oder Satzzeichen
/// (z.B. "Song (feat. X)" vs "Song feat X") nicht als "verschiedene
/// Songs" durchgehen - bewusst simpler als lyrics.rs' Jaccard-Vergleich,
/// hier reicht ein exakter Vergleich auf dem normalisierten Text, weil
/// echte Duplikate fast immer aus demselben YouTube-Download stammen und
/// damit identischen Titel/Interpret-Text haben.
fn normalize(text: &str) -> String {
    text.to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Scannt die gesamte Bibliothek (alle Playlists) und gruppiert Tracks mit
/// gleichem normalisiertem Titel+Interpret - z.B. derselbe Song, der in
/// zwei verschiedene Playlists heruntergeladen wurde. Nur Gruppen mit mehr
/// als einem Treffer werden zurueckgegeben.
#[tauri::command]
pub fn find_duplicates(state: tauri::State<AppState>) -> Result<Vec<DuplicateGroup>, String> {
    let playlists = crate::commands::list_playlists_inner(&state.music_root);
    let mut groups: HashMap<String, Vec<DuplicateTrack>> = HashMap::new();
    for pl in &playlists {
        for t in &pl.tracks {
            if t.title.trim().is_empty() {
                continue;
            }
            let key = format!("{}::{}", normalize(&t.title), normalize(&t.artist));
            groups.entry(key).or_default().push(DuplicateTrack {
                playlist: pl.name.clone(),
                file: t.file.clone(),
                title: t.title.clone(),
                artist: t.artist.clone(),
                duration: t.duration,
                cover: t.cover.clone(),
            });
        }
    }
    let mut out: Vec<DuplicateGroup> = groups
        .into_values()
        .filter(|tracks| tracks.len() > 1)
        .map(|tracks| {
            let artist = if tracks[0].artist.trim().is_empty() {
                "Unbekannter Interpret".to_string()
            } else {
                tracks[0].artist.clone()
            };
            DuplicateGroup {
                label: format!("{} — {}", tracks[0].title, artist),
                tracks,
            }
        })
        .collect();
    out.sort_by(|a, b| b.tracks.len().cmp(&a.tracks.len()).then(a.label.cmp(&b.label)));
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_lowercases_and_collapses_whitespace() {
        assert_eq!(normalize("  Hello   World  "), "hello world");
    }

    #[test]
    fn normalize_strips_punctuation() {
        assert_eq!(normalize("Song (feat. X)!"), "song feat x");
    }

    #[test]
    fn normalize_treats_case_and_spacing_variants_as_equal() {
        assert_eq!(normalize("Blinding Lights"), normalize("BLINDING   LIGHTS"));
    }

    #[test]
    fn normalize_treats_different_titles_as_different() {
        assert_ne!(normalize("Blinding Lights"), normalize("Shape of You"));
    }
}
