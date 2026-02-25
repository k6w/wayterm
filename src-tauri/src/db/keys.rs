use super::DbPool;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SshKey {
    pub id: String,
    pub name: String,
    pub algorithm: String,
    pub public_key: String,
    pub fingerprint: String,
    pub created_at: String,
}

pub fn list(pool: &DbPool) -> Result<Vec<SshKey>, String> {
    let conn = pool.lock();
    let mut stmt = conn
        .prepare(
            "SELECT id, name, algorithm, public_key, fingerprint, created_at \
             FROM keys ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(SshKey {
                id: row.get(0)?,
                name: row.get(1)?,
                algorithm: row.get(2)?,
                public_key: row.get(3)?,
                fingerprint: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn insert(pool: &DbPool, key: &SshKey, private_key_encrypted: &[u8]) -> Result<(), String> {
    let conn = pool.lock();
    conn.execute(
        "INSERT INTO keys (id, name, algorithm, public_key, private_key_encrypted, fingerprint) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            key.id,
            key.name,
            key.algorithm,
            key.public_key,
            private_key_encrypted,
            key.fingerprint,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_private_key(pool: &DbPool, id: &str) -> Result<Vec<u8>, String> {
    let conn = pool.lock();
    conn.query_row(
        "SELECT private_key_encrypted FROM keys WHERE id = ?1",
        [id],
        |row| row.get(0),
    )
    .map_err(|e| e.to_string())
}

pub fn delete(pool: &DbPool, id: &str) -> Result<(), String> {
    let conn = pool.lock();
    conn.execute("DELETE FROM keys WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn update(pool: &DbPool, id: &str, name: &str, public_key: &str) -> Result<(), String> {
    let conn = pool.lock();
    conn.execute(
        "UPDATE keys SET name = ?2, public_key = ?3 WHERE id = ?1",
        rusqlite::params![id, name, public_key],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
