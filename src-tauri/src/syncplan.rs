//! Beidseitiger Playlist-Abgleich - Etappe 4.
//!
//! # Warum ein Zustand vom letzten Mal noetig ist
//!
//! Ein Titel fehlt auf einer Seite. Zwei voellig verschiedene Gruende:
//! er wurde auf der anderen Seite gerade HINZUGEFUEGT, oder er wurde auf
//! dieser Seite GELOESCHT. Wer nur die beiden aktuellen Listen vergleicht,
//! kann das nicht unterscheiden - und macht in der Haelfte der Faelle
//! genau das Falsche: geloeschte Titel kaemen bei jedem Abgleich wieder
//! zurueck.
//!
//! Deshalb drei Listen: was bei mir liegt, was drueben liegt, und was
//! beim letzten Abgleich auf beiden Seiten war. Erst daraus ergibt sich
//! eindeutig, was passiert ist.
//!
//! # Was der Abgleich NICHT tut
//!
//! Er loescht keine Dateien. Eine Reson-Playlist ist ein Ordner mit
//! Musikdateien - "aus der Playlist entfernen" hiesse hier, eine Datei
//! anzufassen, die der Nutzer vielleicht muehsam heruntergeladen hat.
//! Steht drueben etwas nicht mehr drin, wird das gemeldet und nichts
//! getan. Beim Herunterladen genauso: was drueben neu ist, erscheint als
//! Vorschlag, nicht als automatischer Download.
//!
//! Automatisch passiert nur, was sich rueckstandslos zuruecknehmen laesst:
//! Titel drueben eintragen und - nach Bestaetigung - drueben austragen.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

/// Ein Titel, wie ihn beide Seiten kennen: die lokale Datei und die
/// Kennung beim Dienst.
#[derive(Serialize, Deserialize, Clone, PartialEq, Eq, Debug)]
pub struct Paar {
    /// Dateiname in der Reson-Playlist.
    pub lokal: String,
    /// "spotify:track:..." bzw. die YouTube-Video-Kennung.
    pub fern: String,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct PlaylistZustand {
    /// Kennung der Playlist beim Dienst. Leer, solange drueben noch
    /// keine angelegt wurde.
    #[serde(default)]
    pub fern_id: String,
    /// Was beim letzten Abgleich auf BEIDEN Seiten lag.
    #[serde(default)]
    pub paare: Vec<Paar>,
}

#[derive(Serialize, Deserialize, Default)]
pub struct Zustand {
    /// Dienst -> lokale Playlist -> Stand.
    #[serde(default)]
    pub dienste: HashMap<String, HashMap<String, PlaylistZustand>>,
}

/// Was der Abgleich vorschlaegt. Bewusst getrennt nach "wird gemacht" und
/// "wird nur gemeldet", damit die Vorschau das genauso zeigen kann.
#[derive(Serialize, Deserialize, Default, Debug, PartialEq)]
pub struct Plan {
    /// Bei mir neu -> drueben eintragen. Passiert automatisch.
    pub drueben_eintragen: Vec<String>,
    /// Bei mir geloescht -> drueben austragen. Nur nach Bestaetigung.
    pub drueben_austragen: Vec<String>,
    /// Drueben neu -> koennte heruntergeladen werden. Nur Vorschlag.
    pub bei_mir_fehlt: Vec<String>,
    /// Drueben geloescht -> liegt bei mir noch. Nur Hinweis, es wird
    /// nichts geloescht.
    pub drueben_geloescht: Vec<String>,
    /// Auf beiden Seiten verschwunden - nur noch aus dem Zustand
    /// auszutragen, sonst taucht es ewig als Unterschied auf.
    pub vergessen: Vec<String>,
}

impl Plan {
    /// Nur fuer die Tests: das Frontend sieht die fuenf Listen ohnehin
    /// einzeln und entscheidet danach, ob es etwas anzuzeigen gibt.
    #[cfg(test)]
    pub fn leer(&self) -> bool {
        self.drueben_eintragen.is_empty()
            && self.drueben_austragen.is_empty()
            && self.bei_mir_fehlt.is_empty()
            && self.drueben_geloescht.is_empty()
            && self.vergessen.is_empty()
    }
}

/// Der eigentliche Vergleich. Reine Funktion ohne Netz und ohne Platte -
/// das ist der Teil, an dem ein Fehler Daten kostet, also muss er sich
/// ohne Anmeldung durchspielen lassen.
///
/// * `lokal` - Dateinamen in der Reson-Playlist, wie sie jetzt sind.
/// * `fern` - Kennungen beim Dienst, wie sie jetzt sind.
/// * `zuletzt` - die Paare vom letzten Abgleich.
pub fn plan_erstellen(lokal: &[String], fern: &[String], zuletzt: &[Paar]) -> Plan {
    let lokal_jetzt: HashSet<&str> = lokal.iter().map(|s| s.as_str()).collect();
    let fern_jetzt: HashSet<&str> = fern.iter().map(|s| s.as_str()).collect();

    let mut plan = Plan::default();
    // Was aus dem letzten Abgleich schon abgehandelt ist - der Rest gilt
    // als neu.
    let mut bekannt_lokal: HashSet<&str> = HashSet::new();
    let mut bekannt_fern: HashSet<&str> = HashSet::new();

    for paar in zuletzt {
        bekannt_lokal.insert(paar.lokal.as_str());
        bekannt_fern.insert(paar.fern.as_str());

        let hier = lokal_jetzt.contains(paar.lokal.as_str());
        let dort = fern_jetzt.contains(paar.fern.as_str());
        match (hier, dort) {
            // Unveraendert - nichts zu tun.
            (true, true) => {}
            // Bei mir noch da, drueben weg: jemand hat es drueben
            // ausgetragen. NICHT bei mir loeschen, nur melden.
            (true, false) => plan.drueben_geloescht.push(paar.lokal.clone()),
            // Bei mir weg, drueben noch da: hier geloescht, also drueben
            // nachziehen - aber erst nach Bestaetigung.
            (false, true) => plan.drueben_austragen.push(paar.fern.clone()),
            // Beidseitig weg - nur noch aus dem Zustand austragen.
            (false, false) => plan.vergessen.push(paar.lokal.clone()),
        }
    }

    // Alles, was der letzte Abgleich nicht kannte, ist neu.
    for datei in lokal {
        if !bekannt_lokal.contains(datei.as_str()) {
            plan.drueben_eintragen.push(datei.clone());
        }
    }
    for id in fern {
        if !bekannt_fern.contains(id.as_str()) {
            plan.bei_mir_fehlt.push(id.clone());
        }
    }
    plan
}

/// Der Zustand nach einem ausgefuehrten Abgleich.
///
/// Wichtig: hier zaehlt, was WIRKLICH passiert ist, nicht was geplant war.
/// Ein Titel, den der Dienst nicht kannte, darf nicht als Paar landen -
/// sonst gilt er beim naechsten Mal als "drueben geloescht" und die App
/// wuerde anbieten, ihn bei mir zu entfernen.
pub fn zustand_fortschreiben(
    zuletzt: &[Paar],
    plan: &Plan,
    neu_eingetragen: &[Paar],
    ausgetragen: &[String],
) -> Vec<Paar> {
    let raus_fern: HashSet<&str> = ausgetragen.iter().map(|s| s.as_str()).collect();
    let vergessen: HashSet<&str> = plan.vergessen.iter().map(|s| s.as_str()).collect();
    // Drueben geloeschte bleiben NICHT im Zustand: der Titel ist dort
    // weg, das Paar gibt es also nicht mehr. Bliebe es stehen, meldete
    // der naechste Abgleich denselben Unterschied noch einmal.
    let drueben_weg: HashSet<&str> = plan.drueben_geloescht.iter().map(|s| s.as_str()).collect();

    let mut out: Vec<Paar> = zuletzt
        .iter()
        .filter(|p| {
            !raus_fern.contains(p.fern.as_str())
                && !vergessen.contains(p.lokal.as_str())
                && !drueben_weg.contains(p.lokal.as_str())
        })
        .cloned()
        .collect();
    out.extend(neu_eingetragen.iter().cloned());
    out
}

/* --- Ablage --------------------------------------------------------------- */

fn zustand_pfad(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    use tauri::Manager;
    let state = app.try_state::<crate::commands::AppState>()?;
    Some(state.data_dir.join("sync_state.json"))
}

pub fn zustand_lesen(app: &tauri::AppHandle) -> Zustand {
    zustand_pfad(app)
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default()
}

pub fn zustand_schreiben(app: &tauri::AppHandle, zustand: &Zustand) {
    let Some(pfad) = zustand_pfad(app) else { return };
    if let Some(eltern) = pfad.parent() {
        let _ = std::fs::create_dir_all(eltern);
    }
    if let Ok(json) = serde_json::to_string_pretty(zustand) {
        let _ = std::fs::write(pfad, json);
    }
}

/// Stand einer bestimmten Playlist holen.
#[tauri::command]
pub fn sync_zustand(app: tauri::AppHandle, dienst: String, playlist: String) -> PlaylistZustand {
    zustand_lesen(&app)
        .dienste
        .get(&dienst)
        .and_then(|d| d.get(&playlist))
        .cloned()
        .unwrap_or_default()
}

/// Stand nach einem Abgleich sichern.
#[tauri::command]
pub fn sync_zustand_setzen(
    app: tauri::AppHandle,
    dienst: String,
    playlist: String,
    fern_id: String,
    paare: Vec<Paar>,
) {
    let mut zustand = zustand_lesen(&app);
    zustand
        .dienste
        .entry(dienst)
        .or_default()
        .insert(playlist, PlaylistZustand { fern_id, paare });
    zustand_schreiben(&app, &zustand);
}

/// Vergleicht und liefert den Plan. Das Frontend zeigt ihn als Vorschau,
/// bevor irgendetwas geschrieben wird.
#[tauri::command]
pub fn sync_plan(
    app: tauri::AppHandle,
    dienst: String,
    playlist: String,
    lokal: Vec<String>,
    fern: Vec<String>,
) -> Plan {
    let zuletzt = sync_zustand(app, dienst, playlist).paare;
    plan_erstellen(&lokal, &fern, &zuletzt)
}

/// Nach dem Ausfuehren: Zustand fortschreiben und sichern.
///
/// Bewusst hier und nicht im Frontend nachgebaut - an dieser Rechnung
/// haengt, ob beim naechsten Mal etwas faelschlich als geloescht gilt.
/// `neu_eingetragen` und `ausgetragen` sind das, was WIRKLICH geklappt
/// hat, nicht das, was geplant war.
#[tauri::command]
pub fn sync_abgleich_abschliessen(
    app: tauri::AppHandle,
    dienst: String,
    playlist: String,
    fern_id: String,
    plan: Plan,
    neu_eingetragen: Vec<Paar>,
    ausgetragen: Vec<String>,
) {
    let zuletzt = zustand_lesen(&app)
        .dienste
        .get(&dienst)
        .and_then(|d| d.get(&playlist))
        .map(|z| z.paare.clone())
        .unwrap_or_default();
    let paare = zustand_fortschreiben(&zuletzt, &plan, &neu_eingetragen, &ausgetragen);
    let mut zustand = zustand_lesen(&app);
    zustand
        .dienste
        .entry(dienst)
        .or_default()
        .insert(playlist, PlaylistZustand { fern_id, paare });
    zustand_schreiben(&app, &zustand);
}

/// Alles zu einer Playlist vergessen - der naechste Abgleich faengt bei
/// null an und behandelt beide Seiten als neu.
#[tauri::command]
pub fn sync_zustand_loeschen(app: tauri::AppHandle, dienst: String, playlist: String) {
    let mut zustand = zustand_lesen(&app);
    if let Some(d) = zustand.dienste.get_mut(&dienst) {
        d.remove(&playlist);
    }
    zustand_schreiben(&app, &zustand);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn paar(lokal: &str, fern: &str) -> Paar {
        Paar { lokal: lokal.to_string(), fern: fern.to_string() }
    }
    fn s(v: &[&str]) -> Vec<String> {
        v.iter().map(|x| x.to_string()).collect()
    }

    #[test]
    fn erster_abgleich_traegt_alles_drueben_ein() {
        // Kein Zustand vorhanden: alles bei mir ist neu, alles drueben
        // fehlt bei mir. Nichts wird geloescht.
        let plan = plan_erstellen(&s(&["a.mp3", "b.mp3"]), &s(&["uri:x"]), &[]);
        assert_eq!(plan.drueben_eintragen, s(&["a.mp3", "b.mp3"]));
        assert_eq!(plan.bei_mir_fehlt, s(&["uri:x"]));
        assert!(plan.drueben_austragen.is_empty());
        assert!(plan.drueben_geloescht.is_empty());
    }

    #[test]
    fn unveraenderte_playlist_ergibt_keinen_plan() {
        let zuletzt = vec![paar("a.mp3", "uri:a"), paar("b.mp3", "uri:b")];
        let plan = plan_erstellen(&s(&["a.mp3", "b.mp3"]), &s(&["uri:a", "uri:b"]), &zuletzt);
        assert!(plan.leer(), "Plan war {plan:?}");
    }

    #[test]
    fn bei_mir_geloescht_wird_drueben_ausgetragen() {
        let zuletzt = vec![paar("a.mp3", "uri:a"), paar("b.mp3", "uri:b")];
        let plan = plan_erstellen(&s(&["a.mp3"]), &s(&["uri:a", "uri:b"]), &zuletzt);
        assert_eq!(plan.drueben_austragen, s(&["uri:b"]));
        // Und ganz sicher nicht als "neu drueben" wieder einsammeln.
        assert!(plan.bei_mir_fehlt.is_empty());
    }

    #[test]
    fn drueben_geloescht_loescht_bei_mir_nichts() {
        // Das ist die wichtigste Zusicherung des ganzen Moduls: eine
        // Datei, die drueben verschwindet, wird hier nur gemeldet.
        let zuletzt = vec![paar("a.mp3", "uri:a"), paar("b.mp3", "uri:b")];
        let plan = plan_erstellen(&s(&["a.mp3", "b.mp3"]), &s(&["uri:a"]), &zuletzt);
        assert_eq!(plan.drueben_geloescht, s(&["b.mp3"]));
        assert!(plan.drueben_eintragen.is_empty(), "haette b.mp3 nicht neu eintragen duerfen");
    }

    #[test]
    fn geloeschtes_kommt_nicht_beim_naechsten_mal_zurueck() {
        // Ohne Zustand wuerde hier "uri:b fehlt bei mir" stehen und der
        // Titel bei jedem Abgleich erneut angeboten. Genau das verhindert
        // der Drei-Wege-Vergleich.
        let zuletzt = vec![paar("b.mp3", "uri:b")];
        let plan = plan_erstellen(&[], &s(&["uri:b"]), &zuletzt);
        assert_eq!(plan.drueben_austragen, s(&["uri:b"]));
        assert!(plan.bei_mir_fehlt.is_empty());
    }

    #[test]
    fn beidseitig_verschwundenes_wird_nur_vergessen() {
        let zuletzt = vec![paar("a.mp3", "uri:a")];
        let plan = plan_erstellen(&[], &[], &zuletzt);
        assert_eq!(plan.vergessen, s(&["a.mp3"]));
        assert!(plan.drueben_austragen.is_empty());
        assert!(plan.drueben_geloescht.is_empty());
    }

    #[test]
    fn drueben_neu_ist_nur_ein_vorschlag() {
        let zuletzt = vec![paar("a.mp3", "uri:a")];
        let plan = plan_erstellen(&s(&["a.mp3"]), &s(&["uri:a", "uri:neu"]), &zuletzt);
        assert_eq!(plan.bei_mir_fehlt, s(&["uri:neu"]));
        assert!(plan.drueben_austragen.is_empty());
    }

    #[test]
    fn fortschreiben_nimmt_nur_was_wirklich_geschrieben_wurde() {
        // Geplant waren zwei, eingetragen wurde einer (den anderen kennt
        // der Dienst nicht). Nur der eingetragene darf ins Gedaechtnis -
        // sonst gilt der andere naechstes Mal als "drueben geloescht".
        let zuletzt = vec![paar("a.mp3", "uri:a")];
        let plan = Plan {
            drueben_eintragen: s(&["b.mp3", "c.mp3"]),
            ..Default::default()
        };
        let neu = zustand_fortschreiben(&zuletzt, &plan, &[paar("b.mp3", "uri:b")], &[]);
        assert_eq!(neu, vec![paar("a.mp3", "uri:a"), paar("b.mp3", "uri:b")]);
    }

    #[test]
    fn fortschreiben_entfernt_ausgetragene_paare() {
        let zuletzt = vec![paar("a.mp3", "uri:a"), paar("b.mp3", "uri:b")];
        let plan = Plan { drueben_austragen: s(&["uri:b"]), ..Default::default() };
        let neu = zustand_fortschreiben(&zuletzt, &plan, &[], &s(&["uri:b"]));
        assert_eq!(neu, vec![paar("a.mp3", "uri:a")]);
    }

    #[test]
    fn fortschreiben_behaelt_nicht_ausgefuehrte_austragungen() {
        // Bestaetigt der Nutzer das Austragen nicht, bleibt das Paar
        // bestehen - beim naechsten Mal wird wieder gefragt, statt den
        // Unterschied stillschweigend zu verlieren.
        let zuletzt = vec![paar("a.mp3", "uri:a"), paar("b.mp3", "uri:b")];
        let plan = Plan { drueben_austragen: s(&["uri:b"]), ..Default::default() };
        let neu = zustand_fortschreiben(&zuletzt, &plan, &[], &[]);
        assert_eq!(neu.len(), 2);
    }

    #[test]
    fn fortschreiben_vergisst_beidseitig_verschwundenes() {
        let zuletzt = vec![paar("a.mp3", "uri:a")];
        let plan = Plan { vergessen: s(&["a.mp3"]), ..Default::default() };
        let neu = zustand_fortschreiben(&zuletzt, &plan, &[], &[]);
        assert!(neu.is_empty());
    }

    #[test]
    fn fortschreiben_traegt_drueben_geloeschtes_aus() {
        // Sonst meldet der naechste Abgleich denselben Unterschied noch
        // einmal, obwohl der Nutzer ihn laengst gesehen hat.
        let zuletzt = vec![paar("a.mp3", "uri:a"), paar("b.mp3", "uri:b")];
        let plan = Plan { drueben_geloescht: s(&["b.mp3"]), ..Default::default() };
        let neu = zustand_fortschreiben(&zuletzt, &plan, &[], &[]);
        assert_eq!(neu, vec![paar("a.mp3", "uri:a")]);
    }

    #[test]
    fn ein_titel_zweimal_in_der_liste_bringt_nichts_durcheinander() {
        // Kommt vor: derselbe Song zweimal in einer Playlist.
        let plan = plan_erstellen(&s(&["a.mp3", "a.mp3"]), &[], &[]);
        assert_eq!(plan.drueben_eintragen.len(), 2);
    }
}
