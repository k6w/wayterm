use super::DbPool;

const MIGRATION_001: &str = include_str!("../../migrations/001_initial.sql");
const MIGRATION_002: &str = include_str!("../../migrations/002_terminal_buffers.sql");
const MIGRATION_003: &str = include_str!("../../migrations/003_custom_themes.sql");
const MIGRATION_004: &str = include_str!("../../migrations/004_port_forwards.sql");
const MIGRATION_005: &str = include_str!("../../migrations/005_database_connections.sql");
const MIGRATION_007: &str = include_str!("../../migrations/007_connection_extras.sql");
const MIGRATION_008: &str = include_str!("../../migrations/008_connection_identity_file.sql");
const MIGRATION_009: &str = include_str!("../../migrations/009_workspace_last_opened.sql");

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

    if current < 5 {
        conn.execute_batch(MIGRATION_005)
            .map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO schema_version (version) VALUES (5)", [])
            .map_err(|e| e.to_string())?;
    }

    if current < 6 {
        encrypt_existing_keys(&conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (6)", [])
            .map_err(|e| e.to_string())?;
    }

    if current < 7 {
        conn.execute_batch(MIGRATION_007)
            .map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO schema_version (version) VALUES (7)", [])
            .map_err(|e| e.to_string())?;
    }

    if current < 8 {
        conn.execute_batch(MIGRATION_008)
            .map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO schema_version (version) VALUES (8)", [])
            .map_err(|e| e.to_string())?;
    }

    if current < 9 {
        conn.execute_batch(MIGRATION_009)
            .map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO schema_version (version) VALUES (9)", [])
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn encrypt_existing_keys(conn: &rusqlite::Connection) -> Result<(), String> {
    let mut stmt = conn
        .prepare("SELECT id, private_key_encrypted FROM keys")
        .map_err(|e| e.to_string())?;

    let rows: Vec<(String, Vec<u8>)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    for (id, raw) in rows {
        if !crate::crypto::is_encrypted(&raw) {
            let encrypted = crate::crypto::encrypt(&raw)?;
            conn.execute(
                "UPDATE keys SET private_key_encrypted = ?1 WHERE id = ?2",
                rusqlite::params![encrypted, id],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}
