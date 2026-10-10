use crate::db::{self, DbPool};
use crate::ssh_config::import::{is_imported, plan_import, Skipped};
use crate::ssh_config::{parse_file, ConfigHost, Env};
use serde::Serialize;
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

#[tauri::command]
pub async fn ssh_config_import(
    selected: Vec<String>,
    pool: State<'_, DbPool>,
) -> Result<SshConfigImportResult, String> {
    let (_, _, out) = load()?;
    import_hosts(&pool, &out.hosts, &selected)
}

/// Saves the selected hosts as connections. Key files are only referenced by
/// path: nothing is read from them and nothing is added to the key store.
fn import_hosts(pool: &DbPool, hosts: &[ConfigHost], selected: &[String]) -> Result<SshConfigImportResult, String> {
    let existing = db::connections::list(pool)?;
    let plan = plan_import(hosts, selected, &existing, &mut || Uuid::new_v4().to_string());

    let mut warnings = plan.warnings;
    let mut skipped = plan.skipped;
    let mut imported = Vec::new();
    for planned in plan.connections {
        let alias = planned.profile.name.clone();
        if let Some(file) = &planned.profile.identity_file {
            if !std::path::Path::new(file).is_file() {
                warnings.push(format!("{alias}: key file {file} does not exist"));
            }
        }
        if let Err(e) = db::connections::insert(pool, &planned.profile) {
            skipped.push(Skipped { alias, reason: e });
            continue;
        }
        for forward in &planned.forwards {
            if let Err(e) = db::port_forwards::insert(pool, forward) {
                warnings.push(format!("{alias}: port forward {} was not saved: {e}", forward.local_port));
            }
        }
        imported.push(ImportedHost { alias, connection_id: planned.profile.id });
    }
    Ok(SshConfigImportResult { imported, skipped, warnings })
}

#[cfg(test)]
mod tests {
    use super::*;
    use parking_lot::Mutex;
    use std::sync::Arc;

    fn pool() -> DbPool {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        let pool = Arc::new(Mutex::new(conn));
        db::migrations::run(&pool).unwrap();
        pool
    }

    fn host(alias: &str, key: &str) -> ConfigHost {
        ConfigHost {
            alias: alias.into(),
            hostname: format!("{alias}.example.com"),
            user: "me".into(),
            port: 22,
            identity_files: vec![key.into()],
            proxy_jump: None,
            forward_agent: false,
            local_forwards: vec![],
            remote_forwards: vec![],
            dynamic_forwards: vec![],
        }
    }

    #[test]
    fn import_stores_the_key_path_and_never_touches_the_key_store() {
        let dir = std::env::temp_dir().join(format!("wayterm_import_{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let key = dir.join("id_ed25519");
        std::fs::write(&key, "-----BEGIN OPENSSH PRIVATE KEY-----\nsecret\n-----END OPENSSH PRIVATE KEY-----\n").unwrap();
        let key_path = key.to_string_lossy().to_string();

        let pool = pool();
        let result = import_hosts(&pool, &[host("web", &key_path)], &["web".to_string()]).unwrap();
        assert_eq!(result.imported.len(), 1);
        assert!(result.warnings.is_empty(), "{:?}", result.warnings);

        let saved = db::connections::list(&pool).unwrap();
        assert_eq!(saved[0].identity_file.as_deref(), Some(key_path.as_str()));
        assert_eq!(saved[0].auth_method, "key");
        assert_eq!(saved[0].private_key_id, None);
        assert!(db::keys::list(&pool).unwrap().is_empty(), "no key may be copied into the key store");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_missing_key_file_is_a_warning() {
        let pool = pool();
        let result = import_hosts(&pool, &[host("web", "/definitely/not/here")], &["web".to_string()]).unwrap();
        assert_eq!(result.imported.len(), 1);
        assert!(result.warnings.iter().any(|w| w.contains("does not exist")), "{:?}", result.warnings);
    }
}
