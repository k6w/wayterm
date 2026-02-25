use std::collections::HashMap;
use std::sync::Arc;

use russh::client;
use russh::keys::PrivateKeyWithHashAlg;
use russh_sftp::client::SftpSession;
use tokio::sync::Mutex;

/// Minimal SSH client handler that accepts all server host keys
/// (matching the current `StrictHostKeyChecking=accept-new` behaviour
/// used elsewhere in Nexterm).
struct ClientHandler;

impl client::Handler for ClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &russh::keys::ssh_key::PublicKey,
    ) -> Result<bool, Self::Error> {
        // Accept all host keys -- mirrors existing app behaviour.
        Ok(true)
    }
}

/// One active SFTP session (SSH connection + SFTP channel).
pub struct SftpSessionEntry {
    /// Keep the SSH handle alive so the connection stays open.
    _handle: client::Handle<ClientHandler>,
    /// The SFTP channel used for file operations.
    pub sftp: SftpSession,
    /// Human-readable label (connection name).
    #[allow(dead_code)]
    pub connection_name: String,
}

/// Manages multiple SFTP sessions keyed by a UUID string.
pub struct SftpSessionManager {
    sessions: Arc<Mutex<HashMap<String, SftpSessionEntry>>>,
}

impl SftpSessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Open an SSH connection and start an SFTP channel.
    ///
    /// `auth_method` must be `"password"` or `"key"`.
    /// For key auth, `key_pem` should contain the PEM-encoded private key.
    pub async fn connect(
        &self,
        id: String,
        host: &str,
        port: u16,
        username: &str,
        auth_method: &str,
        password: Option<&str>,
        key_pem: Option<&str>,
        connection_name: String,
    ) -> Result<(), String> {
        // 1. SSH config with sensible defaults
        let config = client::Config {
            inactivity_timeout: Some(std::time::Duration::from_secs(300)),
            ..Default::default()
        };

        // 2. TCP connect
        let mut handle =
            client::connect(Arc::new(config), (host, port), ClientHandler)
                .await
                .map_err(|e| format!("SSH connect failed: {e}"))?;

        // 3. Authenticate
        let auth_ok = match auth_method {
            "password" => {
                let pw = password.unwrap_or("");
                handle
                    .authenticate_password(username, pw)
                    .await
                    .map_err(|e| format!("Password auth failed: {e}"))?
                    .success()
            }
            "key" => {
                let pem = key_pem.ok_or("No private key PEM provided")?;
                let secret = russh::keys::decode_secret_key(pem, None)
                    .map_err(|e| format!("Failed to decode private key: {e}"))?;
                let key_with_alg =
                    PrivateKeyWithHashAlg::new(Arc::new(secret), None);
                handle
                    .authenticate_publickey(username, key_with_alg)
                    .await
                    .map_err(|e| format!("Public-key auth failed: {e}"))?
                    .success()
            }
            other => return Err(format!("Unknown auth method: {other}")),
        };

        if !auth_ok {
            return Err("Authentication rejected by server".into());
        }

        // 4. Open a session channel and request the SFTP subsystem
        let channel = handle
            .channel_open_session()
            .await
            .map_err(|e| format!("Failed to open SSH channel: {e}"))?;

        channel
            .request_subsystem(true, "sftp")
            .await
            .map_err(|e| format!("Failed to request SFTP subsystem: {e}"))?;

        // 5. Wrap the channel as an SFTP session
        let sftp = SftpSession::new(channel.into_stream())
            .await
            .map_err(|e| format!("Failed to initialise SFTP session: {e}"))?;

        // 6. Store
        let entry = SftpSessionEntry {
            _handle: handle,
            sftp,
            connection_name,
        };
        self.sessions.lock().await.insert(id, entry);

        Ok(())
    }

    /// Close and remove an SFTP session.
    pub async fn disconnect(&self, id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        if let Some(entry) = sessions.remove(id) {
            let _ = entry.sftp.close().await;
        }
        Ok(())
    }

    /// Return a clone of the inner sessions map handle so that
    /// commands can lock it and operate on a specific session.
    pub fn sessions(&self) -> Arc<Mutex<HashMap<String, SftpSessionEntry>>> {
        Arc::clone(&self.sessions)
    }
}
