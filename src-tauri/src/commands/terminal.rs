use crate::db::{self, DbPool};
use crate::pty::manager::PtyManager;
use std::collections::HashMap;
use std::fs::OpenOptions;
use std::io::Write;
use std::sync::Mutex;
use tauri::{AppHandle, State};
use uuid::Uuid;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnRequest {
    pub shell: String,
    pub args: Vec<String>,
    pub cwd: String,
    pub env: Vec<(String, String)>,
    pub rows: u16,
    pub cols: u16,
}

#[tauri::command]
pub async fn terminal_spawn(
    request: SpawnRequest,
    pty_manager: State<'_, PtyManager>,
    app: AppHandle,
) -> Result<String, String> {
    let session_id = Uuid::new_v4().to_string();
    let shell = if request.shell.trim().is_empty() {
        select_login_shell(std::env::var("SHELL").ok().as_deref(), cfg!(target_os = "macos"))
    } else {
        request.shell.clone()
    };
    pty_manager.spawn(
        session_id.clone(),
        &shell,
        &request.args,
        &request.cwd,
        &request.env,
        request.rows,
        request.cols,
        app,
    )?;
    Ok(session_id)
}

#[tauri::command]
pub async fn terminal_write(
    session_id: String,
    data: Vec<u8>,
    pty_manager: State<'_, PtyManager>,
) -> Result<(), String> {
    pty_manager.write(&session_id, &data)
}

#[tauri::command]
pub async fn terminal_resize(
    session_id: String,
    rows: u16,
    cols: u16,
    pty_manager: State<'_, PtyManager>,
) -> Result<(), String> {
    pty_manager.resize(&session_id, rows, cols)
}

#[tauri::command]
pub async fn terminal_kill(
    session_id: String,
    pty_manager: State<'_, PtyManager>,
) -> Result<(), String> {
    pty_manager.kill(&session_id)
}

#[tauri::command]
pub async fn terminal_history_search(
    query: String,
    limit: i32,
    pool: State<'_, DbPool>,
) -> Result<Vec<db::history::HistoryEntry>, String> {
    db::history::search(&pool, &query, limit)
}

#[tauri::command]
pub async fn terminal_history_recent(
    limit: i32,
    pool: State<'_, DbPool>,
) -> Result<Vec<db::history::HistoryEntry>, String> {
    db::history::recent(&pool, limit)
}

#[tauri::command]
pub async fn terminal_history_add(
    session_id: String,
    command: String,
    exit_code: Option<i32>,
    cwd: Option<String>,
    pool: State<'_, DbPool>,
) -> Result<i64, String> {
    db::history::add(&pool, &session_id, &command, exit_code, cwd.as_deref())
}

#[tauri::command]
pub async fn path_exists(path: String) -> Result<bool, String> {
    Ok(std::path::Path::new(&path).exists())
}

#[tauri::command]
pub async fn find_executable(name: String) -> Option<String> {
    let path_var = std::env::var("PATH").ok()?;

    #[cfg(target_os = "windows")]
    {
        let path_ext = std::env::var("PATHEXT")
            .unwrap_or_else(|_| ".EXE;.CMD;.BAT;.COM".to_string());
        let exts: Vec<String> = path_ext
            .split(';')
            .map(|s| s.to_ascii_lowercase())
            .collect();

        for dir in std::env::split_paths(&path_var) {
            // Try name as-is first (handles case where name already has extension)
            let as_is = dir.join(&name);
            if as_is.exists() {
                return Some(as_is.to_string_lossy().into_owned());
            }
            for ext in &exts {
                let candidate = dir.join(format!("{}{}", name, ext));
                if candidate.exists() {
                    return Some(candidate.to_string_lossy().into_owned());
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::os::unix::fs::PermissionsExt;
        for dir in std::env::split_paths(&path_var) {
            let candidate = dir.join(&name);
            if let Ok(meta) = candidate.metadata() {
                if meta.is_file() && meta.permissions().mode() & 0o111 != 0 {
                    return Some(candidate.to_string_lossy().into_owned());
                }
            }
        }
    }

    None
}

static SESSION_LOGS: Mutex<Option<HashMap<String, std::fs::File>>> = Mutex::new(None);

fn get_session_logs() -> std::sync::MutexGuard<'static, Option<HashMap<String, std::fs::File>>> {
    SESSION_LOGS.lock().unwrap()
}

#[tauri::command]
pub async fn terminal_log_start(session_id: String, path: String) -> Result<(), String> {
    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("Failed to open log file: {}", e))?;

    let mut logs = get_session_logs();
    if logs.is_none() {
        *logs = Some(HashMap::new());
    }
    logs.as_mut().unwrap().insert(session_id, file);
    Ok(())
}

#[tauri::command]
pub async fn terminal_log_stop(session_id: String) -> Result<(), String> {
    let mut logs = get_session_logs();
    if let Some(ref mut map) = *logs {
        map.remove(&session_id);
    }
    Ok(())
}

#[tauri::command]
pub async fn terminal_log_write(session_id: String, data: Vec<u8>) -> Result<(), String> {
    let mut logs = get_session_logs();
    if let Some(ref mut map) = *logs {
        if let Some(file) = map.get_mut(&session_id) {
            file.write_all(&data).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// Pick the user's login shell: `$SHELL` when set, else the platform default.
pub(crate) fn select_login_shell(env_shell: Option<&str>, is_macos: bool) -> String {
    match env_shell.map(str::trim) {
        Some(s) if !s.is_empty() => s.to_string(),
        _ if is_macos => "/bin/zsh".to_string(),
        _ => "/bin/bash".to_string(),
    }
}

/// Parse /etc/shells content: absolute paths only, comments and blanks skipped, deduplicated in order.
pub(crate) fn parse_etc_shells(content: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for line in content.lines() {
        let line = line.split('#').next().unwrap_or("").trim();
        if line.starts_with('/') && !out.iter().any(|s| s == line) {
            out.push(line.to_string());
        }
    }
    out
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellInfo {
    pub login_shell: Option<String>,
    pub shells: Vec<String>,
}

#[tauri::command]
pub async fn shell_info() -> Result<ShellInfo, String> {
    #[cfg(target_os = "windows")]
    {
        Ok(ShellInfo { login_shell: None, shells: Vec::new() })
    }
    #[cfg(not(target_os = "windows"))]
    {
        let env_shell = std::env::var("SHELL").ok();
        let login = select_login_shell(env_shell.as_deref(), cfg!(target_os = "macos"));
        let content = std::fs::read_to_string("/etc/shells").unwrap_or_default();
        let mut shells = parse_etc_shells(&content);
        if !shells.contains(&login) {
            shells.push(login.clone());
        }
        shells.retain(|s| std::path::Path::new(s).exists());
        Ok(ShellInfo { login_shell: Some(login), shells })
    }
}

#[cfg(test)]
mod shell_tests {
    use super::*;

    #[test]
    fn login_shell_prefers_env() {
        assert_eq!(select_login_shell(Some("/usr/bin/fish"), true), "/usr/bin/fish");
        assert_eq!(select_login_shell(Some("  "), true), "/bin/zsh");
        assert_eq!(select_login_shell(None, true), "/bin/zsh");
        assert_eq!(select_login_shell(None, false), "/bin/bash");
    }

    #[test]
    fn parses_etc_shells() {
        let content = "# comment\n/bin/sh\n\n/bin/zsh # trailing\n/bin/sh\nnologin\n  /bin/bash  \n";
        assert_eq!(parse_etc_shells(content), vec!["/bin/sh", "/bin/zsh", "/bin/bash"]);
    }
}
