use crate::db::{self, DbPool};
use crate::known_hosts::{self as kh, HostKeyCheck, HostKeyMismatch};
use russh::keys::Algorithm;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::State;

fn known_hosts_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    Ok(home.join(".ssh").join("known_hosts"))
}

/// known_hosts content, or "" when the file does not exist yet.
fn read_known_hosts(path: &PathBuf) -> Result<String, String> {
    match std::fs::read_to_string(path) {
        Ok(content) => Ok(content),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(e.to_string()),
    }
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

/// What known_hosts says about the key a server presented during the handshake.
pub enum ServerKeyVerdict {
    Trusted,
    /// No saved key for this host yet (trust on first use).
    Unknown { key_type: String, key_b64: String, fingerprint: String },
    /// Changed or revoked key: the connect error to report (a changed key carries the mismatch payload).
    Rejected(String),
}

/// Checks a server key against ~/.ssh/known_hosts. Never writes anything.
pub fn classify_server_key(
    host: &str,
    port: u16,
    server_key: &russh::keys::ssh_key::PublicKey,
) -> Result<ServerKeyVerdict, String> {
    let path = known_hosts_path()?;
    let server_key_str = server_key
        .to_openssh()
        .map_err(|e| format!("Failed to encode server key: {e}"))?;
    let mut parts = server_key_str.split(' ');
    let (Some(key_type), Some(key_b64)) = (parts.next(), parts.next()) else {
        return Err("Cannot parse server public key".to_string());
    };
    let fingerprint = kh::fingerprint_sha256(key_b64)?;
    let content = read_known_hosts(&path)?;

    Ok(match kh::check_host_key(&content, host, port, key_type, key_b64) {
        HostKeyCheck::Trusted => ServerKeyVerdict::Trusted,
        HostKeyCheck::Unknown => ServerKeyVerdict::Unknown {
            key_type: key_type.to_string(),
            key_b64: key_b64.to_string(),
            fingerprint,
        },
        HostKeyCheck::Revoked => ServerKeyVerdict::Rejected(format!(
            "HOST KEY REVOKED for {host}:{port}! The key this server presented is marked @revoked in {}. \
             The connection was not made.",
            path.display()
        )),
        HostKeyCheck::Changed(old_keys) => ServerKeyVerdict::Rejected(
            HostKeyMismatch {
                host: host.to_string(),
                port,
                known_hosts_path: path.display().to_string(),
                old_keys,
                new_key_type: key_type.to_string(),
                new_fingerprint: fingerprint,
                new_key_b64: key_b64.to_string(),
            }
            .to_error(),
        ),
    })
}

/// Host-key check for a connection that will authenticate: Ok(true) only for a
/// saved, matching key. An unknown key is parked for the trust prompt.
pub fn verify_host_key(
    host: &str,
    port: u16,
    server_key: &russh::keys::ssh_key::PublicKey,
) -> Result<bool, String> {
    match classify_server_key(host, port, server_key)? {
        ServerKeyVerdict::Trusted => Ok(true),
        ServerKeyVerdict::Unknown { key_type, key_b64, fingerprint } => {
            store_pending_tofu(host, port, &key_type, &key_b64, &fingerprint);
            Err(format!("TOFU_REQUIRED:{}:{}", host, port))
        }
        ServerKeyVerdict::Rejected(message) => Err(message),
    }
}

/// The OpenSSH key type an algorithm produces ("rsa-sha2-512" keys are "ssh-rsa").
fn algorithm_key_type(algorithm: &Algorithm) -> String {
    match algorithm {
        Algorithm::Rsa { .. } => "ssh-rsa".to_string(),
        other => other.as_str().to_string(),
    }
}

/// `defaults` with the algorithms for already-saved key types first, in the
/// order those types were saved. Like OpenSSH, this asks the server for the key
/// we already know, so a server that also has other key types is not reported as changed.
fn order_key_algorithms(defaults: &[Algorithm], saved_types: &[String]) -> Vec<Algorithm> {
    let mut ordered: Vec<Algorithm> = Vec::with_capacity(defaults.len());
    for saved in saved_types {
        ordered.extend(defaults.iter().filter(|a| &algorithm_key_type(a) == saved).cloned());
    }
    let rest: Vec<Algorithm> = defaults.iter().filter(|a| !ordered.contains(a)).cloned().collect();
    ordered.extend(rest);
    ordered
}

/// russh client config whose host-key algorithm order prefers the key types saved for this host.
pub fn client_config_for(host: &str, port: u16) -> russh::client::Config {
    let mut config = russh::client::Config::default();
    let saved = known_hosts_path()
        .and_then(|p| read_known_hosts(&p))
        .map(|content| kh::saved_key_types(&content, host, port))
        .unwrap_or_default();
    if !saved.is_empty() {
        let ordered = order_key_algorithms(&config.preferred.key, &saved);
        config.preferred.key = std::borrow::Cow::Owned(ordered);
    }
    config
}

/// Where a russh handler leaves a host-key rejection so the caller can return it
/// verbatim (russh only reports a generic handshake error).
pub type HostKeyErrorSlot = Arc<Mutex<Option<String>>>;

pub fn take_host_key_error(slot: &HostKeyErrorSlot) -> Option<String> {
    slot.lock().unwrap_or_else(|e| e.into_inner()).take()
}

pub fn put_host_key_error(slot: &HostKeyErrorSlot, message: String) {
    *slot.lock().unwrap_or_else(|e| e.into_inner()) = Some(message);
}

/// Handler for a handshake-only probe: it records the verdict and never authenticates.
struct ProbeHandler {
    host: String,
    port: u16,
    verdict: Arc<Mutex<Option<Result<&'static str, String>>>>,
}

impl russh::client::Handler for ProbeHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &russh::keys::ssh_key::PublicKey,
    ) -> Result<bool, Self::Error> {
        let (verdict, proceed) = match classify_server_key(&self.host, self.port, server_public_key) {
            Ok(ServerKeyVerdict::Trusted) => (Ok("trusted"), true),
            Ok(ServerKeyVerdict::Unknown { .. }) => (Ok("unknown"), false),
            Ok(ServerKeyVerdict::Rejected(message)) | Err(message) => (Err(message), false),
        };
        *self.verdict.lock().unwrap_or_else(|e| e.into_inner()) = Some(verdict);
        Ok(proceed)
    }
}

/// Checks a server's host key without logging in (used before the terminal runs
/// `ssh`). Ok("trusted") or Ok("unknown"); a changed key fails with the
/// "HOST KEY CHANGED" error and its mismatch payload. Network errors fail too.
#[tauri::command]
pub async fn ssh_check_host_key(host: String, port: u16) -> Result<String, String> {
    let verdict = Arc::new(Mutex::new(None));
    let handler = ProbeHandler { host: host.clone(), port, verdict: Arc::clone(&verdict) };
    let mut config = client_config_for(&host, port);
    config.inactivity_timeout = Some(std::time::Duration::from_secs(10));
    let connect = russh::client::connect(Arc::new(config), (host.as_str(), port), handler);
    let result = tokio::time::timeout(std::time::Duration::from_secs(10), connect).await;
    let recorded = verdict.lock().unwrap_or_else(|e| e.into_inner()).take();
    if let Ok(Ok(handle)) = &result {
        let _ = handle
            .disconnect(russh::Disconnect::ByApplication, "host key check", "en")
            .await;
    }
    match (recorded, result) {
        (Some(verdict), _) => verdict.map(str::to_string),
        (None, Err(_)) => Err(format!("Host key check for {host}:{port} timed out")),
        (None, Ok(Err(e))) => Err(format!("SSH connect failed: {e}")),
        (None, Ok(Ok(_))) => Err("The server did not present a host key".to_string()),
    }
}

/// The audit-log line for a replaced key.
fn audit_entry(host: &str, port: u16, key_type: &str, replaced: &kh::Replaced, at: &str) -> String {
    let label = if port == 22 { host.to_string() } else { format!("[{host}]:{port}") };
    let lines: Vec<String> = replaced.replaced_lines.iter().map(|n| n.to_string()).collect();
    format!(
        "known_hosts: replaced host key for {label} ({key_type}) {} -> {} (line {}) at {at}",
        replaced.old_fingerprint,
        replaced.new_fingerprint,
        lines.join(", ")
    )
}

/// Replaces this host's saved key with the server's new key, but only if the
/// saved key still has `expected_old_fingerprint`. See `known_hosts::replace_file`.
#[tauri::command]
pub async fn ssh_known_hosts_replace(
    host: String,
    port: u16,
    expected_old_fingerprint: String,
    new_key_type: String,
    new_key_b64: String,
    pool: State<'_, DbPool>,
) -> Result<(), String> {
    let path = known_hosts_path()?;
    let replaced = kh::replace_file(&path, &host, port, &expected_old_fingerprint, &new_key_type, &new_key_b64)?;
    let entry = audit_entry(&host, port, &new_key_type, &replaced, &kh::utc_timestamp());
    // The file is already replaced; a failed audit insert must not report the replacement as failed.
    if let Err(e) = db::history::add(&pool, "known_hosts", &entry, None, Some(&path.display().to_string())) {
        eprintln!("[known_hosts] audit log write failed: {e}");
    }
    Ok(())
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

#[cfg(test)]
mod tests {
    use super::*;
    use russh::keys::{EcdsaCurve, HashAlg};

    #[test]
    fn saved_key_types_move_to_the_front_in_order() {
        let defaults = vec![
            Algorithm::Ed25519,
            Algorithm::Ecdsa { curve: EcdsaCurve::NistP256 },
            Algorithm::Rsa { hash: Some(HashAlg::Sha512) },
            Algorithm::Rsa { hash: Some(HashAlg::Sha256) },
            Algorithm::Rsa { hash: None },
        ];
        let ordered = order_key_algorithms(&defaults, &["ssh-rsa".to_string()]);
        assert_eq!(ordered.len(), defaults.len());
        assert_eq!(&ordered[..3], &defaults[2..]);
        assert_eq!(ordered[3], Algorithm::Ed25519);

        let ordered = order_key_algorithms(&defaults, &["ecdsa-sha2-nistp256".to_string(), "ssh-ed25519".to_string()]);
        assert_eq!(ordered[0], defaults[1]);
        assert_eq!(ordered[1], Algorithm::Ed25519);

        assert_eq!(order_key_algorithms(&defaults, &[]), defaults);
    }

    #[test]
    fn audit_entry_names_host_and_both_fingerprints() {
        let replaced = kh::Replaced {
            content: String::new(),
            replaced_lines: vec![4],
            old_fingerprint: "SHA256:old".into(),
            new_fingerprint: "SHA256:new".into(),
        };
        assert_eq!(
            audit_entry("example.com", 2222, "ssh-ed25519", &replaced, "2026-10-09T12:00:00Z"),
            "known_hosts: replaced host key for [example.com]:2222 (ssh-ed25519) SHA256:old -> SHA256:new (line 4) at 2026-10-09T12:00:00Z"
        );
        assert!(audit_entry("example.com", 22, "ssh-ed25519", &replaced, "t").contains("for example.com ("));
    }
}
