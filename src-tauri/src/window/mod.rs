use tauri::WebviewWindow;

/// Called during app setup.
/// On macOS: makes window + webview transparent for vibrancy support.
/// The frontend calls `set_vibrancy` after settings load.
pub fn setup(window: Option<&WebviewWindow>) {
    #[cfg(target_os = "macos")]
    if let Some(window) = window {
        macos_setup(window);
    }

    #[cfg(not(target_os = "macos"))]
    let _ = window;
}

// The `cocoa` and `objc` crates are deprecated in favour of `objc2`, but
// Tauri v2 still exposes raw `*mut c_void` pointers that work with the old
// crate.  Suppress the cascade of deprecation + cfg warnings here.
#[cfg(target_os = "macos")]
#[allow(deprecated, unexpected_cfgs, unused_imports)]
fn macos_setup(window: &WebviewWindow) {
    use cocoa::appkit::{NSColor, NSWindow};
    use cocoa::base::{id, nil};
    use objc::runtime::{NO, YES};
    use objc::{msg_send, sel, sel_impl};

    let ns_win: id = window.ns_window().unwrap() as id;
    unsafe {
        ns_win.setOpaque_(NO);
        ns_win.setBackgroundColor_(NSColor::clearColor(nil));
        ns_win.setTitlebarAppearsTransparent_(YES);
    }

    // Make the WKWebView transparent so the NSVisualEffectView behind it shows through
    let _ = window.with_webview(|webview| {
        #[allow(deprecated, unexpected_cfgs)]
        unsafe {
            let wk_webview: cocoa::base::id = webview.inner() as cocoa::base::id;
            let _: () = objc::msg_send![wk_webview, _setDrawsBackground: objc::runtime::NO];
        }
    });
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
// The window_vibrancy crate adds it to the webview's NSView which is the wrong level.
#[cfg(target_os = "macos")]
#[allow(deprecated, unexpected_cfgs, unused_imports)]
fn remove_vibrancy_views(content_view: cocoa::base::id) {
    use cocoa::base::{id, nil};
    use objc::{class, msg_send, sel, sel_impl};

    unsafe {
        let subviews: id = msg_send![content_view, subviews];
        let count: usize = msg_send![subviews, count];
        let effect_cls = class!(NSVisualEffectView);
        for i in (0..count).rev() {
            let subview: id = msg_send![subviews, objectAtIndex: i];
            let is_effect: bool = msg_send![subview, isKindOfClass: effect_cls];
            if is_effect {
                let _: () = msg_send![subview, removeFromSuperview];
            }
        }
    }
}

#[cfg(target_os = "macos")]
#[allow(deprecated, unexpected_cfgs, unused_imports)]
fn apply_effects(window: &WebviewWindow, _r: u8, _g: u8, _b: u8, _a: u8) {
    use cocoa::appkit::{NSColor, NSWindow};
    use cocoa::base::{id, nil};
    use cocoa::foundation::NSRect;
    use objc::runtime::NO;
    use objc::{class, msg_send, sel, sel_impl};

    let ns_win: id = window.ns_window().unwrap() as id;
    unsafe {
        ns_win.setOpaque_(NO);
        ns_win.setBackgroundColor_(NSColor::clearColor(nil));

        let content_view: id = ns_win.contentView();

        remove_vibrancy_views(content_view);

        let bounds: NSRect = msg_send![content_view, bounds];

        let cls = class!(NSVisualEffectView);
        let effect_view: id = msg_send![cls, alloc];
        let effect_view: id = msg_send![effect_view, initWithFrame: bounds];

        // Material: HudWindow = 13 (frosted dark glass)
        let _: () = msg_send![effect_view, setMaterial: 13_i64];
        // State: Active = 1 (always show, even when unfocused)
        let _: () = msg_send![effect_view, setState: 1_i64];
        // BlendingMode: BehindWindow = 0 (blur desktop behind)
        let _: () = msg_send![effect_view, setBlendingMode: 0_i64];
        // Auto-resize with window
        let _: () = msg_send![effect_view, setAutoresizingMask: 18_u64];

        // Add behind all other subviews (NSWindowBelow = -1)
        let _: () = msg_send![content_view, addSubview: effect_view positioned: -1_i64 relativeTo: nil];
    }

    // Ensure WKWebView background is transparent
    let _ = window.with_webview(|webview| {
        #[allow(deprecated, unexpected_cfgs)]
        unsafe {
            let wk_webview: cocoa::base::id = webview.inner() as cocoa::base::id;
            let _: () = objc::msg_send![wk_webview, _setDrawsBackground: objc::runtime::NO];
        }
    });
}

#[cfg(target_os = "macos")]
#[allow(deprecated, unexpected_cfgs, unused_imports)]
fn clear_effects(window: &WebviewWindow) {
    use cocoa::appkit::NSWindow;
    use cocoa::base::id;
    use objc::{msg_send, sel, sel_impl};

    let ns_win: id = window.ns_window().unwrap() as id;
    unsafe {
        let content_view: id = ns_win.contentView();
        remove_vibrancy_views(content_view);
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
