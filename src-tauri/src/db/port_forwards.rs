use super::DbPool;
use rusqlite::Error;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortForward {
    pub id: String,
    pub connection_id: String,
    pub port_forward_type: String,
    pub local_port: i32,
    pub remote_host: String,
    pub remote_port: i32,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

pub fn list(pool: &DbPool, connection_id: &str) -> Result<Vec<PortForward>, String> {
    let conn = pool.lock();
    let mut stmt = conn
        .prepare(
            "SELECT id, connection_id, type, local_port, remote_host, remote_port, is_active, created_at, updated_at 
             FROM port_forwards WHERE connection_id = ?1",
        )
        .map_err(|e: Error| e.to_string())?;

    let forwards = stmt
        .query_map([connection_id], |row| {
            Ok(PortForward {
                id: row.get(0)?,
                connection_id: row.get(1)?,
                port_forward_type: row.get(2)?,
                local_port: row.get(3)?,
                remote_host: row.get(4)?,
                remote_port: row.get(5)?,
                is_active: row.get::<_, i32>(6)? != 0,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e: Error| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e: Error| e.to_string())?;

    Ok(forwards)
}

pub fn insert(pool: &DbPool, forward: &PortForward) -> Result<(), String> {
    let conn = pool.lock();
    conn.execute(
        "INSERT INTO port_forwards (id, connection_id, type, local_port, remote_host, remote_port, is_active) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        (
            &forward.id,
            &forward.connection_id,
            &forward.port_forward_type,
            &forward.local_port,
            &forward.remote_host,
            &forward.remote_port,
            if forward.is_active { 1 } else { 0 },
        ),
    )
    .map_err(|e: Error| e.to_string())?;
    Ok(())
}

pub fn update(pool: &DbPool, forward: &PortForward) -> Result<(), String> {
    let conn = pool.lock();
    conn.execute(
        "UPDATE port_forwards SET type = ?1, local_port = ?2, remote_host = ?3, remote_port = ?4, is_active = ?5, updated_at = datetime('now')
         WHERE id = ?6",
        (
            &forward.port_forward_type,
            &forward.local_port,
            &forward.remote_host,
            &forward.remote_port,
            if forward.is_active { 1 } else { 0 },
            &forward.id,
        ),
    )
    .map_err(|e: Error| e.to_string())?;
    Ok(())
}

pub fn delete(pool: &DbPool, id: &str) -> Result<(), String> {
    let conn = pool.lock();
    conn.execute("DELETE FROM port_forwards WHERE id = ?1", [id])
        .map_err(|e: Error| e.to_string())?;
    Ok(())
}

pub fn toggle_active(pool: &DbPool, id: &str, is_active: bool) -> Result<(), String> {
    let conn = pool.lock();
    conn.execute(
        "UPDATE port_forwards SET is_active = ?1, updated_at = datetime('now') WHERE id = ?2",
        (if is_active { 1 } else { 0 }, id),
    )
    .map_err(|e: Error| e.to_string())?;
    Ok(())
}

pub fn get(pool: &DbPool, id: &str) -> Result<Option<PortForward>, String> {
    let conn = pool.lock();
    let mut stmt = conn
        .prepare(
            "SELECT id, connection_id, type, local_port, remote_host, remote_port, is_active, created_at, updated_at
             FROM port_forwards WHERE id = ?1",
        )
        .map_err(|e: Error| e.to_string())?;

    let mut rows = stmt
        .query_map([id], |row| {
            Ok(PortForward {
                id: row.get(0)?,
                connection_id: row.get(1)?,
                port_forward_type: row.get(2)?,
                local_port: row.get(3)?,
                remote_host: row.get(4)?,
                remote_port: row.get(5)?,
                is_active: row.get::<_, i32>(6)? != 0,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e: Error| e.to_string())?;

    if let Some(result) = rows.next() {
        Ok(Some(result.map_err(|e: Error| e.to_string())?))
    } else {
        Ok(None)
    }
}

/// Check if a port forward with the same local port already exists for a connection
pub fn exists_by_local_port(pool: &DbPool, connection_id: &str, local_port: i32) -> Result<bool, String> {
    let conn = pool.lock();
    let count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM port_forwards WHERE connection_id = ?1 AND local_port = ?2",
            [connection_id, &local_port.to_string()],
            |row| row.get(0),
        )
        .map_err(|e: Error| e.to_string())?;
    Ok(count > 0)
}
