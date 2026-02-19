use tauri::WebviewWindow;

pub fn setup(window: Option<&WebviewWindow>) {
    let Some(_window) = window else { return };

    #[cfg(target_os = "windows")]
    {
        use window_vibrancy::apply_mica;
        let _ = apply_mica(_window, Some(true));
    }

    #[cfg(target_os = "macos")]
    {
        use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
        let _ = apply_vibrancy(
            _window,
            NSVisualEffectMaterial::UnderWindowBackground,
            None,
            None,
        );
    }
}
