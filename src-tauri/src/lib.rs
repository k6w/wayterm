mod commands;
mod db;
mod pty;
mod ssh;
mod theme;
mod window;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_data = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            let pool = db::init(&app_data).expect("failed to init database");
            app.manage(pool);
            app.manage(pty::manager::PtyManager::new());
            window::setup(app.get_webview_window("main").as_ref());
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
