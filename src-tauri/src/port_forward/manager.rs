use parking_lot::Mutex;
use russh::client::{Handle, Handler};
use russh::keys::ssh_key::PublicKey;
use std::collections::HashMap;
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener as TokioTcpListener;
use tokio::sync::mpsc;

type ClientHandle = Handle<ClientHandler>;

pub struct PortForwardManager {
    active_forwards: Arc<Mutex<HashMap<String, ActivePortForward>>>,
    ssh_handles: Arc<Mutex<HashMap<String, Arc<ClientHandle>>>>,
    local_tunnels: Arc<Mutex<HashMap<String, Child>>>,
}

struct ActivePortForward {
    stop_sender: mpsc::Sender<()>,
}

impl PortForwardManager {
    pub fn new() -> Self {
        Self {
            active_forwards: Arc::new(Mutex::new(HashMap::new())),
            ssh_handles: Arc::new(Mutex::new(HashMap::new())),
            local_tunnels: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    #[allow(dead_code)]
    pub fn register_ssh_handle(&self, session_id: String, handle: ClientHandle) {
        let mut handles = self.ssh_handles.lock();
        handles.insert(session_id, Arc::new(handle));
    }

    #[allow(dead_code)]
    pub fn unregister_ssh_handle(&self, session_id: &str) {
        let mut handles = self.ssh_handles.lock();
        handles.remove(session_id);
    }

    #[allow(dead_code)]
    pub fn get_ssh_handle(&self, session_id: &str) -> Option<Arc<ClientHandle>> {
        let handles = self.ssh_handles.lock();
        handles.get(session_id).cloned()
    }

    pub async fn start_port_forward(
        &self,
        forward_id: String,
        local_port: u16,
        remote_host: String,
        remote_port: u16,
        session_id: String,
    ) -> Result<(), String> {
        {
            let forwards = self.active_forwards.lock();
            if forwards.contains_key(&forward_id) {
                return Err("Port forward is already active".to_string());
            }
        }

        let ssh_handle = self.get_ssh_handle(&session_id).ok_or_else(|| {
            "No active SSH connection found. Please connect to the server first.".to_string()
        })?;

        let listener = TokioTcpListener::bind(format!("127.0.0.1:{}", local_port))
            .await
            .map_err(|e| format!("Failed to bind to local port {}: {}", local_port, e))?;

        let (stop_sender, mut stop_receiver) = mpsc::channel::<()>(1);

        {
            let mut forwards = self.active_forwards.lock();
            forwards.insert(forward_id.clone(), ActivePortForward {
                stop_sender,
            });
        }

        let active_forwards = Arc::clone(&self.active_forwards);
        let remote_host_clone = remote_host.clone();
        let remote_port_clone = remote_port;
        let forward_id_clone = forward_id.clone();

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = stop_receiver.recv() => {
                        break;
                    }
                    _ = tokio::time::sleep(std::time::Duration::from_millis(100)) => {}
                }

                tokio::select! {
                    result = listener.accept() => {
                        match result {
                            Ok((local_stream, _addr)) => {
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

                {
                    let forwards = active_forwards.lock();
                    if !forwards.contains_key(&forward_id_clone) {
                        break;
                    }
                }
            }

            let mut forwards = active_forwards.lock();
            forwards.remove(&forward_id_clone);
        });

        Ok(())
    }

    pub fn stop_port_forward(&self, forward_id: &str) -> Result<(), String> {
        let forwards = self.active_forwards.lock();
        
        if let Some(active_forward) = forwards.get(forward_id) {
            let sender = active_forward.stop_sender.clone();
            drop(forwards);
            
            let _ = sender.try_send(());
            Ok(())
        } else {
            Err("Port forward is not active".to_string())
        }
    }

    #[allow(dead_code)]
    pub fn is_active(&self, forward_id: &str) -> bool {
        let forwards = self.active_forwards.lock();
        forwards.contains_key(forward_id)
    }

    #[allow(dead_code)]
    pub fn stop_all(&self) {
        let forwards = self.active_forwards.lock();
        for forward in forwards.values() {
            let _ = forward.stop_sender.try_send(());
        }
        let mut tunnels = self.local_tunnels.lock();
        for (_id, mut child) in tunnels.drain() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    pub fn start_local_tunnel(&self, forward_id: String, ssh_cmd: &str, args: &[String]) -> Result<(), String> {
        let child = Command::new(ssh_cmd)
            .args(args)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to spawn ssh tunnel process: {}", e))?;

        let mut tunnels = self.local_tunnels.lock();
        tunnels.insert(forward_id, child);

        Ok(())
    }

    pub fn stop_local_tunnel(&self, forward_id: &str) -> Result<(), String> {
        let mut tunnels = self.local_tunnels.lock();
        if let Some(mut child) = tunnels.remove(forward_id) {
            child.kill().map_err(|e| format!("Failed to kill ssh tunnel: {}", e))?;
            let _ = child.wait();
        }
        Ok(())
    }
}

async fn handle_local_connection(
    ssh_handle: Arc<ClientHandle>,
    local_stream: tokio::net::TcpStream,
    remote_host: &str,
    remote_port: u16,
) -> Result<(), String> {
    let channel = ssh_handle
        .channel_open_direct_tcpip(remote_host, remote_port as u32, "127.0.0.1", 0)
        .await
        .map_err(|e| format!("Failed to open SSH direct tcpip channel: {}", e))?;

    let (mut local_reader, mut local_writer) = tokio::io::split(local_stream);
    let (mut remote_read_half, remote_write_half) = channel.split();
    let mut remote_reader = remote_read_half.make_reader();
    let mut remote_writer = remote_write_half.make_writer();

    let mut local_buf = [0u8; 8192];
    let mut remote_buf = [0u8; 8192];

    loop {
        tokio::select! {
            result = local_reader.read(&mut local_buf) => {
                let n = result.map_err(|e| format!("Read error: {}", e))?;
                if n == 0 {
                    break;
                }
                remote_writer
                    .write_all(&local_buf[..n])
                    .await
                    .map_err(|e| format!("Write to remote error: {}", e))?;
            }
            result = remote_reader.read(&mut remote_buf) => {
                let n = result.map_err(|e| format!("Read from remote error: {}", e))?;
                if n == 0 {
                    break;
                }
                local_writer
                    .write_all(&remote_buf[..n])
                    .await
                    .map_err(|e| format!("Write to local error: {}", e))?;
            }
        }
    }

    Ok(())
}

pub struct ClientHandler {
    pub host: String,
    pub port: u16,
}

impl Handler for ClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &PublicKey,
    ) -> Result<bool, Self::Error> {
        match crate::commands::known_hosts::verify_host_key(&self.host, self.port, server_public_key) {
            Ok(valid) => Ok(valid),
            Err(e) => Err(russh::Error::from(std::io::Error::new(std::io::ErrorKind::PermissionDenied, e))),
        }
    }
}
