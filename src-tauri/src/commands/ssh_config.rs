use crate::commands::ssh::compute_fingerprint;
use crate::db::{self, keys::SshKey, DbPool};
use crate::ssh_config::import::{classify_key, is_imported, plan_import, Skipped};
use crate::ssh_config::{parse_file, ConfigHost, Env};
use serde::Serialize;
use std::collections::HashMap;
use tauri::State;
use uuid::Uuid;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshConfigHost {
    #[serde(flatten)]
    host: ConfigHost,
    already_imported: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshConfigHosts {
    /// False when there is no `~/.ssh/config` at all.
    found: bool,
    path: String,
    hosts: Vec<SshConfigHost>,
    warnings: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedHost {
    alias: String,
    connection_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshConfigImportResult {
    imported: Vec<ImportedHost>,
    skipped: Vec<Skipped>,
    warnings: Vec<String>,
}

fn load() -> Result<(Env, std::path::PathBuf, crate::ssh_config::ParseOutput), String> {
    let env = Env::current().ok_or("Could not find the home directory")?;
    let path = env.ssh_dir.join("config");
    let out = parse_file(&path, &env);
    Ok((env, path, out))
}

/// The OS user name: the login a quick connect uses when none is typed.
#[tauri::command]
pub async fn ssh_local_user() -> Result<String, String> {
    Env::current().map(|e| e.user).ok_or_else(|| "Could not find the home directory".to_string())
}

#[tauri::command]
pub async fn ssh_config_hosts(pool: State<'_, DbPool>) -> Result<SshConfigHosts, String> {
    let (_, path, out) = load()?;
    let existing = db::connections::list(&pool)?;
    let hosts = out
        .hosts
        .into_iter()
        .map(|host| SshConfigHost { already_imported: is_imported(&host, &existing), host })
        .collect();
    Ok(SshConfigHosts {
        found: path.is_file(),
        path: path.to_string_lossy().to_string(),
        hosts,
        warnings: out.warnings,
    })
}

/// Stores an unencrypted private key file in the key store; `None` when it
/// cannot be read or is passphrase-protected.
fn import_key_file(pool: &DbPool, path: &str) -> Option<String> {
    let pem = std::fs::read_to_string(path).ok()?;
    let public_key = std::fs::read_to_string(format!("{path}.pub")).unwrap_or_default();
    let algorithm = classify_key(&pem, &public_key)?;
    let name = std::path::Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "ssh key".to_string());
    let key = SshKey {
        id: Uuid::new_v4().to_string(),
        name,
        algorithm: algorithm.to_string(),
        fingerprint: compute_fingerprint(public_key.trim()),
        public_key: public_key.trim().to_string(),
        created_at: String::new(),
    };
    db::keys::insert(pool, &key, pem.as_bytes()).ok()?;
    Some(key.id)
}

#[tauri::command]
pub async fn ssh_config_import(
    selected: Vec<String>,
    pool: State<'_, DbPool>,
) -> Result<SshConfigImportResult, String> {
    let (_, _, out) = load()?;
    let existing = db::connections::list(&pool)?;

    let mut key_ids: HashMap<String, Option<String>> = HashMap::new();
    let plan = plan_import(
        &out.hosts,
        &selected,
        &existing,
        &mut |path| {
            key_ids
                .entry(path.to_string())
                .or_insert_with(|| import_key_file(&pool, path))
                .clone()
        },
        &mut || Uuid::new_v4().to_string(),
    );

    let mut warnings = plan.warnings;
    let mut skipped = plan.skipped;
    let mut imported = Vec::new();
    for planned in plan.connections {
        let alias = planned.profile.name.clone();
        if let Err(e) = db::connections::insert(&pool, &planned.profile) {
            skipped.push(Skipped { alias, reason: e });
            continue;
        }
        for forward in &planned.forwards {
            if let Err(e) = db::port_forwards::insert(&pool, forward) {
                warnings.push(format!("{alias}: port forward {} was not saved: {e}", forward.local_port));
            }
        }
        imported.push(ImportedHost { alias, connection_id: planned.profile.id });
    }
    Ok(SshConfigImportResult { imported, skipped, warnings })
}
