use super::DbPool;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomThemeRow {
    pub id: String,
    pub theme_json: String,
}

pub fn list(pool: &DbPool) -> Result<Vec<CustomThemeRow>, String> {
    let conn = pool.lock();
    let mut stmt = conn
        .prepare("SELECT id, theme_json FROM custom_themes ORDER BY created_at")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(CustomThemeRow {
                id: row.get(0)?,
                theme_json: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn save(pool: &DbPool, id: &str, theme_json: &str) -> Result<(), String> {
    let conn = pool.lock();
    conn.execute(
        "INSERT OR REPLACE INTO custom_themes (id, theme_json, created_at) \
         VALUES (?1, ?2, datetime('now'))",
        rusqlite::params![id, theme_json],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete(pool: &DbPool, id: &str) -> Result<(), String> {
    let conn = pool.lock();
    conn.execute("DELETE FROM custom_themes WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
