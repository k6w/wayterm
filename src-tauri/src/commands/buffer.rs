use crate::db::{self, terminal_buffers::BufferEntry, DbPool};
use tauri::State;

#[tauri::command]
pub async fn buffer_save_batch(
    entries: Vec<BufferEntry>,
    pool: State<'_, DbPool>,
) -> Result<(), String> {
    db::terminal_buffers::save_batch(&pool, &entries)
}

#[tauri::command]
pub async fn buffer_load_batch(
    pane_ids: Vec<String>,
    pool: State<'_, DbPool>,
) -> Result<Vec<BufferEntry>, String> {
    db::terminal_buffers::load_batch(&pool, &pane_ids)
}

#[tauri::command]
pub async fn buffer_cleanup(
    pool: State<'_, DbPool>,
) -> Result<u64, String> {
    db::terminal_buffers::cleanup_old(&pool)
}
