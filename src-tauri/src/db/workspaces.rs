use super::DbPool;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceRow {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub layout: String,
    pub is_default: bool,
    pub created_at: String,
    pub updated_at: String,
}

pub fn list(pool: &DbPool) -> Result<Vec<WorkspaceRow>, String> {
    let conn = pool.lock();
    let mut stmt = conn
        .prepare(
            "SELECT id, name, icon, layout, is_default, created_at, updated_at \
             FROM workspaces ORDER BY name",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(WorkspaceRow {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: row.get(2)?,
                layout: row.get(3)?,
                is_default: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn save(pool: &DbPool, workspace: &WorkspaceRow) -> Result<(), String> {
    let conn = pool.lock();
    conn.execute(
        "INSERT OR REPLACE INTO workspaces (id, name, icon, layout, is_default, \
         created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,datetime('now'))",
        rusqlite::params![
            workspace.id,
            workspace.name,
            workspace.icon,
            workspace.layout,
            workspace.is_default,
            workspace.created_at,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete(pool: &DbPool, id: &str) -> Result<(), String> {
    let conn = pool.lock();
    conn.execute("DELETE FROM workspaces WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
