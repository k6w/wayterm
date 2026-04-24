use crate::db::{self, connections::ConnectionProfile, keys::SshKey, port_forwards::{PortForward, self}, DbPool};
use crate::port_forward::PortForwardManager;
use serde::Deserialize;
use std::path::PathBuf;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn ssh_list_connections(
    pool: State<'_, DbPool>,
) -> Result<Vec<ConnectionProfile>, String> {
    db::connections::list(&pool)
}

#[tauri::command]
pub async fn ssh_save_connection(
    profile: ConnectionProfile,
    pool: State<'_, DbPool>,
) -> Result<(), String> {
    let exists = db::connections::list(&pool)?
        .iter()
        .any(|c| c.id == profile.id);
    if exists {
        db::connections::update(&pool, &profile)
    } else {
        let mut p = profile;
        if p.id.is_empty() {
            p.id = Uuid::new_v4().to_string();
        }
        db::connections::insert(&pool, &p)
    }
}

#[tauri::command]
pub async fn ssh_delete_connection(
    id: String,
    pool: State<'_, DbPool>,
) -> Result<(), String> {
    db::connections::delete(&pool, &id)
}

#[tauri::command]
pub async fn ssh_list_keys(
    pool: State<'_, DbPool>,
) -> Result<Vec<SshKey>, String> {
    db::keys::list(&pool)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportKeyRequest {
    pub name: String,
    pub public_key: String,
    pub private_key_pem: String,
    pub algorithm: String,
}

#[tauri::command]
pub async fn ssh_import_key(
    request: ImportKeyRequest,
    pool: State<'_, DbPool>,
) -> Result<SshKey, String> {
    let id = Uuid::new_v4().to_string();
    let fingerprint = compute_fingerprint(&request.public_key);
    let key = SshKey {
        id: id.clone(),
        name: request.name,
        algorithm: request.algorithm,
        public_key: request.public_key,
        fingerprint,
        created_at: String::new(),
    };
    let private_bytes = request.private_key_pem.as_bytes();
    db::keys::insert(&pool, &key, private_bytes)?;

    let keys = db::keys::list(&pool)?;
    keys.into_iter()
        .find(|k| k.id == id)
        .ok_or_else(|| "Key not found after insert".to_string())
}

#[tauri::command]
pub async fn ssh_delete_key(
    id: String,
    pool: State<'_, DbPool>,
) -> Result<(), String> {
    db::keys::delete(&pool, &id)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateKeyRequest {
    pub id: String,
    pub name: String,
    pub public_key: String,
}

#[tauri::command]
pub async fn ssh_update_key(
    request: UpdateKeyRequest,
    pool: State<'_, DbPool>,
) -> Result<(), String> {
    db::keys::update(&pool, &request.id, &request.name, &request.public_key)
}

#[tauri::command]
pub async fn ssh_get_key_temp_path(
    key_id: String,
    pool: State<'_, DbPool>,
) -> Result<String, String> {
    use std::io::Write;

    let raw_bytes = db::keys::get_private_key(&pool, &key_id)?;

    let raw_str = String::from_utf8(raw_bytes)
        .map_err(|e| format!("Key is not valid UTF-8: {}", e))?;
    let normalized = raw_str.replace("\r\n", "\n").replace('\r', "\n");
    let pem = if normalized.ends_with('\n') {
        normalized
    } else {
        format!("{}\n", normalized)
    };

    let temp_dir = std::env::temp_dir();
    let path = temp_dir.join(format!("nexterm_key_{}", key_id));

    let mut file = std::fs::File::create(&path).map_err(|e| e.to_string())?;
    file.write_all(pem.as_bytes()).map_err(|e| e.to_string())?;
    drop(file);

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600))
            .map_err(|e| e.to_string())?;
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let path_str = path.to_string_lossy();
        let _ = std::process::Command::new("icacls")
            .args([&*path_str, "/inheritance:r", "/grant:r", &format!("{}:F", whoami())])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
    }

    Ok(path.to_string_lossy().to_string())
}

pub fn write_key_to_temp(pool: &DbPool, key_id: &str) -> Result<PathBuf, String> {
    use std::io::Write;

    let raw_bytes = db::keys::get_private_key(pool, key_id)?;
    let raw_str = String::from_utf8(raw_bytes)
        .map_err(|e| format!("Key is not valid UTF-8: {}", e))?;
    let normalized = raw_str.replace("\r\n", "\n").replace('\r', "\n");
    let pem = if normalized.ends_with('\n') { normalized } else { format!("{}\n", normalized) };

    let temp_dir = std::env::temp_dir();
    let path = temp_dir.join(format!("nexterm_key_{}", key_id));

    let mut file = std::fs::File::create(&path).map_err(|e| e.to_string())?;
    file.write_all(pem.as_bytes()).map_err(|e| e.to_string())?;
    drop(file);

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600))
            .map_err(|e| e.to_string())?;
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let path_str = path.to_string_lossy();
        let _ = std::process::Command::new("icacls")
            .args([&*path_str, "/inheritance:r", "/grant:r", &format!("{}:F", whoami())])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
    }

    Ok(path)
}

#[allow(dead_code)]
pub fn cleanup_temp_key(key_id: &str) {
    let temp_dir = std::env::temp_dir();
    let path = temp_dir.join(format!("nexterm_key_{}", key_id));
    let _ = std::fs::remove_file(path);
}

#[cfg(windows)]
fn whoami() -> String {
    let domain = std::env::var("USERDOMAIN").unwrap_or_default();
    let user = std::env::var("USERNAME").unwrap_or_default();
    if domain.is_empty() {
        user
    } else {
        format!("{}\\{}", domain, user)
    }
}

fn compute_fingerprint(public_key: &str) -> String {
    use sha2::{Sha256, Digest};
    use std::fmt::Write;

    let hash = Sha256::digest(public_key.as_bytes());
    let bytes = &hash[..16];

    let mut out = String::with_capacity(47);
    for (i, b) in bytes.iter().enumerate() {
        if i > 0 {
            out.push(':');
        }
        write!(out, "{:02x}", b).unwrap();
    }
    out
}



#[tauri::command]
pub async fn ssh_list_port_forwards(
    connection_id: String,
    pool: State<'_, DbPool>,
) -> Result<Vec<PortForward>, String> {
    db::port_forwards::list(&pool, &connection_id)
}

#[tauri::command]
pub async fn ssh_save_port_forward(
    forward: PortForward,
    pool: State<'_, DbPool>,
) -> Result<(), String> {
    let mut f = forward;
    if f.id.is_empty() {
        f.id = Uuid::new_v4().to_string();
    }
    
    let existing = db::port_forwards::list(&pool, &f.connection_id)?
        .iter()
        .any(|p| p.id == f.id);
    if existing {
        db::port_forwards::update(&pool, &f)
    } else {
        
        if db::port_forwards::exists_by_local_port(&pool, &f.connection_id, f.local_port)? {
            return Err("A port forward with this local port already exists".to_string());
        }
        db::port_forwards::insert(&pool, &f)
    }
}

#[tauri::command]
pub async fn ssh_delete_port_forward(
    id: String,
    pool: State<'_, DbPool>,
) -> Result<(), String> {
    db::port_forwards::delete(&pool, &id)
}

#[tauri::command]
pub async fn ssh_toggle_port_forward(
    id: String,
    is_active: bool,
    session_id: Option<String>,
    pool: State<'_, DbPool>,
    port_forward_manager: State<'_, PortForwardManager>,
) -> Result<(), String> {
    
    let forward = port_forwards::get(&pool, &id)?
        .ok_or_else(|| "Port forward not found".to_string())?;

    if is_active {
        
        let start_result = if let Some(ref sess_id) = session_id {
            port_forward_manager
                .start_port_forward(
                    id.clone(),
                    forward.local_port as u16,
                    forward.remote_host.clone(),
                    forward.remote_port as u16,
                    sess_id.clone(),
                )
                .await
        } else {
            Err("No active SSH session ID provided".to_string())
        };

        if start_result.is_err() {
            
            let connection = crate::db::connections::get(&pool, &forward.connection_id)?
                .ok_or_else(|| "Connection profile not found".to_string())?;

            let key_option = if connection.auth_method == "key" {
                if let Some(key_id) = connection.private_key_id.as_deref() {
                    Some(write_key_to_temp(&pool, key_id)?)
                } else {
                    None
                }
            } else {
                None
            };

            let mut ssh_args = vec!["-N".to_string()];
            let mapping = format!("{}:{}:{}", forward.local_port, forward.remote_host, forward.remote_port);
            ssh_args.push("-L".to_string());
            ssh_args.push(mapping);
            if connection.port != 22 {
                ssh_args.push("-p".to_string());
                ssh_args.push(connection.port.to_string());
            }
            ssh_args.push("-o".to_string());
            ssh_args.push("StrictHostKeyChecking=yes".to_string());

            if let Some(key_path) = key_option.as_ref() {
                ssh_args.push("-i".to_string());
                ssh_args.push(key_path.to_string_lossy().to_string());
            }

            ssh_args.push(format!("{}@{}", connection.username, connection.host));

            port_forward_manager.start_local_tunnel(id.clone(), "ssh", &ssh_args)?;
        }
    } else {
        let _ = port_forward_manager.stop_port_forward(&id);
        let _ = port_forward_manager.stop_local_tunnel(&id);
    }

    db::port_forwards::toggle_active(&pool, &id, is_active)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedSshHost {
    pub name: String,
    pub host: String,
    pub port: i32,
    pub username: String,
    pub identity_file: Option<String>,
    pub jump_host: Option<String>,
}

#[tauri::command]
pub async fn ssh_import_config() -> Result<Vec<ImportedSshHost>, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let config_path = home.join(".ssh").join("config");

    if !config_path.exists() {
        return Ok(vec![]);
    }

    let content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read SSH config: {}", e))?;

    let mut hosts = Vec::new();
    let mut current: Option<ImportedSshHost> = None;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        let (key, value) = if let Some(pos) = trimmed.find(|c: char| c.is_whitespace() || c == '=') {
            let k = trimmed[..pos].trim().to_lowercase();
            let v = trimmed[pos..].trim_start_matches(|c: char| c.is_whitespace() || c == '=').trim().to_string();
            (k, v)
        } else {
            continue;
        };

        match key.as_str() {
            "host" => {
                if let Some(prev) = current.take() {
                    if prev.host != "*" && !prev.host.contains('*') {
                        hosts.push(prev);
                    }
                }
                current = Some(ImportedSshHost {
                    name: value.clone(),
                    host: value.clone(),
                    port: 22,
                    username: std::env::var("USERNAME")
                        .or_else(|_| std::env::var("USER"))
                        .unwrap_or_else(|_| "user".to_string()),
                    identity_file: None,
                    jump_host: None,
                });
            }
            "hostname" => {
                if let Some(ref mut h) = current {
                    h.host = value;
                }
            }
            "port" => {
                if let Some(ref mut h) = current {
                    h.port = value.parse().unwrap_or(22);
                }
            }
            "user" => {
                if let Some(ref mut h) = current {
                    h.username = value;
                }
            }
            "identityfile" => {
                if let Some(ref mut h) = current {
                    let expanded = if value.starts_with('~') {
                        let home_str = home.to_string_lossy();
                        value.replacen('~', &home_str, 1)
                    } else {
                        value
                    };
                    h.identity_file = Some(expanded);
                }
            }
            "proxyjump" => {
                if let Some(ref mut h) = current {
                    h.jump_host = Some(value);
                }
            }
            _ => {}
        }
    }

    if let Some(prev) = current {
        if prev.host != "*" && !prev.host.contains('*') {
            hosts.push(prev);
        }
    }

    Ok(hosts)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fingerprint_format_is_colon_separated_hex() {
        let fp = compute_fingerprint("ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ");
        let parts: Vec<&str> = fp.split(':').collect();
        assert_eq!(parts.len(), 16, "fingerprint should have 16 colon-separated segments");
        for part in &parts {
            assert_eq!(part.len(), 2, "each segment should be 2 hex chars");
            assert!(part.chars().all(|c| c.is_ascii_hexdigit()), "each segment should be hex");
        }
    }

    #[test]
    fn fingerprint_is_deterministic() {
        let key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest";
        let fp1 = compute_fingerprint(key);
        let fp2 = compute_fingerprint(key);
        assert_eq!(fp1, fp2);
    }

    #[test]
    fn different_keys_produce_different_fingerprints() {
        let fp1 = compute_fingerprint("ssh-rsa key1");
        let fp2 = compute_fingerprint("ssh-rsa key2");
        assert_ne!(fp1, fp2);
    }
}

