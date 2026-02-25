use serde::Serialize;
use std::path::PathBuf;

fn known_hosts_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    Ok(home.join(".ssh").join("known_hosts"))
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
