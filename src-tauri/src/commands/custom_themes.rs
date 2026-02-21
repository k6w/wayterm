use crate::db::{self, custom_themes::CustomThemeRow, DbPool};
use tauri::State;

#[tauri::command]
pub async fn custom_theme_list(
    pool: State<'_, DbPool>,
) -> Result<Vec<CustomThemeRow>, String> {
    db::custom_themes::list(&pool)
}

#[tauri::command]
pub async fn custom_theme_save(
    id: String,
    theme_json: String,
    pool: State<'_, DbPool>,
) -> Result<(), String> {
    db::custom_themes::save(&pool, &id, &theme_json)
}

#[tauri::command]
pub async fn custom_theme_delete(
    id: String,
    pool: State<'_, DbPool>,
) -> Result<(), String> {
    db::custom_themes::delete(&pool, &id)
}
