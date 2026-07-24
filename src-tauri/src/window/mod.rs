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
// UI-scale zoom, so the native buttons are centred at
// TITLEBAR_CENTER_CSS * scale to stay aligned with the zoomed title bar.
#[cfg(any(target_os = "macos", test))]
const TITLEBAR_CENTER_CSS: f64 = 18.0;

// Delays (ms) for re-applying the traffic-light position after something that
// makes AppKit lay out the title bar again on a later run-loop pass: the first
// window layout after setup(), and every window-title change. AppKit resets the
// standard buttons to their default frame (about 6pt higher) during that pass,
// and no Resized/Focused event fires for it.
#[cfg(target_os = "macos")]
const RELAYOUT_RETRY_MS: [u64; 4] = [16, 60, 150, 350];
#[cfg(target_os = "macos")]
const STARTUP_RETRY_MS: [u64; 4] = [60, 150, 350, 700];

// Current UI zoom factor, kept in sync with the appearance setting (stored as
// f64 bits; the literal is 1.0f64.to_bits()).
#[cfg(target_os = "macos")]
static UI_SCALE_BITS: std::sync::atomic::AtomicU64 =
    std::sync::atomic::AtomicU64::new(4607182418800017408);

/// Cocoa y origin (bottom-left based) that centres a button of `button_height`
/// at `TITLEBAR_CENTER_CSS * scale` points below the top of a superview of
/// `superview_height`. Absolute, so re-applying it never drifts.
#[cfg(any(target_os = "macos", test))]
fn traffic_light_origin_y(superview_height: f64, button_height: f64, scale: f64) -> f64 {
    let scale = if scale.is_finite() && scale > 0.0 { scale } else { 1.0 };
    superview_height - TITLEBAR_CENTER_CSS * scale - button_height / 2.0
}

/// Re-centre the native traffic lights on the (zoomed) custom title bar instead
/// of letting them hug the very top of the window.
#[cfg(target_os = "macos")]
#[allow(deprecated)]
unsafe fn position_traffic_lights(ns_win: cocoa::base::id) {
    use cocoa::appkit::{NSWindow, NSWindowButton};
    use cocoa::base::{id, nil};
    use cocoa::foundation::{NSPoint, NSRect};
    use objc::{msg_send, sel, sel_impl};
    use std::sync::atomic::Ordering;

    let scale = f64::from_bits(UI_SCALE_BITS.load(Ordering::Relaxed));

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
        let target_y = traffic_light_origin_y(sv_frame.size.height, btn_frame.size.height, scale);
        let origin = NSPoint::new(btn_frame.origin.x, target_y);
        let _: () = msg_send![button, setFrameOrigin: origin];
    }
}

/// Position the traffic lights now, on the main thread.
#[cfg(target_os = "macos")]
#[allow(deprecated)]
fn reposition_now(window: &WebviewWindow) {
    // Resolve the NSWindow pointer on the main thread (it is !Send, so it must
    // not cross the thread boundary itself).
    let w = window.clone();
    let _ = window.run_on_main_thread(move || {
        if let Ok(ns) = w.ns_window() {
            unsafe { position_traffic_lights(ns as cocoa::base::id) };
        }
    });
}

/// Position the traffic lights now and again after each delay, so a title-bar
/// layout pass that AppKit runs later cannot leave them at the default frame.
#[cfg(target_os = "macos")]
fn reposition_with_retries(window: &WebviewWindow, delays_ms: &'static [u64]) {
    reposition_now(window);
    let win = window.clone();
    std::thread::spawn(move || {
        for delay in delays_ms {
            std::thread::sleep(std::time::Duration::from_millis(*delay));
            reposition_now(&win);
        }
    });
}

/// Update the UI zoom factor the traffic-light positioning uses and re-apply it.
/// Called from the frontend whenever the applied UI scale changes.
#[tauri::command]
pub fn set_traffic_light_scale(window: WebviewWindow, scale: f64) {
    #[cfg(target_os = "macos")]
    {
        UI_SCALE_BITS.store(scale.to_bits(), std::sync::atomic::Ordering::Relaxed);
        reposition_now(&window);
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (window, scale);
}

/// Set the window title. On macOS a title change makes AppKit lay out the title
/// bar again, which resets the traffic lights to their default position, so
/// they are re-applied afterwards. Use this instead of the JS setTitle().
#[tauri::command]
pub fn set_window_title(window: WebviewWindow, title: String) -> Result<(), String> {
    window.set_title(&title).map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    reposition_with_retries(&window, &RELAYOUT_RETRY_MS);
    Ok(())
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
            reposition_now(&win);
        }
    });

    // AppKit's first layout pass lands after setup() returns, overwriting the
    // initial placement, and no resize event fires at launch to trigger the
    // handler above. Re-apply a few times as the window settles.
    reposition_with_retries(window, &STARTUP_RETRY_MS);

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn centres_the_buttons_on_the_36px_title_bar() {
        // 28pt superview, 14pt button: centre 18pt down -> origin 28 - 18 - 7.
        assert_eq!(traffic_light_origin_y(28.0, 14.0, 1.0), 3.0);
    }

    #[test]
    fn scales_the_centre_with_the_ui_zoom() {
        assert_eq!(traffic_light_origin_y(52.0, 14.0, 1.25), 52.0 - 22.5 - 7.0);
    }

    #[test]
    fn falls_back_to_1x_for_a_bad_scale() {
        let one = traffic_light_origin_y(28.0, 14.0, 1.0);
        assert_eq!(traffic_light_origin_y(28.0, 14.0, 0.0), one);
        assert_eq!(traffic_light_origin_y(28.0, 14.0, f64::NAN), one);
        assert_eq!(traffic_light_origin_y(28.0, 14.0, -2.0), one);
    }
}
