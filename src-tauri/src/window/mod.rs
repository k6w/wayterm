use tauri::WebviewWindow;

pub fn setup(window: Option<&WebviewWindow>) {
    #[cfg(target_os = "macos")]
    if let Some(window) = window {
        macos_setup(window);
    }

    #[cfg(not(target_os = "macos"))]
    let _ = window;
}

// CSS distance from the window's top edge to the vertical centre of the
// unified 36px title bar at 1x zoom. The webview content is scaled by the
// UI-scale zoom, so the native buttons must be re-centred at
// TAB_CENTER_CSS * scale to stay aligned with the zoomed title bar.
#[cfg(target_os = "macos")]
const TAB_CENTER_CSS: f64 = 18.0;

// Current UI zoom factor, kept in sync with the appearance setting (stored as
// f64 bits; the literal is 1.0f64.to_bits()).
#[cfg(target_os = "macos")]
static UI_SCALE_BITS: std::sync::atomic::AtomicU64 =
    std::sync::atomic::AtomicU64::new(4607182418800017408);

/// Re-centre the native traffic lights on the (zoomed) custom tab strip instead
/// of letting them hug the very top of the window. Uses an absolute target so it
/// is safe to re-apply on resize/zoom without the buttons drifting.
#[cfg(target_os = "macos")]
#[allow(deprecated)]
unsafe fn position_traffic_lights(ns_win: cocoa::base::id) {
    use cocoa::appkit::{NSWindow, NSWindowButton};
    use cocoa::base::{id, nil};
    use cocoa::foundation::{NSPoint, NSRect};
    use objc::{msg_send, sel, sel_impl};
    use std::sync::atomic::Ordering;

    let scale = f64::from_bits(UI_SCALE_BITS.load(Ordering::Relaxed));
    let center_from_top = TAB_CENTER_CSS * scale;

    let buttons = [
        NSWindowButton::NSWindowCloseButton,
        NSWindowButton::NSWindowMiniaturizeButton,
        NSWindowButton::NSWindowZoomButton,
    ];
    for kind in buttons {
        let button: id = ns_win.standardWindowButton_(kind);
        if button == nil {
            continue;
        }
        let superview: id = msg_send![button, superview];
        if superview == nil {
            continue;
        }
        let sv_frame: NSRect = msg_send![superview, frame];
        let btn_frame: NSRect = msg_send![button, frame];
        // Cocoa's origin is bottom-left: centre the fixed-size button at
        // `center_from_top` px down from the window's top edge.
        let target_y =
            sv_frame.size.height - center_from_top - btn_frame.size.height / 2.0;
        let origin = NSPoint::new(btn_frame.origin.x, target_y);
        let _: () = msg_send![button, setFrameOrigin: origin];
    }
}

/// Update the UI zoom factor the traffic-light positioning uses and re-apply it.
/// Called from the frontend whenever the applied UI scale changes.
#[tauri::command]
#[allow(deprecated)]
pub fn set_traffic_light_scale(window: WebviewWindow, scale: f64) {
    #[cfg(target_os = "macos")]
    {
        UI_SCALE_BITS.store(scale.to_bits(), std::sync::atomic::Ordering::Relaxed);
        let win = window.clone();
        let _ = window.run_on_main_thread(move || {
            if let Ok(ns) = win.ns_window() {
                unsafe { position_traffic_lights(ns as cocoa::base::id) };
            }
        });
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (window, scale);
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
        position_traffic_lights(ns_win);
    }

    // AppKit resets the button positions on resize/fullscreen, so re-apply.
    let win = window.clone();
    window.on_window_event(move |event| {
        if matches!(
            event,
            tauri::WindowEvent::Resized(_) | tauri::WindowEvent::Focused(_)
        ) {
            // Resolve the NSWindow pointer on the main thread (it is !Send, so
            // it must not cross the thread boundary itself).
            let w = win.clone();
            let _ = win.run_on_main_thread(move || {
                if let Ok(ns) = w.ns_window() {
                    unsafe { position_traffic_lights(ns as cocoa::base::id) };
                }
            });
        }
    });

    // AppKit's first layout pass lands after setup() returns, overwriting the
    // initial placement — and no resize event fires at launch to trigger the
    // handler above. Re-apply a few times as the window settles so the buttons
    // are correct on startup without needing a manual resize.
    let win_init = window.clone();
    std::thread::spawn(move || {
        for delay in [60u64, 150, 350, 700] {
            std::thread::sleep(std::time::Duration::from_millis(delay));
            let w = win_init.clone();
            let _ = win_init.run_on_main_thread(move || {
                if let Ok(ns) = w.ns_window() {
                    unsafe { position_traffic_lights(ns as cocoa::base::id) };
                }
            });
        }
    });

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
