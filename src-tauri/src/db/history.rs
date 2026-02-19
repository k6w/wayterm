use super::DbPool;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: i64,
    pub session_id: String,
    pub command: String,
    pub exit_code: Option<i32>,
    pub cwd: Option<String>,
    pub executed_at: String,
}

pub fn add(
    pool: &DbPool,
    session_id: &str,
    command: &str,
    exit_code: Option<i32>,
    cwd: Option<&str>,
) -> Result<i64, String> {
    let conn = pool.lock();
    conn.execute(
        "INSERT INTO history (session_id, command, exit_code, cwd) VALUES (?1,?2,?3,?4)",
        rusqlite::params![session_id, command, exit_code, cwd],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

pub fn search(pool: &DbPool, query: &str, limit: i32) -> Result<Vec<HistoryEntry>, String> {
    let conn = pool.lock();
    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, command, exit_code, cwd, executed_at \
             FROM history WHERE command LIKE ?1 \
             ORDER BY executed_at DESC LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let pattern = format!("%{}%", query);
    let rows = stmt
        .query_map(rusqlite::params![pattern, limit], |row| {
            Ok(HistoryEntry {
                id: row.get(0)?,
                session_id: row.get(1)?,
                command: row.get(2)?,
                exit_code: row.get(3)?,
                cwd: row.get(4)?,
                executed_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn recent(pool: &DbPool, limit: i32) -> Result<Vec<HistoryEntry>, String> {
    let conn = pool.lock();
    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, command, exit_code, cwd, executed_at \
             FROM history ORDER BY executed_at DESC LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([limit], |row| {
            Ok(HistoryEntry {
                id: row.get(0)?,
                session_id: row.get(1)?,
                command: row.get(2)?,
                exit_code: row.get(3)?,
                cwd: row.get(4)?,
                executed_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}
