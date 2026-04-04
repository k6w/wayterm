use crate::db::{self, DbPool};
use crate::sftp::session::SftpSessionManager;
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use uuid::Uuid;


const CHUNK_SIZE: usize = 64 * 1024;




#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SftpEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub modified: Option<String>,
    pub permissions: u32,
    pub is_dir: bool,
    pub is_symlink: bool,
}


#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TransferProgress {
    pub transfer_id: String,
    pub bytes_transferred: u64,
    pub total_bytes: u64,
    pub status: String,
    pub error: Option<String>,
}





#[tauri::command]
pub async fn sftp_connect(
    connection_id: String,
    pool: State<'_, DbPool>,
    sftp_manager: State<'_, SftpSessionManager>,
) -> Result<String, String> {
    
    let profiles = db::connections::list(&pool)?;
    let profile = profiles
        .iter()
        .find(|p| p.id == connection_id)
        .ok_or_else(|| format!("Connection {connection_id} not found"))?
        .clone();

    
    let key_pem: Option<String> = if profile.auth_method == "key" {
        let key_id = profile
            .private_key_id
            .as_deref()
            .ok_or("Key auth selected but no private_key_id set")?;
        let raw = db::keys::get_private_key(&pool, key_id)?;
        let pem = String::from_utf8(raw)
            .map_err(|e| format!("Private key is not valid UTF-8: {e}"))?;
        
        let pem = pem.replace("\r\n", "\n").replace('\r', "\n");
        Some(pem)
    } else {
        None
    };

    let session_id = Uuid::new_v4().to_string();

    sftp_manager
        .connect(
            session_id.clone(),
            &profile.host,
            profile.port as u16,
            &profile.username,
            &profile.auth_method,
            None, 
            key_pem.as_deref(),
            profile.name.clone(),
        )
        .await?;

    Ok(session_id)
}


#[tauri::command]
pub async fn sftp_disconnect(
    session_id: String,
    sftp_manager: State<'_, SftpSessionManager>,
) -> Result<(), String> {
    sftp_manager.disconnect(&session_id).await
}



#[tauri::command]
pub async fn sftp_list_dir(
    session_id: String,
    path: String,
    sftp_manager: State<'_, SftpSessionManager>,
) -> Result<Vec<SftpEntry>, String> {
    let sessions = sftp_manager.sessions();
    let sessions = sessions.lock().await;
    let entry = sessions
        .get(&session_id)
        .ok_or_else(|| format!("SFTP session {session_id} not found"))?;

    let entries = entry
        .sftp
        .read_dir(path.as_str())
        .await
        .map_err(|e| format!("readdir failed: {e}"))?;

    let mut result: Vec<SftpEntry> = Vec::new();

    for dir_entry in entries {
        let name = dir_entry.file_name();

        
        if name == "." || name == ".." {
            continue;
        }

        let meta = dir_entry.metadata();
        let file_type = dir_entry.file_type();

        let is_dir = file_type.is_dir();
        let is_symlink = file_type.is_symlink();

        let entry_path = if path.ends_with('/') {
            format!("{path}{name}")
        } else {
            format!("{path}/{name}")
        };

        let modified = meta.modified().ok().map(|t| {
            let duration = t
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default();
            duration.as_secs().to_string()
        });

        result.push(SftpEntry {
            name,
            path: entry_path,
            size: meta.len(),
            modified,
            permissions: meta.permissions.unwrap_or(0),
            is_dir,
            is_symlink,
        });
    }

    
    result.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(result)
}


#[tauri::command]
pub async fn sftp_mkdir(
    session_id: String,
    path: String,
    sftp_manager: State<'_, SftpSessionManager>,
) -> Result<(), String> {
    let sessions = sftp_manager.sessions();
    let sessions = sessions.lock().await;
    let entry = sessions
        .get(&session_id)
        .ok_or_else(|| format!("SFTP session {session_id} not found"))?;

    entry
        .sftp
        .create_dir(path.as_str())
        .await
        .map_err(|e| format!("mkdir failed: {e}"))
}


#[tauri::command]
pub async fn sftp_remove(
    session_id: String,
    path: String,
    is_dir: bool,
    sftp_manager: State<'_, SftpSessionManager>,
) -> Result<(), String> {
    let sessions = sftp_manager.sessions();
    let sessions = sessions.lock().await;
    let entry = sessions
        .get(&session_id)
        .ok_or_else(|| format!("SFTP session {session_id} not found"))?;

    if is_dir {
        entry
            .sftp
            .remove_dir(path.as_str())
            .await
            .map_err(|e| format!("rmdir failed: {e}"))
    } else {
        entry
            .sftp
            .remove_file(path.as_str())
            .await
            .map_err(|e| format!("remove failed: {e}"))
    }
}


#[tauri::command]
pub async fn sftp_rename(
    session_id: String,
    old_path: String,
    new_path: String,
    sftp_manager: State<'_, SftpSessionManager>,
) -> Result<(), String> {
    let sessions = sftp_manager.sessions();
    let sessions = sessions.lock().await;
    let entry = sessions
        .get(&session_id)
        .ok_or_else(|| format!("SFTP session {session_id} not found"))?;

    entry
        .sftp
        .rename(old_path.as_str(), new_path.as_str())
        .await
        .map_err(|e| format!("rename failed: {e}"))
}



#[tauri::command]
pub async fn sftp_download(
    session_id: String,
    remote_path: String,
    local_path: String,
    transfer_id: String,
    sftp_manager: State<'_, SftpSessionManager>,
    app: AppHandle,
) -> Result<(), String> {
    let sessions = sftp_manager.sessions();

    
    let (total_bytes, data) = {
        let sessions = sessions.lock().await;
        let entry = sessions
            .get(&session_id)
            .ok_or_else(|| format!("SFTP session {session_id} not found"))?;

        let meta = entry
            .sftp
            .metadata(remote_path.as_str())
            .await
            .map_err(|e| format!("stat failed: {e}"))?;
        let total = meta.len();

        
        let _ = app.emit(
            "sftp:transfer:progress",
            TransferProgress {
                transfer_id: transfer_id.clone(),
                bytes_transferred: 0,
                total_bytes: total,
                status: "in_progress".into(),
                error: None,
            },
        );

        
        let mut file = entry
            .sftp
            .open(remote_path.as_str())
            .await
            .map_err(|e| format!("open failed: {e}"))?;

        let mut data = Vec::with_capacity(total as usize);
        let mut buf = vec![0u8; CHUNK_SIZE];

        loop {
            let n = file
                .read(&mut buf)
                .await
                .map_err(|e| format!("read failed: {e}"))?;
            if n == 0 {
                break;
            }
            data.extend_from_slice(&buf[..n]);

            let _ = app.emit(
                "sftp:transfer:progress",
                TransferProgress {
                    transfer_id: transfer_id.clone(),
                    bytes_transferred: data.len() as u64,
                    total_bytes: total,
                    status: "in_progress".into(),
                    error: None,
                },
            );
        }

        (total, data)
    };

    
    tokio::fs::write(&local_path, &data)
        .await
        .map_err(|e| format!("Failed to write local file: {e}"))?;

    
    let _ = app.emit(
        "sftp:transfer:progress",
        TransferProgress {
            transfer_id,
            bytes_transferred: total_bytes,
            total_bytes,
            status: "completed".into(),
            error: None,
        },
    );

    Ok(())
}



#[tauri::command]
pub async fn sftp_upload(
    session_id: String,
    local_path: String,
    remote_path: String,
    transfer_id: String,
    sftp_manager: State<'_, SftpSessionManager>,
    app: AppHandle,
) -> Result<(), String> {
    
    let data = tokio::fs::read(&local_path)
        .await
        .map_err(|e| format!("Failed to read local file: {e}"))?;

    let total_bytes = data.len() as u64;

    
    let _ = app.emit(
        "sftp:transfer:progress",
        TransferProgress {
            transfer_id: transfer_id.clone(),
            bytes_transferred: 0,
            total_bytes,
            status: "in_progress".into(),
            error: None,
        },
    );

    
    {
        let sessions = sftp_manager.sessions();
        let sessions = sessions.lock().await;
        let entry = sessions
            .get(&session_id)
            .ok_or_else(|| format!("SFTP session {session_id} not found"))?;

        let mut file = entry
            .sftp
            .create(remote_path.as_str())
            .await
            .map_err(|e| format!("create failed: {e}"))?;

        let mut bytes_written: u64 = 0;
        for chunk in data.chunks(CHUNK_SIZE) {
            file.write_all(chunk)
                .await
                .map_err(|e| format!("write failed: {e}"))?;
            bytes_written += chunk.len() as u64;

            let _ = app.emit(
                "sftp:transfer:progress",
                TransferProgress {
                    transfer_id: transfer_id.clone(),
                    bytes_transferred: bytes_written,
                    total_bytes,
                    status: "in_progress".into(),
                    error: None,
                },
            );
        }

        file.shutdown()
            .await
            .map_err(|e| format!("close failed: {e}"))?;
    }

    
    let _ = app.emit(
        "sftp:transfer:progress",
        TransferProgress {
            transfer_id,
            bytes_transferred: total_bytes,
            total_bytes,
            status: "completed".into(),
            error: None,
        },
    );

    Ok(())
}


#[tauri::command]
pub async fn sftp_chmod(
    session_id: String,
    path: String,
    mode: u32,
    sftp_manager: State<'_, SftpSessionManager>,
) -> Result<(), String> {
    use russh_sftp::protocol::FileAttributes;

    let sessions = sftp_manager.sessions();
    let sessions = sessions.lock().await;
    let entry = sessions
        .get(&session_id)
        .ok_or_else(|| format!("SFTP session {session_id} not found"))?;

    let attrs = FileAttributes {
        permissions: Some(mode),
        ..Default::default()
    };

    entry
        .sftp
        .set_metadata(path.as_str(), attrs)
        .await
        .map_err(|e| format!("chmod failed: {e}"))
}



#[tauri::command]
pub async fn local_list_dir(path: String) -> Result<Vec<SftpEntry>, String> {
    let mut entries = Vec::new();

    let mut read_dir = tokio::fs::read_dir(&path)
        .await
        .map_err(|e| format!("Failed to read directory: {e}"))?;

    while let Some(dir_entry) = read_dir
        .next_entry()
        .await
        .map_err(|e| format!("Failed to read entry: {e}"))?
    {
        let name = dir_entry.file_name().to_string_lossy().to_string();
        let meta = dir_entry.metadata().await.map_err(|e| e.to_string())?;

        let entry_path = dir_entry.path().to_string_lossy().to_string();
        
        let entry_path = entry_path
            .strip_prefix(r"\\?\")
            .unwrap_or(&entry_path)
            .to_string();

        let is_dir = meta.is_dir();
        let is_symlink = meta.is_symlink();

        let modified = meta.modified().ok().and_then(|t| {
            t.duration_since(std::time::UNIX_EPOCH)
                .ok()
                .map(|d| d.as_secs().to_string())
        });

        #[cfg(unix)]
        let permissions = {
            use std::os::unix::fs::PermissionsExt;
            meta.permissions().mode()
        };
        #[cfg(not(unix))]
        let permissions: u32 = if meta.permissions().readonly() {
            0o444
        } else {
            0o644
        };

        entries.push(SftpEntry {
            name,
            path: entry_path,
            size: meta.len(),
            modified,
            permissions,
            is_dir,
            is_symlink,
        });
    }

    // Sort: directories first, then alphabetical (case-insensitive).
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}
