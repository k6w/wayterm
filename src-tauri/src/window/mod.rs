use tauri::WebviewWindow;

pub fn setup(window: Option<&WebviewWindow>) {
    #[cfg(target_os = "macos")]
    if let Some(window) = window {
        macos_setup(window);
    }

    #[cfg(not(target_os = "macos"))]
    let _ = window;
}

#[cfg(target_os = "macos")]
#[allow(deprecated)]
fn macos_setup(window: &WebviewWindow) {
    use cocoa::appkit::{NSColor, NSWindow};
    use cocoa::base::{id, nil};
    use objc::runtime::{NO, YES};

    let ns_win: id = window.ns_window().unwrap() as id;
    unsafe {
        ns_win.setOpaque_(NO);
        ns_win.setBackgroundColor_(NSColor::clearColor(nil));
        ns_win.setTitlebarAppearsTransparent_(YES);
    }

    let _ = window.with_webview(|webview| {
        #[allow(deprecated)]
        unsafe {
            use objc::{sel, sel_impl};
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

#[cfg(target_os = "windows")]
fn apply_effects(window: &WebviewWindow, r: u8, g: u8, b: u8, a: u8) {
    let _ = window_vibrancy::apply_acrylic(window, Some((r, g, b, a)));
}

#[cfg(target_os = "windows")]
fn clear_effects(window: &WebviewWindow) {
    let _ = window_vibrancy::clear_acrylic(window);
}

#[cfg(target_os = "macos")]
#[allow(deprecated)]
fn remove_vibrancy_views(content_view: cocoa::base::id) {
    use cocoa::base::id;
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
#[allow(deprecated)]
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
        let _: () = msg_send![effect_view, setMaterial: 13_i64];
        let _: () = msg_send![effect_view, setState: 1_i64];
        let _: () = msg_send![effect_view, setBlendingMode: 0_i64];
        let _: () = msg_send![effect_view, setAutoresizingMask: 18_u64];
        let _: () = msg_send![content_view, addSubview: effect_view positioned: -1_i64 relativeTo: nil];
    }

    let _ = window.with_webview(|webview| {
        #[allow(deprecated)]
        unsafe {
            use objc::{sel, sel_impl};
            let wk_webview: cocoa::base::id = webview.inner() as cocoa::base::id;
            let _: () = objc::msg_send![wk_webview, _setDrawsBackground: objc::runtime::NO];
        }
    });
}

#[cfg(target_os = "macos")]
#[allow(deprecated)]
fn clear_effects(window: &WebviewWindow) {
    use cocoa::appkit::NSWindow;
    use cocoa::base::id;

    let ns_win: id = window.ns_window().unwrap() as id;
    unsafe {
        let content_view: id = ns_win.contentView();
        remove_vibrancy_views(content_view);
    }
}

#[cfg(target_os = "linux")]
fn apply_effects(window: &WebviewWindow, r: u8, g: u8, b: u8, a: u8) {
    let _ = window_vibrancy::apply_blur(window, Some((r, g, b, a)));
}

#[cfg(target_os = "linux")]
fn clear_effects(window: &WebviewWindow) {
    let _ = window_vibrancy::clear_blur(window);
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
fn apply_effects(_window: &WebviewWindow, _r: u8, _g: u8, _b: u8, _a: u8) {}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
fn clear_effects(_window: &WebviewWindow) {}
