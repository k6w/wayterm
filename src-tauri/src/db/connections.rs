use super::DbPool;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionProfile {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: i32,
    pub username: String,
    pub auth_method: String,
    pub private_key_id: Option<String>,
    pub jump_host_id: Option<String>,
    pub startup_commands: Option<String>,
    pub color_tag: Option<String>,
    pub folder_path: String,
    pub sort_order: i32,
    pub theme_override: Option<String>,
    pub agent_forwarding: bool,
    pub env_vars: String,
    /// Path of a private key file on disk (e.g. imported from ~/.ssh/config). Never the key itself.
    #[serde(default)]
    pub identity_file: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

pub fn list(pool: &DbPool) -> Result<Vec<ConnectionProfile>, String> {
    let conn = pool.lock();
    let mut stmt = conn
        .prepare(
            "SELECT id, name, host, port, username, auth_method, private_key_id, \
             jump_host_id, startup_commands, color_tag, folder_path, sort_order, \
             theme_override, agent_forwarding, env_vars, identity_file, \
             created_at, updated_at FROM connections ORDER BY folder_path, sort_order",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(ConnectionProfile {
                id: row.get(0)?,
                name: row.get(1)?,
                host: row.get(2)?,
                port: row.get(3)?,
                username: row.get(4)?,
                auth_method: row.get(5)?,
                private_key_id: row.get(6)?,
                jump_host_id: row.get(7)?,
                startup_commands: row.get(8)?,
                color_tag: row.get(9)?,
                folder_path: row.get(10)?,
                sort_order: row.get(11)?,
                theme_override: row.get(12)?,
                agent_forwarding: row.get(13)?,
                env_vars: row.get::<_, Option<String>>(14)?.unwrap_or_else(|| "{}".to_string()),
                identity_file: row.get(15)?,
                created_at: row.get(16)?,
                updated_at: row.get(17)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn insert(pool: &DbPool, profile: &ConnectionProfile) -> Result<(), String> {
    let conn = pool.lock();
    conn.execute(
        "INSERT INTO connections (id, name, host, port, username, auth_method, \
         private_key_id, jump_host_id, startup_commands, color_tag, folder_path, \
         sort_order, theme_override, agent_forwarding, env_vars, identity_file) \
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)",
        rusqlite::params![
            profile.id,
            profile.name,
            profile.host,
            profile.port,
            profile.username,
            profile.auth_method,
            profile.private_key_id,
            profile.jump_host_id,
            profile.startup_commands,
            profile.color_tag,
            profile.folder_path,
            profile.sort_order,
            profile.theme_override,
            profile.agent_forwarding as i32,
            profile.env_vars,
            profile.identity_file,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn update(pool: &DbPool, profile: &ConnectionProfile) -> Result<(), String> {
    let conn = pool.lock();
    conn.execute(
        "UPDATE connections SET name=?2, host=?3, port=?4, username=?5, \
         auth_method=?6, private_key_id=?7, jump_host_id=?8, startup_commands=?9, \
         color_tag=?10, folder_path=?11, sort_order=?12, \
         theme_override=?13, agent_forwarding=?14, env_vars=?15, identity_file=?16, \
         updated_at=datetime('now') WHERE id=?1",
        rusqlite::params![
            profile.id,
            profile.name,
            profile.host,
            profile.port,
            profile.username,
            profile.auth_method,
            profile.private_key_id,
            profile.jump_host_id,
            profile.startup_commands,
            profile.color_tag,
            profile.folder_path,
            profile.sort_order,
            profile.theme_override,
            profile.agent_forwarding as i32,
            profile.env_vars,
            profile.identity_file,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete(pool: &DbPool, id: &str) -> Result<(), String> {
    let conn = pool.lock();
    conn.execute("DELETE FROM connections WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get(pool: &DbPool, id: &str) -> Result<Option<ConnectionProfile>, String> {
    let conn = pool.lock();
    let mut stmt = conn
        .prepare(
            "SELECT id, name, host, port, username, auth_method, private_key_id, \
             jump_host_id, startup_commands, color_tag, folder_path, sort_order, \
             theme_override, agent_forwarding, env_vars, identity_file, \
             created_at, updated_at FROM connections WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map([id], |row| {
            Ok(ConnectionProfile {
                id: row.get(0)?,
                name: row.get(1)?,
                host: row.get(2)?,
                port: row.get(3)?,
                username: row.get(4)?,
                auth_method: row.get(5)?,
                private_key_id: row.get(6)?,
                jump_host_id: row.get(7)?,
                startup_commands: row.get(8)?,
                color_tag: row.get(9)?,
                folder_path: row.get(10)?,
                sort_order: row.get(11)?,
                theme_override: row.get(12)?,
                agent_forwarding: row.get(13)?,
                env_vars: row.get::<_, Option<String>>(14)?.unwrap_or_else(|| "{}".to_string()),
                identity_file: row.get(15)?,
                created_at: row.get(16)?,
                updated_at: row.get(17)?,
            })
        })
        .map_err(|e| e.to_string())?;

    if let Some(result) = rows.next() {
        Ok(Some(result.map_err(|e| e.to_string())?))
    } else {
        Ok(None)
    }
}
