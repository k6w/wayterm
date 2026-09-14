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
    /// When the workspace was last opened; `None` until it is.
    #[serde(default)]
    pub last_opened_at: Option<String>,
}

pub fn list(pool: &DbPool) -> Result<Vec<WorkspaceRow>, String> {
    let conn = pool.lock();
    let mut stmt = conn
        .prepare(
            "SELECT id, name, icon, layout, is_default, created_at, updated_at, last_opened_at \
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
                last_opened_at: row.get(7)?,
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
         created_at, updated_at, last_opened_at) VALUES (?1,?2,?3,?4,?5,?6,datetime('now'),?7)",
        rusqlite::params![
            workspace.id,
            workspace.name,
            workspace.icon,
            workspace.layout,
            workspace.is_default,
            workspace.created_at,
            workspace.last_opened_at,
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

#[cfg(test)]
mod tests {
    use super::*;
    use parking_lot::Mutex;
    use rusqlite::Connection;
    use std::sync::Arc;

    fn pool() -> DbPool {
        let pool: DbPool = Arc::new(Mutex::new(Connection::open_in_memory().unwrap()));
        crate::db::migrations::run(&pool).unwrap();
        pool
    }

    fn row(id: &str, last_opened_at: Option<&str>) -> WorkspaceRow {
        WorkspaceRow {
            id: id.into(),
            name: format!("ws {id}"),
            icon: None,
            layout: "{\"version\":2}".into(),
            is_default: false,
            created_at: "2026-01-01T00:00:00.000Z".into(),
            updated_at: "2026-01-01T00:00:00.000Z".into(),
            last_opened_at: last_opened_at.map(String::from),
        }
    }

    #[test]
    fn last_opened_at_round_trips() {
        let pool = pool();
        save(&pool, &row("a", Some("2026-02-02T10:00:00.000Z"))).unwrap();
        save(&pool, &row("b", None)).unwrap();
        let rows = list(&pool).unwrap();
        assert_eq!(rows[0].last_opened_at.as_deref(), Some("2026-02-02T10:00:00.000Z"));
        assert_eq!(rows[1].last_opened_at, None);
    }

    #[test]
    fn records_saved_before_the_column_existed_still_load() {
        let pool = pool();
        {
            let conn = pool.lock();
            conn.execute(
                "INSERT INTO workspaces (id, name, layout) VALUES ('old', 'Old', '{\"tabs\":[],\"panes\":{}}')",
                [],
            )
            .unwrap();
        }
        let rows = list(&pool).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].layout, "{\"tabs\":[],\"panes\":{}}");
        assert_eq!(rows[0].last_opened_at, None);
    }

    #[test]
    fn the_request_may_omit_last_opened_at() {
        let parsed: WorkspaceRow = serde_json::from_str(
            r#"{"id":"x","name":"X","icon":null,"layout":"{}","isDefault":false,"createdAt":"c","updatedAt":"u"}"#,
        )
        .unwrap();
        assert_eq!(parsed.last_opened_at, None);
    }
}
