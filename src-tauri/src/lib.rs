mod commands;
mod crypto;
mod db;
mod known_hosts;
mod pty;
mod port_forward;
mod shell_integration;
mod sftp;
mod ssh_config;
mod theme;
mod window;

use tauri::{
    Emitter, Manager,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};



/// macOS gets a monochrome template image (adapts to light/dark menu bars and
/// the selected state); other platforms keep the colored app icon.
#[cfg(target_os = "macos")]
const TRAY_ICON_IS_TEMPLATE: bool = true;
#[cfg(not(target_os = "macos"))]
const TRAY_ICON_IS_TEMPLATE: bool = false;

/// The 2x template PNG; macOS downsamples it on non-Retina displays.
#[cfg(any(target_os = "macos", test))]
const TRAY_TEMPLATE_PNG: &[u8] = include_bytes!("../icons/tray/trayTemplate@2x.png");

#[cfg(target_os = "macos")]
fn tray_icon<R: tauri::Runtime>(_app: &tauri::App<R>) -> Option<tauri::image::Image<'static>> {
    tauri::image::Image::from_bytes(TRAY_TEMPLATE_PNG).ok()
}

#[cfg(not(target_os = "macos"))]
fn tray_icon<R: tauri::Runtime>(app: &tauri::App<R>) -> Option<tauri::image::Image<'static>> {
    // The window icon borrows from the app; the tray needs an owned copy.
    app.default_window_icon().cloned().map(tauri::image::Image::to_owned)
}

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
            app.manage(sftp::session::SftpSessionManager::new());
            app.manage(port_forward::PortForwardManager::new());
            app.manage(commands::database::DatabaseManager::new());
            app.manage(commands::serial::SerialManager::new());
            window::setup(app.get_webview_window("main").as_ref());

            // ── System tray ──
            let show_item = MenuItem::with_id(app, "show", "Show Nexterm", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let tray_builder = TrayIconBuilder::new().tooltip("Nexterm")
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
                ;
            let tray_builder = match tray_icon(app) {
                Some(icon) => tray_builder.icon(icon).icon_as_template(TRAY_ICON_IS_TEMPLATE),
                None => tray_builder,
            };
            let _tray = tray_builder.build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::terminal::terminal_spawn,
            commands::terminal::terminal_write,
            commands::terminal::terminal_resize,
            commands::terminal::terminal_kill,
            commands::terminal::terminal_cwd,
            commands::terminal::terminal_dir_exists,
            commands::terminal::terminal_history_search,
            commands::terminal::terminal_history_recent,
            commands::terminal::terminal_history_add,
            commands::terminal::path_exists,
            commands::terminal::find_executable,
            commands::terminal::shell_info,
            commands::settings::settings_get,
            commands::settings::settings_set,
            commands::settings::settings_get_all,
            commands::ssh::ssh_list_connections,
            commands::ssh::ssh_save_connection,
            commands::ssh::ssh_delete_connection,
            commands::ssh::ssh_list_keys,
            commands::ssh::ssh_import_key,
            commands::ssh::ssh_delete_key,
            commands::ssh::ssh_update_key,
            commands::ssh::ssh_get_key_temp_path,
            commands::ssh::ssh_list_port_forwards,
            commands::ssh::ssh_save_port_forward,
            commands::ssh::ssh_delete_port_forward,
            commands::ssh::ssh_toggle_port_forward,
            commands::ssh_config::ssh_config_hosts,
            commands::ssh_config::ssh_config_import,
            commands::ssh_config::ssh_local_user,
            commands::terminal::terminal_log_start,
            commands::terminal::terminal_log_stop,
            commands::terminal::terminal_log_write,
            commands::workspace::workspace_list,
            commands::workspace::workspace_save,
            commands::workspace::workspace_delete,
            commands::buffer::buffer_save_batch,
            commands::buffer::buffer_load_batch,
            commands::buffer::buffer_cleanup,
            commands::custom_themes::custom_theme_list,
            commands::custom_themes::custom_theme_save,
            commands::custom_themes::custom_theme_delete,
            commands::git::git_get_branch,
            commands::git::git_is_dirty,
            commands::git::git_get_status,
            commands::git::git_get_branches,
            commands::git::git_get_commits,
            commands::git::git_get_remotes,
            commands::git::git_get_diff,
            commands::git::git_init,
            commands::git::git_checkout,
            commands::git::git_pull,
            commands::git::git_push,
            commands::git::git_commit,
            commands::git::git_stage,
            commands::git::git_unstage,
            commands::git::git_stash,
            commands::git::git_stash_pop,
            commands::database::db_list_connections,
            commands::database::db_save_connection,
            commands::database::db_delete_connection,
            commands::database::db_connect,
            commands::database::db_disconnect,
            commands::database::db_execute_query,
            commands::database::db_get_tables,
            commands::database::db_get_table_schema,
            commands::known_hosts::ssh_known_hosts_list,
            commands::known_hosts::ssh_known_hosts_remove,
            commands::known_hosts::ssh_known_hosts_add,
            commands::known_hosts::ssh_known_hosts_clear,
            commands::known_hosts::ssh_known_hosts_replace,
            commands::known_hosts::ssh_check_host_key,
            commands::known_hosts::ssh_get_pending_host_key,
            commands::known_hosts::ssh_clear_pending_host_key,
            commands::serial::serial_list_ports,
            commands::serial::serial_open,
            commands::serial::serial_write,
            commands::serial::serial_close,
            commands::sftp::sftp_connect,
            commands::sftp::sftp_disconnect,
            commands::sftp::sftp_list_dir,
            commands::sftp::sftp_mkdir,
            commands::sftp::sftp_remove,
            commands::sftp::sftp_rename,
            commands::sftp::sftp_download,
            commands::sftp::sftp_upload,
            commands::sftp::sftp_chmod,
            commands::sftp::local_list_dir,
            window::set_vibrancy,
            window::set_traffic_light_scale,
            window::set_window_title,
            get_launch_cwd,
            get_home_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
#[cfg(test)]
mod tray_icon_tests {
    use super::*;

    #[test]
    fn tray_template_is_black_rgba_with_varying_alpha() {
        let img = tauri::image::Image::from_bytes(TRAY_TEMPLATE_PNG).expect("decodes");
        assert_eq!((img.width(), img.height()), (36, 36));
        let px = img.rgba();
        assert_eq!(px.len(), 36 * 36 * 4);
        let mut alphas = std::collections::HashSet::new();
        for p in px.as_chunks::<4>().0 {
            // Fully transparent pixels may carry any color; only visible ones must be black.
            if p[3] > 0 {
                assert_eq!(p[..3], [0, 0, 0], "template pixels must be pure black");
            }
            alphas.insert(p[3]);
        }
        assert!(alphas.contains(&0) && alphas.contains(&255) && alphas.len() > 2);
    }

    #[test]
    fn template_flag_matches_platform() {
        assert_eq!(TRAY_ICON_IS_TEMPLATE, cfg!(target_os = "macos"));
    }
}
