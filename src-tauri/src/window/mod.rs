use tauri::WebviewWindow;

/// Called during app setup.
/// On macOS: sets window background to transparent for vibrancy support.
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
    use cocoa::appkit::{NSColor, NSWindow};
    use cocoa::base::{id, nil};
    use objc::runtime::YES;

    let ns_win: id = window.ns_window().unwrap() as id;
    unsafe {
        ns_win.setBackgroundColor_(NSColor::clearColor(nil));
        ns_win.setTitlebarAppearsTransparent_(YES);
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
#[cfg(target_os = "windows")]
fn apply_effects(window: &WebviewWindow, r: u8, g: u8, b: u8, a: u8) {
    let _ = window_vibrancy::apply_acrylic(window, Some((r, g, b, a)));
}

#[cfg(target_os = "windows")]
fn clear_effects(window: &WebviewWindow) {
    let _ = window_vibrancy::clear_acrylic(window);
}

// ── macOS ──
// Manually add NSVisualEffectView to the window's content view (not the webview).
// The window_vibrancy crate adds it to the webview's NSView which is the wrong level
// — the blur ends up inside the webview instead of behind it.
#[cfg(target_os = "macos")]
const VIBRANCY_TAG: i64 = 91376200;

#[cfg(target_os = "macos")]
fn apply_effects(window: &WebviewWindow, _r: u8, _g: u8, _b: u8, _a: u8) {
    use cocoa::appkit::NSWindow;
    use cocoa::base::{id, nil};
    use cocoa::foundation::NSRect;
    use objc::{class, msg_send, sel, sel_impl};

    let ns_win: id = window.ns_window().unwrap() as id;
    unsafe {
        let content_view: id = ns_win.contentView();

        // Remove existing vibrancy view if present
        let existing: id = msg_send![content_view, viewWithTag: VIBRANCY_TAG];
        if existing != nil {
            let _: () = msg_send![existing, removeFromSuperview];
        }

        let bounds: NSRect = msg_send![content_view, bounds];

        // Create NSVisualEffectView
        let cls = class!(NSVisualEffectView);
        let effect_view: id = msg_send![cls, alloc];
        let effect_view: id = msg_send![effect_view, initWithFrame: bounds];

        // Material: HudWindow = 13 (frosted dark glass)
        let _: () = msg_send![effect_view, setMaterial: 13_i64];
        // State: Active = 1 (always show, even when unfocused)
        let _: () = msg_send![effect_view, setState: 1_i64];
        // BlendingMode: BehindWindow = 0 (blur desktop behind)
        let _: () = msg_send![effect_view, setBlendingMode: 0_i64];
        // Auto-resize with window: NSViewWidthSizable (2) | NSViewHeightSizable (16) = 18
        let _: () = msg_send![effect_view, setAutoresizingMask: 18_u64];
        // Tag for identification/removal
        let _: () = msg_send![effect_view, setTag: VIBRANCY_TAG];

        // Add behind all other subviews (NSWindowBelow = -1)
        let _: () = msg_send![content_view, addSubview: effect_view positioned: -1_i64 relativeTo: nil];
    }
}

#[cfg(target_os = "macos")]
fn clear_effects(window: &WebviewWindow) {
    use cocoa::appkit::NSWindow;
    use cocoa::base::{id, nil};
    use objc::{msg_send, sel, sel_impl};

    let ns_win: id = window.ns_window().unwrap() as id;
    unsafe {
        let content_view: id = ns_win.contentView();
        let existing: id = msg_send![content_view, viewWithTag: VIBRANCY_TAG];
        if existing != nil {
            let _: () = msg_send![existing, removeFromSuperview];
        }
    }
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
