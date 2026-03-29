use parking_lot::Mutex;
use russh::client::{Handle, Handler};
use russh::keys::ssh_key::PublicKey;
use std::collections::HashMap;
use std::net::TcpListener;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener as TokioTcpListener;
use tokio::sync::mpsc;

type ClientHandle = Handle<ClientHandler>;

pub struct PortForwardManager {
    /// Active port forwarding sessions, keyed by forward ID
    active_forwards: Arc<Mutex<HashMap<String, ActivePortForward>>>,
    /// Maps session IDs to SSH client handles for port forwarding
    ssh_handles: Arc<Mutex<HashMap<String, Arc<ClientHandle>>>>,
}

struct ActivePortForward {
    /// Channel sender to stop the forwarder
    stop_sender: mpsc::Sender<()>,
}

impl PortForwardManager {
    pub fn new() -> Self {
        Self {
            active_forwards: Arc::new(Mutex::new(HashMap::new())),
            ssh_handles: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Register an SSH handle for a session (used by terminal/sftp connections)
    pub fn register_ssh_handle(&self, session_id: String, handle: ClientHandle) {
        let mut handles = self.ssh_handles.lock();
        handles.insert(session_id, Arc::new(handle));
    }

    /// Unregister an SSH handle when a session disconnects
    pub fn unregister_ssh_handle(&self, session_id: &str) {
        let mut handles = self.ssh_handles.lock();
        handles.remove(session_id);
    }

    /// Get an SSH handle for a session
    pub fn get_ssh_handle(&self, session_id: &str) -> Option<Arc<ClientHandle>> {
        let handles = self.ssh_handles.lock();
        handles.get(session_id).cloned()
    }

    /// Start a port forward
    pub async fn start_port_forward(
        &self,
        forward_id: String,
        local_port: u16,
        remote_host: String,
        remote_port: u16,
        session_id: String,
    ) -> Result<(), String> {
        // Check if already active
        {
            let forwards = self.active_forwards.lock();
            if forwards.contains_key(&forward_id) {
                return Err("Port forward is already active".to_string());
            }
        }

        // Get SSH handle
        let ssh_handle = self.get_ssh_handle(&session_id).ok_or_else(|| {
            "No active SSH connection found. Please connect to the server first.".to_string()
        })?;

        // Bind to local port using tokio for async compatibility
        let listener = TokioTcpListener::bind(format!("127.0.0.1:{}", local_port))
            .await
            .map_err(|e| format!("Failed to bind to local port {}: {}", local_port, e))?;

        // Create stop channel
        let (stop_sender, mut stop_receiver) = mpsc::channel::<()>(1);

        // Store the active forward
        {
            let mut forwards = self.active_forwards.lock();
            forwards.insert(forward_id.clone(), ActivePortForward {
                stop_sender,
            });
        }

        // Clone necessary data for the async task
        let active_forwards = Arc::clone(&self.active_forwards);
        let remote_host_clone = remote_host.clone();
        let remote_port_clone = remote_port;
        let forward_id_clone = forward_id.clone();

        // Spawn the port forwarding task
        tokio::spawn(async move {
            loop {
                // Check for stop signal
                tokio::select! {
                    _ = stop_receiver.recv() => {
                        break;
                    }
                    _ = tokio::time::sleep(std::time::Duration::from_millis(100)) => {}
                }

                // Try to accept a connection
                tokio::select! {
                    result = listener.accept() => {
                        match result {
                            Ok((local_stream, _addr)) => {
                                // Clone handle for this connection
                                let handle = Arc::clone(&ssh_handle);
                                let remote_host = remote_host_clone.clone();
                                let remote_port = remote_port_clone;
                                let forward_id = forward_id_clone.clone();

                                tokio::spawn(async move {
                                    if let Err(e) = handle_local_connection(
                                        handle,
                                        local_stream,
                                        &remote_host,
                                        remote_port,
                                    ).await {
                                        eprintln!("Port forward {}: Error handling connection: {}", forward_id, e);
                                    }
                                });
                            }
                            Err(e) => {
                                eprintln!("Port forward {}: Error accepting connection: {}", forward_id_clone, e);
                            }
                        }
                    }
                    _ = tokio::time::sleep(std::time::Duration::from_millis(50)) => {}
                }

                // Check if still active
                {
                    let forwards = active_forwards.lock();
                    if !forwards.contains_key(&forward_id_clone) {
                        break;
                    }
                }
            }

            // Clean up
            let mut forwards = active_forwards.lock();
            forwards.remove(&forward_id_clone);
        });

        Ok(())
    }

    /// Stop a port forward
    pub fn stop_port_forward(&self, forward_id: &str) -> Result<(), String> {
        let forwards = self.active_forwards.lock();
        
        if let Some(active_forward) = forwards.get(forward_id) {
            // Send stop signal
            let sender = active_forward.stop_sender.clone();
            drop(forwards); // Release lock before sending
            
            // Try to send stop signal (may fail if channel is closed)
            let _ = sender.try_send(());
            Ok(())
        } else {
            Err("Port forward is not active".to_string())
        }
    }

    /// Check if a port forward is active
    pub fn is_active(&self, forward_id: &str) -> bool {
        let forwards = self.active_forwards.lock();
        forwards.contains_key(forward_id)
    }

    /// Stop all port forwards (used when disconnecting)
    pub fn stop_all(&self) {
        let forwards = self.active_forwards.lock();
        for (_id, forward) in forwards.iter() {
            let _ = forward.stop_sender.try_send(());
        }
    }
}

async fn handle_local_connection(
    ssh_handle: Arc<ClientHandle>,
    local_stream: tokio::net::TcpStream,
    remote_host: &str,
    remote_port: u16,
) -> Result<(), String> {
    // Open a channel to the remote host
    let mut channel = ssh_handle.channel_open_session()
        .await
        .map_err(|e| format!("Failed to open SSH channel: {}", e))?;

    // Request remote port forwarding using direct_tcpip
    // This is the standard SSH port forwarding mechanism
    channel.request_direct_tcpip(
        remote_host,
        remote_port,
        "127.0.0.1",
        0,
    ).await
    .map_err(|e| format!("Failed to request port forward: {}", e))?;

    // Get the socket for the channel to use for forwarding
    let mut remote_stream = channel
        .into_stream()
        .await
        .map_err(|e| format!("Failed to get channel stream: {}", e))?;

    // Bidirectional forwarding between local and remote
    let mut local_buf = [0u8; 8192];
    let mut remote_buf = [0u8; 8192];

    loop {
        tokio::select! {
            result = local_stream.read(&mut local_buf) => {
                let n = result.map_err(|e| format!("Read error: {}", e))?;
                if n == 0 {
                    break;
                }
                // Forward to remote
                remote_stream.write_all(&local_buf[..n]).await
                    .map_err(|e| format!("Write to remote error: {}", e))?;
            }
            result = remote_stream.read(&mut remote_buf) => {
                let n = result.map_err(|e| format!("Read from remote error: {}", e))?;
                if n == 0 {
                    break;
                }
                // Forward to local
                local_stream.write_all(&remote_buf[..n]).await
                    .map_err(|e| format!("Write to local error: {}", e))?;
            }
        }
    }

    Ok(())
}

/// Client handler for SSH port forwarding
pub struct ClientHandler;

#[async_trait::async_trait]
impl Handler for ClientHandler {
    type Error = russh::Error;

    async fn check_server_key(&mut self, _server_public_key: &PublicKey) -> Result<bool, Self::Error> {
        Ok(true)
    }
}