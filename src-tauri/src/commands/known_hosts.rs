use serde::Serialize;
use std::path::PathBuf;

fn known_hosts_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    Ok(home.join(".ssh").join("known_hosts"))
}

pub fn verify_host_key(
    host: &str,
    port: u16,
    server_key: &russh::keys::ssh_key::PublicKey,
) -> Result<bool, String> {
    let path = known_hosts_path()?;
    if !path.exists() {
        return Err(format!(
            "Host key verification failed: no known_hosts file found. \
             Connect to {}:{} with ssh first, or add the host key manually.",
            host, port
        ));
    }

    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let server_key_str = server_key.to_openssh()
        .map_err(|e| format!("Failed to encode server key: {e}"))?;
    let server_parts: Vec<&str> = server_key_str.splitn(3, ' ').collect();
    let (server_key_type, server_key_data) = if server_parts.len() >= 2 {
        (server_parts[0], server_parts[1])
    } else {
        return Err("Cannot parse server public key".to_string());
    };

    let host_pattern = if port == 22 {
        host.to_string()
    } else {
        format!("[{}]:{}", host, port)
    };

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let parts: Vec<&str> = line.splitn(4, ' ').collect();
        if parts.len() < 3 {
            continue;
        }
        let hostnames = parts[0];
        let key_type = parts[1];
        let key_data = parts[2];

        let host_matches = hostnames.split(',').any(|h| {
            let h = h.trim();
            h == host_pattern || h == host || (port == 22 && h == format!("[{}]:22", host))
        });

        if host_matches {
            if key_type == server_key_type && key_data == server_key_data {
                return Ok(true);
            }
            return Err(format!(
                "HOST KEY CHANGED for {}:{}! This could indicate a man-in-the-middle attack. \
                 Remove the old key from ~/.ssh/known_hosts and reconnect if you trust this server.",
                host, port
            ));
        }
    }

    Err(format!(
        "Host key verification failed: {}:{} is not in known_hosts. \
         Connect with ssh first to add the host key, or add it via the SSH settings panel.",
        host, port
    ))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnownHost {
    pub hostname: String,
    pub key_type: String,
    pub fingerprint_preview: String,
    pub line_number: usize,
}

#[tauri::command]
pub async fn ssh_known_hosts_list() -> Result<Vec<KnownHost>, String> {
    let path = known_hosts_path()?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut hosts = Vec::new();

    for (i, line) in content.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let parts: Vec<&str> = line.splitn(4, ' ').collect();
        if parts.len() >= 3 {
            let hostname = parts[0].to_string();
            let key_type = parts[1].to_string();
            let key_data = parts[2];
            let preview = if key_data.len() > 20 {
                format!("{}...", &key_data[..20])
            } else {
                key_data.to_string()
            };
            hosts.push(KnownHost {
                hostname,
                key_type,
                fingerprint_preview: preview,
                line_number: i + 1,
            });
        }
    }
    Ok(hosts)
}

#[tauri::command]
pub async fn ssh_known_hosts_remove(hostname: String) -> Result<(), String> {
    let path = known_hosts_path()?;
    if !path.exists() {
        return Ok(());
    }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let filtered: Vec<&str> = content
        .lines()
        .filter(|line| {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                return true;
            }
            let parts: Vec<&str> = trimmed.splitn(4, ' ').collect();
            if parts.is_empty() {
                return true;
            }
            !parts[0]
                .split(',')
                .any(|h| h.trim_matches(|c| c == '[' || c == ']') == hostname || h == hostname)
        })
        .collect();
    std::fs::write(&path, filtered.join("\n") + "\n").map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn ssh_known_hosts_clear() -> Result<(), String> {
    let path = known_hosts_path()?;
    if path.exists() {
        std::fs::write(&path, "").map_err(|e| e.to_string())?;
    }
    Ok(())
}
