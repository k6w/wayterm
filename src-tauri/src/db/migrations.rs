use super::DbPool;

const MIGRATION_001: &str = include_str!("../../migrations/001_initial.sql");
const MIGRATION_002: &str = include_str!("../../migrations/002_terminal_buffers.sql");
const MIGRATION_003: &str = include_str!("../../migrations/003_custom_themes.sql");
const MIGRATION_004: &str = include_str!("../../migrations/004_port_forwards.sql");

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

    if current < 2 {
        conn.execute_batch(MIGRATION_002)
            .map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO schema_version (version) VALUES (2)", [])
            .map_err(|e| e.to_string())?;
    }

    if current < 3 {
        conn.execute_batch(MIGRATION_003)
            .map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO schema_version (version) VALUES (3)", [])
            .map_err(|e| e.to_string())?;
    }

    if current < 4 {
        conn.execute_batch(MIGRATION_004)
            .map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO schema_version (version) VALUES (4)", [])
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
