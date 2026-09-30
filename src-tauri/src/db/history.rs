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

/// Commands kept; shells with the integration record every command they run.
const MAX_HISTORY: i64 = 10_000;

pub fn add(
    pool: &DbPool,
    session_id: &str,
    command: &str,
    exit_code: Option<i32>,
    cwd: Option<&str>,
) -> Result<i64, String> {
    add_capped(pool, session_id, command, exit_code, cwd, MAX_HISTORY)
}

/// Inserts a command and drops the oldest ones beyond `cap`.
fn add_capped(
    pool: &DbPool,
    session_id: &str,
    command: &str,
    exit_code: Option<i32>,
    cwd: Option<&str>,
    cap: i64,
) -> Result<i64, String> {
    let conn = pool.lock();
    conn.execute(
        "INSERT INTO history (session_id, command, exit_code, cwd) VALUES (?1,?2,?3,?4)",
        rusqlite::params![session_id, command, exit_code, cwd],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    conn.execute("DELETE FROM history WHERE id <= ?1", rusqlite::params![id - cap])
        .map_err(|e| e.to_string())?;
    Ok(id)
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

#[cfg(test)]
mod tests {
    use super::*;
    use parking_lot::Mutex;
    use rusqlite::Connection;
    use std::sync::Arc;

    #[test]
    fn keeps_only_the_newest_commands() {
        let pool: DbPool = Arc::new(Mutex::new(Connection::open_in_memory().unwrap()));
        crate::db::migrations::run(&pool).unwrap();
        for i in 0..7 {
            add_capped(&pool, "s", &format!("cmd {i}"), Some(0), None, 3).unwrap();
        }
        let commands: Vec<String> = recent(&pool, 10).unwrap().into_iter().map(|e| e.command).collect();
        assert_eq!(commands.len(), 3);
        for c in ["cmd 4", "cmd 5", "cmd 6"] {
            assert!(commands.contains(&c.to_string()), "{commands:?}");
        }
    }
}
