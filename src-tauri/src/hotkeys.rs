/// True system-wide hotkeys (fire even while the app is minimized/
/// unfocused) - a plain webview can only ever see keystrokes while
/// focused, that's a browser-sandbox limit no JS workaround can lift.
/// Desktop-only: `tauri-plugin-global-shortcut` doesn't support mobile
/// (no keyboard, no "minimized" concept there), so this whole module is
/// a no-op on Android - the existing in-app JS hotkeys (player.js) stay
/// the only mechanism there, which is correct/expected.
use serde::Deserialize;
use std::sync::Mutex;

#[cfg(desktop)]
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut};

#[derive(Debug, Deserialize, Clone)]
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
        _ => return None,
    })
}

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
#[tauri::command]
pub async fn set_global_hotkeys(app: tauri::AppHandle, bindings: Vec<HotkeyBinding>) -> Result<(), String> {
    #[cfg(desktop)]
    {
        use tauri_plugin_global_shortcut::GlobalShortcutExt;
        let gs = app.global_shortcut();
        let _ = gs.unregister_all();
        let mut table = ACTIVE.lock().map_err(|e| e.to_string())?;
        table.clear();
        for b in &bindings {
            if let Some(shortcut) = shortcut_for(b) {
                if gs.register(shortcut).is_ok() {
                    table.push((shortcut, b.id.clone()));
                }
            }
        }
    }
    #[cfg(mobile)]
    {
        let _ = (app, bindings);
    }
    Ok(())
}
