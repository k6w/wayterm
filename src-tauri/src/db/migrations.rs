use super::DbPool;

const MIGRATION_001: &str = include_str!("../../migrations/001_initial.sql");

pub fn run(pool: &DbPool) -> Result<(), String> {
    let conn = pool.lock();
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);",
    )
    .map_err(|e| e.to_string())?;

    let current: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if current < 1 {
        conn.execute_batch(MIGRATION_001)
            .map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO schema_version (version) VALUES (1)", [])
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
