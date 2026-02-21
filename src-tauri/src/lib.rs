mod commands;
mod db;
mod pty;
mod theme;
mod window;

use tauri::{
    Emitter, Manager,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

/// Resolve a CLI path argument (e.g. "." or "src/") relative to `cwd`.
/// Returns `None` if the resolved path is not a valid directory.
fn resolve_cli_path(arg: &str, cwd: &str) -> Option<String> {
    let base = std::path::Path::new(cwd);
    let candidate = if std::path::Path::new(arg).is_absolute() {
        std::path::PathBuf::from(arg)
    } else {
        base.join(arg)
    };
    let resolved = candidate.canonicalize().ok()?;
    if !resolved.is_dir() {
        return None;
    }
    // canonicalize() on Windows returns \\?\ extended-length paths which
    // confuse PowerShell (shows Microsoft.PowerShell.Core\FileSystem:: prefix).
    // Strip the prefix to get a normal path.
    let s = resolved.to_string_lossy().to_string();
    let s = s.strip_prefix(r"\\?\").unwrap_or(&s).to_string();
    Some(s)
}

#[tauri::command]
fn get_home_dir() -> Option<String> {
    std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .ok()
}

#[tauri::command]
fn get_launch_cwd() -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 {
        let cwd = std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        return resolve_cli_path(&args[1], &cwd);
    }
    None
}

fn show_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            // Second instance launched — send its args to the running window.
            // Resolve the path arg (if any) and emit an event to the frontend.
            let open_cwd = if args.len() > 1 {
                resolve_cli_path(&args[1], &cwd)
            } else {
                None
            };

            if let Some(path) = &open_cwd {
                let _ = app.emit("cli-open-tab", path.clone());
            }

            show_window(app);
        }))
        .setup(|app| {
            let app_data = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            let pool = db::init(&app_data).expect("failed to init database");
            app.manage(pool);
            app.manage(pty::manager::PtyManager::new());
            window::setup(app.get_webview_window("main").as_ref());

            // ── System tray ──
            let show_item = MenuItem::with_id(app, "show", "Show Nexterm", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Nexterm")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::terminal::terminal_spawn,
            commands::terminal::terminal_write,
            commands::terminal::terminal_resize,
            commands::terminal::terminal_kill,
            commands::terminal::terminal_history_search,
            commands::terminal::terminal_history_recent,
            commands::terminal::terminal_history_add,
            commands::settings::settings_get,
            commands::settings::settings_set,
            commands::settings::settings_get_all,
            commands::ssh::ssh_list_connections,
            commands::ssh::ssh_save_connection,
            commands::ssh::ssh_delete_connection,
            commands::ssh::ssh_list_keys,
            commands::ssh::ssh_import_key,
            commands::ssh::ssh_delete_key,
            commands::ssh::ssh_get_key_temp_path,
            commands::workspace::workspace_list,
            commands::workspace::workspace_save,
            commands::workspace::workspace_delete,
            commands::buffer::buffer_save_batch,
            commands::buffer::buffer_load_batch,
            commands::buffer::buffer_cleanup,
            commands::custom_themes::custom_theme_list,
            commands::custom_themes::custom_theme_save,
            commands::custom_themes::custom_theme_delete,
            window::set_vibrancy,
            get_launch_cwd,
            get_home_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
