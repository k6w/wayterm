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
pub async fn db_connect(_connection_id: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn db_disconnect(_connection_id: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn db_execute_query(
    _connection_id: String,
    query: String,
) -> Result<QueryResult, String> {
    if query.trim().is_empty() {
        return Err("Query cannot be empty".to_string());
    }

    Ok(QueryResult {
        columns: vec!["result".to_string()],
        rows: vec![{
            let mut map = HashMap::new();
            map.insert("result".to_string(), serde_json::Value::String("Query execution not yet implemented".to_string()));
            map
        }],
        row_count: 1,
        execution_time: 0,
        error: None,
    })
}

#[tauri::command]
pub async fn db_get_tables(_connection_id: String) -> Result<Vec<DatabaseTable>, String> {
    Ok(vec![])
}

#[tauri::command]
pub async fn db_get_table_schema(
    _connection_id: String,
    table: String,
) -> Result<DatabaseTable, String> {
    Ok(DatabaseTable {
        name: table,
        schema: None,
        row_count: 0,
        columns: vec![],
    })
}
