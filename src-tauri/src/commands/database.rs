use crate::db::DbPool;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::Mutex;
use tauri::State;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseConnection {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub db_type: String,
    pub host: String,
    pub port: i32,
    pub database: String,
    pub username: String,
    pub ssl: bool,
    pub connection_string: Option<String>,
    pub color: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseTable {
    pub name: String,
    pub schema: Option<String>,
    pub row_count: i64,
    pub columns: Vec<DatabaseColumn>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseColumn {
    pub name: String,
    #[serde(rename = "type")]
    pub col_type: String,
    pub nullable: bool,
    pub primary_key: bool,
    pub foreign_key: Option<String>,
    pub default_value: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<HashMap<String, serde_json::Value>>,
    pub row_count: i64,
    pub execution_time: i64,
    pub error: Option<String>,
}

pub struct DatabaseManager {
    connections: Arc<Mutex<HashMap<String, rusqlite::Connection>>>,
}

impl DatabaseManager {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[tauri::command]
pub async fn db_list_connections(pool: State<'_, DbPool>) -> Result<Vec<DatabaseConnection>, String> {
    let conn = pool.lock();
    let mut stmt = conn
        .prepare("SELECT id, name, type, host, port, database, username, ssl, connection_string, color FROM database_connections ORDER BY name")
        .map_err(|e| e.to_string())?;

    let connections = stmt
        .query_map([], |row| {
            Ok(DatabaseConnection {
                id: row.get(0)?,
                name: row.get(1)?,
                db_type: row.get(2)?,
                host: row.get(3)?,
                port: row.get(4)?,
                database: row.get(5)?,
                username: row.get(6)?,
                ssl: row.get(7)?,
                connection_string: row.get(8)?,
                color: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(connections)
}

#[tauri::command]
pub async fn db_save_connection(
    connection: DatabaseConnection,
    pool: State<'_, DbPool>,
) -> Result<(), String> {
    let conn = pool.lock();
    conn.execute(
        "INSERT OR REPLACE INTO database_connections (id, name, type, host, port, database, username, ssl, connection_string, color, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, datetime('now'))",
        (
            &connection.id,
            &connection.name,
            &connection.db_type,
            &connection.host,
            connection.port,
            &connection.database,
            &connection.username,
            connection.ssl,
            &connection.connection_string,
            &connection.color,
        ),
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn db_delete_connection(id: String, pool: State<'_, DbPool>) -> Result<(), String> {
    let conn = pool.lock();
    conn.execute("DELETE FROM database_connections WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn db_connect(
    connection_id: String,
    pool: State<'_, DbPool>,
    db_manager: State<'_, DatabaseManager>,
) -> Result<(), String> {
    let db_conn = {
        let conn = pool.lock();
        conn.query_row(
            "SELECT connection_string, database FROM database_connections WHERE id = ?1",
            [&connection_id],
            |row| {
                let cs: Option<String> = row.get(0)?;
                let db: String = row.get(1)?;
                Ok((cs, db))
            },
        )
        .map_err(|e| e.to_string())?
    };

    let path = db_conn.0.unwrap_or(db_conn.1);
    let sqlite_conn = rusqlite::Connection::open(&path)
        .map_err(|e| format!("Failed to open database '{}': {}", path, e))?;

    let mut conns = db_manager.connections.lock();
    conns.insert(connection_id, sqlite_conn);
    Ok(())
}

#[tauri::command]
pub async fn db_disconnect(
    connection_id: String,
    db_manager: State<'_, DatabaseManager>,
) -> Result<(), String> {
    let mut conns = db_manager.connections.lock();
    conns.remove(&connection_id);
    Ok(())
}

#[tauri::command]
pub async fn db_execute_query(
    connection_id: String,
    query: String,
    db_manager: State<'_, DatabaseManager>,
) -> Result<QueryResult, String> {
    if query.trim().is_empty() {
        return Err("Query cannot be empty".to_string());
    }

    let conns = db_manager.connections.lock();
    let conn = conns.get(&connection_id)
        .ok_or_else(|| "Not connected. Please connect first.".to_string())?;

    let start = std::time::Instant::now();

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let col_count = stmt.column_count();
    let columns: Vec<String> = (0..col_count)
        .map(|i| stmt.column_name(i).unwrap_or("?").to_string())
        .collect();

    let mut rows: Vec<HashMap<String, serde_json::Value>> = Vec::new();
    let mut sql_rows = stmt.query([]).map_err(|e| e.to_string())?;

    while let Some(row) = sql_rows.next().map_err(|e| e.to_string())? {
        let mut map = HashMap::new();
        for (i, col) in columns.iter().enumerate() {
            let val: serde_json::Value = match row.get_ref(i) {
                Ok(rusqlite::types::ValueRef::Null) => serde_json::Value::Null,
                Ok(rusqlite::types::ValueRef::Integer(v)) => serde_json::json!(v),
                Ok(rusqlite::types::ValueRef::Real(f)) => serde_json::json!(f),
                Ok(rusqlite::types::ValueRef::Text(t)) => {
                    serde_json::Value::String(String::from_utf8_lossy(t).to_string())
                }
                Ok(rusqlite::types::ValueRef::Blob(b)) => {
                    serde_json::Value::String(format!("<blob {} bytes>", b.len()))
                }
                Err(_) => serde_json::Value::Null,
            };
            map.insert(col.clone(), val);
        }
        rows.push(map);
    }

    let elapsed = start.elapsed().as_millis() as i64;
    let row_count = rows.len() as i64;

    Ok(QueryResult {
        columns,
        rows,
        row_count,
        execution_time: elapsed,
        error: None,
    })
}

#[tauri::command]
pub async fn db_get_tables(
    connection_id: String,
    db_manager: State<'_, DatabaseManager>,
) -> Result<Vec<DatabaseTable>, String> {
    let conns = db_manager.connections.lock();
    let conn = conns.get(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;

    let mut stmt = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .map_err(|e| e.to_string())?;

    let tables: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for table_name in tables {
        let row_count: i64 = conn
            .query_row(&format!("SELECT COUNT(*) FROM \"{}\"", table_name), [], |r| r.get(0))
            .unwrap_or(0);

        result.push(DatabaseTable {
            name: table_name,
            schema: None,
            row_count,
            columns: vec![],
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn db_get_table_schema(
    connection_id: String,
    table: String,
    db_manager: State<'_, DatabaseManager>,
) -> Result<DatabaseTable, String> {
    let conns = db_manager.connections.lock();
    let conn = conns.get(&connection_id)
        .ok_or_else(|| "Not connected".to_string())?;

    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info(\"{}\")", table))
        .map_err(|e| e.to_string())?;

    let columns: Vec<DatabaseColumn> = stmt
        .query_map([], |row| {
            Ok(DatabaseColumn {
                name: row.get(1)?,
                col_type: row.get::<_, String>(2).unwrap_or_default(),
                nullable: !row.get::<_, bool>(3).unwrap_or(false),
                primary_key: row.get::<_, bool>(5).unwrap_or(false),
                foreign_key: None,
                default_value: row.get(4).ok(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let row_count: i64 = conn
        .query_row(&format!("SELECT COUNT(*) FROM \"{}\"", table), [], |r| r.get(0))
        .unwrap_or(0);

    Ok(DatabaseTable {
        name: table,
        schema: None,
        row_count,
        columns,
    })
}
