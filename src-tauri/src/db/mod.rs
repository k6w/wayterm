pub mod connections;
pub mod custom_themes;
pub mod history;
pub mod keys;
pub mod migrations;
pub mod port_forwards;
pub mod settings;
pub mod terminal_buffers;
pub mod workspaces;

use parking_lot::Mutex;
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Arc;

pub type DbPool = Arc<Mutex<Connection>>;

pub fn init(app_data_dir: &PathBuf) -> Result<DbPool, String> {
    std::fs::create_dir_all(app_data_dir).map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("nexterm.db");
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .map_err(|e| e.to_string())?;
    let pool = Arc::new(Mutex::new(conn));
    migrations::run(&pool)?;
    Ok(pool)
}
