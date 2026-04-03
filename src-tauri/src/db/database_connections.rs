use crate::db::DbPool;
use rusqlite::params;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConnection {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub db_type: String,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
    pub ssl: bool,
    pub color: Option<String>,
}

pub fn list(pool: &DbPool) -> Result<Vec<DatabaseConnection>, String> {
    let conn = pool.lock();
    let mut stmt = conn
        .prepare("SELECT id, name, type, host, port, database, username, password, ssl, color FROM database_connections ORDER BY name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(DatabaseConnection {
                id: row.get(0)?,
                name: row.get(1)?,
                db_type: row.get(2)?,
                host: row.get(3)?,
                port: row.get(4)?,
                database: row.get(5)?,
                username: row.get(6)?,
                password: row.get(7)?,
                ssl: row.get(8)?,
                color: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn save(pool: &DbPool, conn_data: &DatabaseConnection) -> Result<(), String> {
    let conn = pool.lock();
    conn.execute(
        "INSERT OR REPLACE INTO database_connections (id, name, type, host, port, database, username, password, ssl, color) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            &conn_data.id,
            &conn_data.name,
            &conn_data.db_type,
            &conn_data.host,
            &conn_data.port,
            &conn_data.database,
            &conn_data.username,
            &conn_data.password,
            &conn_data.ssl,
            &conn_data.color,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete(pool: &DbPool, id: &str) -> Result<(), String> {
    let conn = pool.lock();
    conn.execute("DELETE FROM database_connections WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
