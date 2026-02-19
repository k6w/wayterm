use crate::db::{self, DbPool};
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub async fn settings_get(
    key: String,
    pool: State<'_, DbPool>,
) -> Result<Option<Value>, String> {
    db::settings::get(&pool, &key)
}

#[tauri::command]
pub async fn settings_set(
    key: String,
    value: Value,
    pool: State<'_, DbPool>,
) -> Result<(), String> {
    db::settings::set(&pool, &key, &value)
}

#[tauri::command]
pub async fn settings_get_all(
    pool: State<'_, DbPool>,
) -> Result<serde_json::Map<String, Value>, String> {
    db::settings::get_all(&pool)
}
