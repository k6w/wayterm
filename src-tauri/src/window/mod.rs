use tauri::WebviewWindow;

/// Called during app setup.
/// On macOS: sets window background to transparent and positions traffic lights.
/// The frontend calls `set_vibrancy` after settings load.
pub fn setup(window: Option<&WebviewWindow>) {
    #[cfg(target_os = "macos")]
    if let Some(window) = window {
        macos_setup(window);
    }

    #[cfg(not(target_os = "macos"))]
    let _ = window;
}

#[cfg(target_os = "macos")]
fn macos_setup(window: &WebviewWindow) {
    use cocoa::appkit::{NSColor, NSWindow, NSWindowButton};
    use cocoa::base::{id, nil};
    use cocoa::foundation::NSRect;
    use objc::runtime::YES;

    let ns_win: id = window.ns_window().unwrap() as id;
    unsafe {
        // Make window background transparent so vibrancy/CSS backgrounds show through
        ns_win.setBackgroundColor_(NSColor::clearColor(nil));
        ns_win.setTitlebarAppearsTransparent_(YES);

        // Position traffic lights to vertically center in our 40px titlebar
        // Traffic lights are ~14px tall, so center at y=13 from top
        let buttons = [
            NSWindowButton::NSWindowCloseButton,
            NSWindowButton::NSWindowMiniaturizeButton,
            NSWindowButton::NSWindowZoomButton,
        ];

        for (i, &button) in buttons.iter().enumerate() {
            let btn: id = ns_win.standardWindowButton_(button);
            if btn != nil {
                let frame: NSRect = cocoa::appkit::NSView::frame(btn);
                let x = 7.0 + (i as f64 * 20.0);
                let y = 13.0;
                cocoa::appkit::NSView::setFrameOrigin(
                    btn,
                    cocoa::foundation::NSPoint::new(x, y),
                );
                let _ = frame;
            }
        }
    }
}

#[tauri::command]
pub fn set_vibrancy(window: WebviewWindow, enabled: bool, r: u8, g: u8, b: u8, a: u8) {
    if enabled {
        apply_effects(&window, r, g, b, a);
    } else {
        clear_effects(&window);
    }
}

// ── Windows ──
// Acrylic gives frosted-glass transparency. The RGBA tint colors the blur
// so the theme's palette is visible through the glass.
#[cfg(target_os = "windows")]
fn apply_effects(window: &WebviewWindow, r: u8, g: u8, b: u8, a: u8) {
    let _ = window_vibrancy::apply_acrylic(window, Some((r, g, b, a)));
}

#[cfg(target_os = "windows")]
fn clear_effects(window: &WebviewWindow) {
    let _ = window_vibrancy::clear_acrylic(window);
}

// ── macOS ──
// macOS vibrancy uses system materials; color is controlled via CSS.
#[cfg(target_os = "macos")]
fn apply_effects(window: &WebviewWindow, _r: u8, _g: u8, _b: u8, _a: u8) {
    use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
    let _ = apply_vibrancy(
        window,
        NSVisualEffectMaterial::UnderWindowBackground,
        None,
        None,
    );
}

#[cfg(target_os = "macos")]
fn clear_effects(_window: &WebviewWindow) {
    // macOS NSVisualEffectView has no public clear API in window-vibrancy.
    // The frontend uses solid CSS backgrounds when vibrancy is off,
    // which fully covers the native effect.
}

// ── Linux ──
#[cfg(target_os = "linux")]
fn apply_effects(window: &WebviewWindow, r: u8, g: u8, b: u8, a: u8) {
    let _ = window_vibrancy::apply_blur(window, Some((r, g, b, a)));
}

#[cfg(target_os = "linux")]
fn clear_effects(window: &WebviewWindow) {
    let _ = window_vibrancy::clear_blur(window);
}

// Fallback for unsupported platforms
#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
fn apply_effects(_window: &WebviewWindow, _r: u8, _g: u8, _b: u8, _a: u8) {}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
fn clear_effects(_window: &WebviewWindow) {}
