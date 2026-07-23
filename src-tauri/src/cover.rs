use crate::commands::AppState;

/// Sucht ein Cover fuer einen Track, der weder ein eingebettetes ID3-Bild
/// noch einen .jpg-Sidecar hat (z.B. ein Upload ohne Cover, oder ein per
/// Handy-Sync uebertragener Track ohne Metadaten). Deezer zuerst (kein
/// API-Key noetig, ein einziger Request liefert Cover direkt), MusicBrainz
/// + Cover Art Archive als Fallback, falls Deezer nichts findet. Speichert
/// einen Treffer genau so wie Bulk-Edit (apply_mp3_tags/apply_sidecar_tags)
/// - mp3 bekommt ihn direkt ins ID3-Bild, m4a/mp4 als <name>.jpg-Sidecar.
///
/// Gibt `Ok(false)` (kein Fehler) zurueck, wenn keine der beiden Quellen
/// etwas Passendes hat - "kein Cover gefunden" ist der Normalfall fuer
/// obskure/sehr neue Tracks, kein Grund fuer eine Fehlermeldung im Frontend.
#[tauri::command]
pub async fn fetch_missing_cover(
    state: tauri::State<'_, AppState>,
    playlist_name: String,
    filename: String,
    title: String,
    artist: String,
) -> Result<bool, String> {
    let dir = crate::commands::safe_join(&state.music_root, &crate::commands::safe_filename(&playlist_name))?;
    let path = crate::commands::safe_join(&dir, &filename)?;
    if !path.is_file() {
        return Err("Datei nicht gefunden.".into());
    }

    let client = reqwest::Client::builder()
        .user_agent("meine-musik/0.1 (+https://github.com/Gaboro030/meine-musik-app)")
        .build()
        .map_err(|e| e.to_string())?;

    let found = match fetch_from_deezer(&client, &title, &artist).await {
        Some(hit) => Some(hit),
        None => fetch_from_musicbrainz(&client, &title, &artist).await,
    };
    let Some((bytes, mime)) = found else {
        return Ok(false);
    };

    let is_mp3 = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("mp3"))
        .unwrap_or(false);
    let ok = if is_mp3 {
        crate::commands::apply_mp3_tags(&path, None, Some(&bytes), &mime)
    } else {
        crate::commands::apply_sidecar_tags(&path, None, Some(&bytes))
    };
    if ok {
        // Gleicher Grund wie in bulk_update_tracks: sonst zeigt list_playlists
        // weiter "kein Cover", bis der Prozess neu startet.
        let _ = std::fs::remove_file(path.with_extension("cover_cache.jpg"));
    }
    Ok(ok)
}

async fn fetch_from_deezer(client: &reqwest::Client, title: &str, artist: &str) -> Option<(Vec<u8>, String)> {
    let q = format!("{artist} {title}");
    let resp = client
        .get("https://api.deezer.com/search")
        .query(&[("q", q)])
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let data: serde_json::Value = resp.json().await.ok()?;
    let url = data
        .get("data")?
        .get(0)?
        .get("album")?
        .get("cover_medium")?
        .as_str()?;
    download_image(client, url).await
}

async fn fetch_from_musicbrainz(client: &reqwest::Client, title: &str, artist: &str) -> Option<(Vec<u8>, String)> {
    // Doppelte Anfuehrungszeichen wuerden die Lucene-artige MusicBrainz-
    // Query-Syntax kaputt machen (unser Titel/Interpret kommt roh von
    // YouTube, kein Escaping garantiert) - einfach entfernen statt escapen,
    // das genuegt fuer die Suche.
    let clean = |s: &str| s.replace('"', "");
    let query = format!(r#"recording:"{}" AND artist:"{}""#, clean(title), clean(artist));
    let resp = client
        .get("https://musicbrainz.org/ws/2/recording/")
        .query(&[("query", query.as_str()), ("fmt", "json"), ("limit", "1")])
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let data: serde_json::Value = resp.json().await.ok()?;
    let mbid = data
        .get("recordings")?
        .get(0)?
        .get("releases")?
        .get(0)?
        .get("id")?
        .as_str()?;
    let art_url = format!("https://coverartarchive.org/release/{mbid}/front-250");
    download_image(client, &art_url).await
}

async fn download_image(client: &reqwest::Client, url: &str) -> Option<(Vec<u8>, String)> {
    let resp = client.get(url).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let mime = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();
    let bytes = resp.bytes().await.ok()?.to_vec();
    if bytes.is_empty() {
        None
    } else {
        Some((bytes, mime))
    }
}
