use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

fn known_hosts_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    Ok(home.join(".ssh").join("known_hosts"))
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PendingHostKey {
    pub host: String,
    pub port: u16,
    pub key_type: String,
    pub key_data: String,
    pub fingerprint: String,
}

static PENDING_TOFU: Mutex<Option<HashMap<String, PendingHostKey>>> = Mutex::new(None);

fn tofu_key(host: &str, port: u16) -> String {
    format!("{}:{}", host, port)
}

fn store_pending_tofu(host: &str, port: u16, key_type: &str, key_data: &str, fingerprint: &str) {
    let mut guard = PENDING_TOFU.lock().unwrap_or_else(|e| e.into_inner());
    let map = guard.get_or_insert_with(HashMap::new);
    map.insert(
        tofu_key(host, port),
        PendingHostKey {
            host: host.to_string(),
            port,
            key_type: key_type.to_string(),
            key_data: key_data.to_string(),
            fingerprint: fingerprint.to_string(),
        },
    );
}

pub fn verify_host_key(
    host: &str,
    port: u16,
    server_key: &russh::keys::ssh_key::PublicKey,
) -> Result<bool, String> {
    let path = known_hosts_path()?;

    let server_key_str = server_key
        .to_openssh()
        .map_err(|e| format!("Failed to encode server key: {e}"))?;
    let server_parts: Vec<&str> = server_key_str.splitn(3, ' ').collect();
    let (server_key_type, server_key_data) = if server_parts.len() >= 2 {
        (server_parts[0], server_parts[1])
    } else {
        return Err("Cannot parse server public key".to_string());
    };

    // Compute SHA-256 fingerprint from the base64 key data
    let fingerprint = compute_fingerprint(server_key_data);

    if !path.exists() {
        store_pending_tofu(host, port, server_key_type, server_key_data, &fingerprint);
        return Err(format!("TOFU_REQUIRED:{}:{}", host, port));
    }

    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;

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

    store_pending_tofu(host, port, server_key_type, server_key_data, &fingerprint);
    Err(format!("TOFU_REQUIRED:{}:{}", host, port))
}

fn compute_fingerprint(key_data_b64: &str) -> String {
    use sha2::{Sha256, Digest};
    // Decode base64 to get the raw key bytes
    let decoded = decode_b64(key_data_b64);
    if decoded.is_empty() {
        // Fallback to truncated base64 preview
        return format!(
            "{}...{}",
            &key_data_b64[..16.min(key_data_b64.len())],
            &key_data_b64[key_data_b64.len().saturating_sub(8)..]
        );
    }
    let hash = Sha256::digest(&decoded);
    // Encode as base64 without padding (standard SSH fingerprint format)
    let b64 = encode_b64_nopad(&hash);
    format!("SHA256:{}", b64)
}

fn decode_b64(s: &str) -> Vec<u8> {
    // Simple base64 decode (standard alphabet, with or without padding)
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut lookup = [255u8; 256];
    for (i, &c) in TABLE.iter().enumerate() {
        lookup[c as usize] = i as u8;
    }
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len() * 3 / 4);
    let mut buf = 0u32;
    let mut bits = 0u32;
    for &b in bytes {
        if b == b'=' { break; }
        let v = lookup[b as usize];
        if v == 255 { continue; }
        buf = (buf << 6) | v as u32;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8);
        }
    }
    out
}

fn encode_b64_nopad(data: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((data.len() * 4).div_ceil(3));
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(TABLE[(n >> 18) as usize] as char);
        out.push(TABLE[((n >> 12) & 0x3f) as usize] as char);
        if chunk.len() > 1 { out.push(TABLE[((n >> 6) & 0x3f) as usize] as char); }
        if chunk.len() > 2 { out.push(TABLE[(n & 0x3f) as usize] as char); }
    }
    out
}

#[tauri::command]
pub async fn ssh_get_pending_host_key(host: String, port: u16) -> Option<PendingHostKey> {
    let guard = PENDING_TOFU.lock().unwrap_or_else(|e| e.into_inner());
    guard.as_ref()?.get(&tofu_key(&host, port)).cloned()
}

#[tauri::command]
pub async fn ssh_clear_pending_host_key(host: String, port: u16) -> Result<(), String> {
    let mut guard = PENDING_TOFU.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(map) = guard.as_mut() {
        map.remove(&tofu_key(&host, port));
    }
    Ok(())
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
pub async fn ssh_known_hosts_add(host: String, port: u16, key_type: String, key_data: String) -> Result<(), String> {
    let path = known_hosts_path()?;
    let dir = path.parent().ok_or("Cannot determine .ssh directory")?;
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;

    let entry = if port == 22 {
        format!("{} {} {}\n", host, key_type, key_data)
    } else {
        format!("[{}]:{} {} {}\n", host, port, key_type, key_data)
    };

    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
    file.write_all(entry.as_bytes()).map_err(|e| e.to_string())?;
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
