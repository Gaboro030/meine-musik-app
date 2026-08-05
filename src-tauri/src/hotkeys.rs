/// True system-wide hotkeys (fire even while the app is minimized/
/// unfocused) - a plain webview can only ever see keystrokes while
/// focused, that's a browser-sandbox limit no JS workaround can lift.
/// Desktop-only: `tauri-plugin-global-shortcut` doesn't support mobile
/// (no keyboard, no "minimized" concept there), so this whole module is
/// a no-op on Android - the existing in-app JS hotkeys (player.js) stay
/// the only mechanism there, which is correct/expected.
use serde::Deserialize;
#[cfg(desktop)]
use std::sync::Mutex;

#[cfg(desktop)]
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut};

#[derive(Debug, Deserialize, Clone)]
#[cfg_attr(mobile, allow(dead_code))]
pub struct HotkeyBinding {
    pub id: String,
    pub ctrl: bool,
    pub alt: bool,
    pub shift: bool,
    pub key: String,
}

/// Maps each currently-registered global Shortcut back to which frontend
/// action it belongs to. The plugin fires ONE shared handler (registered
/// once in lib.rs) for every shortcut press - this table is how that
/// handler knows which "global-hotkey" payload to emit.
#[cfg(desktop)]
pub static ACTIVE: Mutex<Vec<(Shortcut, String)>> = Mutex::new(Vec::new());

#[cfg(desktop)]
fn code_for_key(key: &str) -> Option<Code> {
    Some(match key {
        " " => Code::Space,
        "arrowright" => Code::ArrowRight,
        "arrowleft" => Code::ArrowLeft,
        "arrowup" => Code::ArrowUp,
        "arrowdown" => Code::ArrowDown,
        "a" => Code::KeyA,
        "b" => Code::KeyB,
        "c" => Code::KeyC,
        "d" => Code::KeyD,
        "e" => Code::KeyE,
        "f" => Code::KeyF,
        "g" => Code::KeyG,
        "h" => Code::KeyH,
        "i" => Code::KeyI,
        "j" => Code::KeyJ,
        "k" => Code::KeyK,
        "l" => Code::KeyL,
        "m" => Code::KeyM,
        "n" => Code::KeyN,
        "o" => Code::KeyO,
        "p" => Code::KeyP,
        "q" => Code::KeyQ,
        "r" => Code::KeyR,
        "s" => Code::KeyS,
        "t" => Code::KeyT,
        "u" => Code::KeyU,
        "v" => Code::KeyV,
        "w" => Code::KeyW,
        "x" => Code::KeyX,
        "y" => Code::KeyY,
        "z" => Code::KeyZ,
        "0" => Code::Digit0,
        "1" => Code::Digit1,
        "2" => Code::Digit2,
        "3" => Code::Digit3,
        "4" => Code::Digit4,
        "5" => Code::Digit5,
        "6" => Code::Digit6,
        "7" => Code::Digit7,
        "8" => Code::Digit8,
        "9" => Code::Digit9,
        // Funktionstasten: die sind in Spielen deutlich seltener belegt als
        // Buchstaben mit Strg+Alt und deshalb die brauchbarere Wahl, wenn
        // eine Kombination partout kollidiert.
        "f1" => Code::F1,
        "f2" => Code::F2,
        "f3" => Code::F3,
        "f4" => Code::F4,
        "f5" => Code::F5,
        "f6" => Code::F6,
        "f7" => Code::F7,
        "f8" => Code::F8,
        "f9" => Code::F9,
        "f10" => Code::F10,
        "f11" => Code::F11,
        "f12" => Code::F12,
        _ => return None,
    })
}

/// Die dedizierten Medientasten (auf vielen Tastaturen eigene Tasten oder
/// Fn-Kombination). Die werden IMMER zusaetzlich registriert, unabhaengig
/// davon, was der Nutzer eingestellt hat.
///
/// Warum das der zuverlaessigste Weg "auch im Spiel" ist: sie sind
/// systemweit fuer genau diesen Zweck vorgesehen, kein Spiel belegt sie
/// mit einer eigenen Funktion, und es kann keine Kollision mit einer
/// Spielsteuerung geben - anders als bei Strg+Alt+Buchstabe, das ein Spiel
/// oder ein anderes Programm durchaus fuer sich beanspruchen kann.
#[cfg(desktop)]
const MEDIENTASTEN: &[(Code, &str)] = &[
    (Code::MediaPlayPause, "playpause"),
    (Code::MediaTrackNext, "next"),
    (Code::MediaTrackPrevious, "prev"),
];

/// A global shortcut with NO modifier at all would hijack a plain key
/// system-wide (e.g. every "g" keypress anywhere) - too invasive and
/// almost certainly not what a user rebinding to a bare letter intended.
/// Skip registering the global side for those; the in-app JS hotkey (only
/// active while focused) still works regardless of modifiers.
#[cfg(desktop)]
fn shortcut_for(b: &HotkeyBinding) -> Option<Shortcut> {
    let code = code_for_key(&b.key)?;
    let mods = match (b.ctrl, b.alt, b.shift) {
        (true, true, true) => Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT,
        (true, true, false) => Modifiers::CONTROL | Modifiers::ALT,
        (true, false, true) => Modifiers::CONTROL | Modifiers::SHIFT,
        (true, false, false) => Modifiers::CONTROL,
        (false, true, true) => Modifiers::ALT | Modifiers::SHIFT,
        (false, true, false) => Modifiers::ALT,
        (false, false, true) => Modifiers::SHIFT,
        (false, false, false) => return None,
    };
    Some(Shortcut::new(Some(mods), code))
}

/// Called once at startup and again every time the user rebinds a
/// hotkey (hotkeys-native.js wraps saveHotkeyBindings) - clears every
/// previously-registered global shortcut and registers the current set
/// fresh, so stale combos never linger after a rebind.
/// Liefert die Kennungen der Kombinationen zurueck, die NICHT systemweit
/// belegt werden konnten - fast immer, weil ein anderes Programm sie schon
/// hat (Windows vergibt eine Tastenkombination nur einmal, wer zuerst
/// kommt, behaelt sie). Das wurde vorher stillschweigend verschluckt: die
/// Kombination tat dann ausserhalb des Fensters einfach nichts, ohne dass
/// irgendwo stand warum.
#[tauri::command]
pub async fn set_global_hotkeys(
    app: tauri::AppHandle,
    bindings: Vec<HotkeyBinding>,
) -> Result<Vec<String>, String> {
    #[cfg(desktop)]
    {
        use tauri_plugin_global_shortcut::GlobalShortcutExt;
        let gs = app.global_shortcut();
        let _ = gs.unregister_all();
        let mut table = ACTIVE.lock().map_err(|e| e.to_string())?;
        table.clear();
        let mut belegt = Vec::new();

        for b in &bindings {
            if let Some(shortcut) = shortcut_for(b) {
                if gs.register(shortcut).is_ok() {
                    table.push((shortcut, b.id.clone()));
                } else {
                    belegt.push(b.id.clone());
                }
            }
        }

        // Medientasten obendrauf, ohne Modifikator. Die Ausnahme von der
        // Regel weiter oben ist hier richtig: eine blanke Medientaste
        // kapert nichts, sie hat ausserhalb einer Musik-App gar keine
        // andere Bedeutung.
        for (code, id) in MEDIENTASTEN {
            let shortcut = Shortcut::new(None, *code);
            if gs.register(shortcut).is_ok() {
                table.push((shortcut, (*id).to_string()));
            }
        }

        return Ok(belegt);
    }
    #[cfg(mobile)]
    {
        let _ = (app, bindings);
        Ok(Vec::new())
    }
}
