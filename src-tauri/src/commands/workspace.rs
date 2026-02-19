use crate::db::{self, workspaces::WorkspaceRow, DbPool};
use tauri::State;

#[tauri::command]
pub async fn workspace_list(
    pool: State<'_, DbPool>,
) -> Result<Vec<WorkspaceRow>, String> {
    db::workspaces::list(&pool)
}

#[tauri::command]
pub async fn workspace_save(
    workspace: WorkspaceRow,
    pool: State<'_, DbPool>,
) -> Result<(), String> {
    db::workspaces::save(&pool, &workspace)
}

#[tauri::command]
pub async fn workspace_delete(
    id: String,
    pool: State<'_, DbPool>,
) -> Result<(), String> {
    db::workspaces::delete(&pool, &id)
}
