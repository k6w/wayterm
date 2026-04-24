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
    pty_manager.spawn(
        session_id.clone(),
        &request.shell,
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
