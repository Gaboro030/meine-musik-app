//! Knoepfe in der Taskleisten-Vorschau (Windows): Zurueck, Wiedergabe/
//! Pause, Weiter - dieselbe Leiste, die auch der Windows-Medienplayer
//! unter seiner Vorschau zeigt, wenn man mit der Maus ueber das
//! Taskleistensymbol faehrt.
//!
//! Das gibt es in Tauri nicht fertig, also direkt ueber die Shell-
//! Schnittstelle ITaskbarList3. Drei Dinge sind dabei unbequem und
//! erklaeren die Laenge dieser Datei:
//!
//! 1. Die Knopfsymbole muessen als HICON vorliegen. Statt Icon-Dateien
//!    mitzuschleppen und einen Ressourcen-Compiler einzuspannen, werden
//!    sie hier gezeichnet - drei simple Formen in Weiss auf
//!    durchsichtigem Grund, mehr braucht es bei 16x16 nicht.
//!
//! 2. Klicks kommen als klassische WM_COMMAND-Nachricht am Fenster an.
//!    Tauri reicht rohe Win32-Nachrichten nicht durch, also haengt sich
//!    dieses Modul per SetWindowSubclass in die Nachrichtenkette des
//!    Fensters und laesst alles Uebrige unveraendert weiterlaufen.
//!
//! 3. Die Leiste laesst sich pro Fenster nur EINMAL anlegen
//!    (ThumbBarAddButtons); jede spaetere Aenderung - etwa Wiedergabe zu
//!    Pause - muss ueber ThumbBarUpdateButtons laufen.

#![cfg(target_os = "windows")]

use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter};
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::Graphics::Gdi::{CreateBitmap, DeleteObject, HBITMAP};
use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_APARTMENTTHREADED};
use windows::Win32::UI::Shell::{
    DefSubclassProc, ITaskbarList3, SetWindowSubclass, TaskbarList, THUMBBUTTON, THUMBBUTTONFLAGS,
    THUMBBUTTONMASK, THBF_ENABLED, THB_FLAGS, THB_ICON, THB_TOOLTIP,
};
use windows::Win32::UI::WindowsAndMessaging::{CreateIconIndirect, HICON, ICONINFO, WM_COMMAND};

/// Kennungen der drei Knoepfe. Tauchen in WM_COMMAND als unteres Wort von
/// wParam wieder auf - daran wird der Klick erkannt.
const ID_PREV: u32 = 1001;
const ID_PLAY_PAUSE: u32 = 1002;
const ID_NEXT: u32 = 1003;

/// Fuer den Subclass-Rueckruf: der bekommt keinen eigenen Zustand mit,
/// deshalb hier ablegen. Die App laeuft mit genau einem Hauptfenster.
static APP: OnceLock<AppHandle> = OnceLock::new();
static HWND_MERK: AtomicIsize = AtomicIsize::new(0);
static SPIELT: AtomicBool = AtomicBool::new(false);
static EINGERICHTET: AtomicBool = AtomicBool::new(false);

/// Zeichnet ein 16x16-Symbol und macht daraus ein HICON.
///
/// `form` entscheidet, was gezeichnet wird - absichtlich mit der Hand
/// gesetzte Pixel statt einer Zeichenbibliothek: bei 16x16 ist jede
/// Kantenglaettung ohnehin verschenkt, und so kommt das Modul ohne
/// zusaetzliche Abhaengigkeit und ohne Icon-Dateien im Projekt aus.
fn symbol(form: Form) -> Option<HICON> {
    const N: i32 = 16;
    let mut pixel = vec![0u32; (N * N) as usize];
    let weiss: u32 = 0xFFFF_FFFF; // ARGB, voll deckend

    let setze = |p: &mut Vec<u32>, x: i32, y: i32| {
        if (0..N).contains(&x) && (0..N).contains(&y) {
            p[(y * N + x) as usize] = weiss;
        }
    };

    match form {
        Form::Play => {
            // Dreieck nach rechts, 4..12 waagerecht.
            for x in 4..12 {
                let hoehe = 12 - x; // laeuft spitz zu
                for y in (8 - hoehe)..(8 + hoehe) {
                    setze(&mut pixel, x, y);
                }
            }
        }
        Form::Pause => {
            for x in 4..7 {
                for y in 3..13 {
                    setze(&mut pixel, x, y);
                }
            }
            for x in 9..12 {
                for y in 3..13 {
                    setze(&mut pixel, x, y);
                }
            }
        }
        Form::Prev | Form::Next => {
            // Zwei Dreiecke plus Balken; bei Prev spiegelverkehrt.
            let spiegel = matches!(form, Form::Prev);
            let px = |x: i32| if spiegel { N - 1 - x } else { x };
            for x in 3..9 {
                let hoehe = 9 - x;
                for y in (8 - hoehe)..(8 + hoehe) {
                    setze(&mut pixel, px(x), y);
                }
            }
            for x in 8..14 {
                let hoehe = 14 - x;
                for y in (8 - hoehe)..(8 + hoehe) {
                    setze(&mut pixel, px(x), y);
                }
            }
        }
    }

    unsafe {
        // Farbbitmap mit Alphakanal; die Maske bleibt leer, weil die
        // Durchsichtigkeit schon im Alphakanal steckt.
        let farbe: HBITMAP = CreateBitmap(N, N, 1, 32, Some(pixel.as_ptr() as *const _));
        if farbe.is_invalid() {
            return None;
        }
        let maske: HBITMAP = CreateBitmap(N, N, 1, 1, None);
        let info = ICONINFO {
            fIcon: true.into(),
            xHotspot: 0,
            yHotspot: 0,
            hbmMask: maske,
            hbmColor: farbe,
        };
        let icon = CreateIconIndirect(&info).ok();
        // CreateIconIndirect kopiert die Bitmaps - die Originale gehoeren
        // danach uns und muessen weg, sonst bleiben sie liegen.
        let _ = DeleteObject(farbe.into());
        let _ = DeleteObject(maske.into());
        icon
    }
}

#[derive(Clone, Copy)]
enum Form {
    Prev,
    Play,
    Pause,
    Next,
}

/// Nachrichtenhaken. Alles, was nicht unser WM_COMMAND ist, geht
/// unveraendert weiter - sonst waere das Fenster nicht mehr bedienbar.
unsafe extern "system" fn subclass_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _id: usize,
    _data: usize,
) -> LRESULT {
    if msg == WM_COMMAND {
        let id = (wparam.0 & 0xFFFF) as u32;
        let aktion = match id {
            ID_PREV => Some("prev"),
            ID_PLAY_PAUSE => Some("playpause"),
            ID_NEXT => Some("next"),
            _ => None,
        };
        if let Some(aktion) = aktion {
            if let Some(app) = APP.get() {
                // Dasselbe Ereignis, das auch die globalen Hotkeys
                // ausloesen - im Frontend landet beides in derselben
                // Funktion, das Verhalten ist damit garantiert gleich.
                let _ = app.emit("global-hotkey", aktion);
            }
            return LRESULT(0);
        }
    }
    unsafe { DefSubclassProc(hwnd, msg, wparam, lparam) }
}

fn knopf(id: u32, form: Form, tooltip: &str) -> THUMBBUTTON {
    let mut b = THUMBBUTTON {
        dwMask: THUMBBUTTONMASK(THB_ICON.0 | THB_TOOLTIP.0 | THB_FLAGS.0),
        iId: id,
        iBitmap: 0,
        hIcon: symbol(form).unwrap_or_default(),
        szTip: [0; 260],
        dwFlags: THUMBBUTTONFLAGS(THBF_ENABLED.0),
    };
    for (i, c) in tooltip.encode_utf16().take(259).enumerate() {
        b.szTip[i] = c;
    }
    b
}

fn buttons(spielt: bool) -> [THUMBBUTTON; 3] {
    [
        knopf(ID_PREV, Form::Prev, "Vorheriger Titel"),
        if spielt {
            knopf(ID_PLAY_PAUSE, Form::Pause, "Pause")
        } else {
            knopf(ID_PLAY_PAUSE, Form::Play, "Wiedergabe")
        },
        knopf(ID_NEXT, Form::Next, "Naechster Titel"),
    ]
}

fn taskbar() -> Option<ITaskbarList3> {
    unsafe {
        // Ohne HrInit antwortet die Schnittstelle nicht - das ist kein
        // optionaler Schritt, sondern Teil des Vertrags.
        let liste: ITaskbarList3 = CoCreateInstance(&TaskbarList, None, CLSCTX_ALL).ok()?;
        liste.HrInit().ok()?;
        Some(liste)
    }
}

/// Legt die Leiste an. Nur beim ersten Mal wirksam - Windows erlaubt
/// ThumbBarAddButtons pro Fenster genau einmal.
pub fn einrichten(app: &AppHandle, hwnd: isize) {
    if EINGERICHTET.swap(true, Ordering::SeqCst) {
        return;
    }
    let _ = APP.set(app.clone());
    HWND_MERK.store(hwnd, Ordering::SeqCst);
    let h = HWND(hwnd as *mut _);

    unsafe {
        // COM fuer diesen Thread hochfahren. Laeuft es schon (Tauri macht
        // das fuer den Hauptthread), meldet der Aufruf das und ist sonst
        // wirkungslos - deshalb wird der Rueckgabewert bewusst verworfen.
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let _ = SetWindowSubclass(h, Some(subclass_proc), 1, 0);
    }

    let Some(liste) = taskbar() else { return };
    let b = buttons(false);
    unsafe {
        let _ = liste.ThumbBarAddButtons(h, &b);
    }
}

/// Wechselt zwischen Wiedergabe- und Pause-Symbol. Wird vom Frontend bei
/// jedem Start/Stopp aufgerufen.
pub fn zustand_setzen(spielt: bool) {
    if !EINGERICHTET.load(Ordering::SeqCst) {
        return;
    }
    if SPIELT.swap(spielt, Ordering::SeqCst) == spielt {
        return; // nichts geaendert, kein Grund die Leiste anzufassen
    }
    let hwnd = HWND_MERK.load(Ordering::SeqCst);
    if hwnd == 0 {
        return;
    }
    let Some(liste) = taskbar() else { return };
    let b = buttons(spielt);
    unsafe {
        let _ = liste.ThumbBarUpdateButtons(HWND(hwnd as *mut _), &b);
    }
}
