use std::collections::HashMap;
use std::sync::Arc;

use russh::client;
use russh::keys::PrivateKeyWithHashAlg;
use russh_sftp::client::SftpSession;
use tokio::sync::Mutex;




struct ClientHandler;

impl client::Handler for ClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &russh::keys::ssh_key::PublicKey,
    ) -> Result<bool, Self::Error> {
        
        Ok(true)
    }
}


pub struct SftpSessionEntry {
    
    _handle: client::Handle<ClientHandler>,
    
    pub sftp: SftpSession,
    
    #[allow(dead_code)]
    pub connection_name: String,
}


pub struct SftpSessionManager {
    sessions: Arc<Mutex<HashMap<String, SftpSessionEntry>>>,
}

impl SftpSessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    
    
    
    
    #[allow(clippy::too_many_arguments)]
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
        
        let config = client::Config {
            inactivity_timeout: Some(std::time::Duration::from_secs(300)),
            ..Default::default()
        };

        
        let mut handle =
            client::connect(Arc::new(config), (host, port), ClientHandler)
                .await
                .map_err(|e| format!("SSH connect failed: {e}"))?;

        
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

        
        let channel = handle
            .channel_open_session()
            .await
            .map_err(|e| format!("Failed to open SSH channel: {e}"))?;

        channel
            .request_subsystem(true, "sftp")
            .await
            .map_err(|e| format!("Failed to request SFTP subsystem: {e}"))?;

        
        let sftp = SftpSession::new(channel.into_stream())
            .await
            .map_err(|e| format!("Failed to initialise SFTP session: {e}"))?;

        
        let entry = SftpSessionEntry {
            _handle: handle,
            sftp,
            connection_name,
        };
        self.sessions.lock().await.insert(id, entry);

        Ok(())
    }

    
    pub async fn disconnect(&self, id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        if let Some(entry) = sessions.remove(id) {
            let _ = entry.sftp.close().await;
        }
        Ok(())
    }

    
    
    pub fn sessions(&self) -> Arc<Mutex<HashMap<String, SftpSessionEntry>>> {
        Arc::clone(&self.sessions)
    }
}
