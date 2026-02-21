use super::DbPool;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BufferEntry {
    pub pane_id: String,
    pub buffer_data: String,
}

pub fn save_batch(pool: &DbPool, entries: &[BufferEntry]) -> Result<(), String> {
    let conn = pool.lock();
    conn.execute_batch("BEGIN").map_err(|e| e.to_string())?;

    let result = (|| {
        let mut stmt = conn
            .prepare(
                "INSERT OR REPLACE INTO terminal_buffers (pane_id, buffer_data, updated_at) \
                 VALUES (?1, ?2, datetime('now'))",
            )
            .map_err(|e| e.to_string())?;

        for entry in entries {
            stmt.execute(rusqlite::params![entry.pane_id, entry.buffer_data])
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    })();

    if result.is_ok() {
        conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
    } else {
        let _ = conn.execute_batch("ROLLBACK");
    }

    result
}

pub fn load_batch(pool: &DbPool, pane_ids: &[String]) -> Result<Vec<BufferEntry>, String> {
    if pane_ids.is_empty() {
        return Ok(vec![]);
    }

    let conn = pool.lock();
    let placeholders: Vec<String> = pane_ids.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();
    let sql = format!(
        "SELECT pane_id, buffer_data FROM terminal_buffers WHERE pane_id IN ({})",
        placeholders.join(",")
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let params: Vec<&dyn rusqlite::types::ToSql> = pane_ids
        .iter()
        .map(|id| id as &dyn rusqlite::types::ToSql)
        .collect();

    let rows = stmt
        .query_map(params.as_slice(), |row| {
            Ok(BufferEntry {
                pane_id: row.get(0)?,
                buffer_data: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn cleanup_old(pool: &DbPool) -> Result<u64, String> {
    let conn = pool.lock();
    let deleted = conn
        .execute(
            "DELETE FROM terminal_buffers WHERE updated_at < datetime('now', '-7 days')",
            [],
        )
        .map_err(|e| e.to_string())?;
    Ok(deleted as u64)
}
