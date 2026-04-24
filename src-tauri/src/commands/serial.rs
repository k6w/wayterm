use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SerialPortInfo {
    pub port_name: String,
    pub description: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SerialOpenRequest {
    pub port_name: String,
    pub baud_rate: u32,
    pub data_bits: u8,
    pub stop_bits: u8,
    pub parity: String,
    pub flow_control: String,
}

struct SerialSession {
    tx: std::sync::mpsc::SyncSender<Vec<u8>>,
    stop: std::sync::mpsc::SyncSender<()>,
}

pub struct SerialManager {
    sessions: Arc<Mutex<HashMap<String, SerialSession>>>,
}

impl SerialManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[tauri::command]
pub fn serial_list_ports() -> Result<Vec<SerialPortInfo>, String> {
    let ports = serialport::available_ports().map_err(|e| e.to_string())?;
    Ok(ports
        .into_iter()
        .map(|p| SerialPortInfo {
            port_name: p.port_name,
            description: match p.port_type {
                serialport::SerialPortType::UsbPort(info) => {
                    info.product.or(info.manufacturer)
                }
                serialport::SerialPortType::BluetoothPort => Some("Bluetooth".to_string()),
                serialport::SerialPortType::PciPort => Some("PCI".to_string()),
                serialport::SerialPortType::Unknown => None,
            },
        })
        .collect())
}

#[tauri::command]
pub async fn serial_open(
    request: SerialOpenRequest,
    app: AppHandle,
    manager: State<'_, SerialManager>,
) -> Result<String, String> {
    let session_id = Uuid::new_v4().to_string();

    let data_bits = match request.data_bits {
        5 => serialport::DataBits::Five,
        6 => serialport::DataBits::Six,
        7 => serialport::DataBits::Seven,
        _ => serialport::DataBits::Eight,
    };
    let stop_bits = match request.stop_bits {
        2 => serialport::StopBits::Two,
        _ => serialport::StopBits::One,
    };
    let parity = match request.parity.as_str() {
        "even" => serialport::Parity::Even,
        "odd" => serialport::Parity::Odd,
        _ => serialport::Parity::None,
    };
    let flow_control = match request.flow_control.as_str() {
        "hardware" => serialport::FlowControl::Hardware,
        "software" => serialport::FlowControl::Software,
        _ => serialport::FlowControl::None,
    };

    let port = serialport::new(&request.port_name, request.baud_rate)
        .data_bits(data_bits)
        .stop_bits(stop_bits)
        .parity(parity)
        .flow_control(flow_control)
        .timeout(Duration::from_millis(10))
        .open()
        .map_err(|e| format!("Failed to open {}: {}", request.port_name, e))?;

    let port = Arc::new(Mutex::new(port));

    // Write channel: frontend sends data to serial port
    let (tx, rx) = std::sync::mpsc::sync_channel::<Vec<u8>>(64);
    // Stop signal channel
    let (stop_tx, stop_rx) = std::sync::mpsc::sync_channel::<()>(1);

    let session_id_clone = session_id.clone();
    let port_write = Arc::clone(&port);
    let port_read = Arc::clone(&port);
    let app_clone = app.clone();

    // Write thread: drains the write channel into the serial port
    std::thread::spawn(move || {
        loop {
            match rx.recv_timeout(Duration::from_millis(100)) {
                Ok(data) => {
                    let mut p = port_write.lock();
                    let _ = std::io::Write::write_all(p.as_mut(), &data);
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
    });

    // Read thread: reads from serial port, emits events
    let sid = session_id.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 256];
        loop {
            // Check stop signal
            if stop_rx.try_recv().is_ok() {
                break;
            }
            let result = {
                let mut p = port_read.lock();
                std::io::Read::read(p.as_mut(), &mut buf)
            };
            match result {
                Ok(0) => {}
                Ok(n) => {
                    let data: Vec<u8> = buf[..n].to_vec();
                    let _ = app_clone.emit(&format!("serial:output:{}", sid), data);
                }
                Err(ref e)
                    if e.kind() == std::io::ErrorKind::TimedOut
                        || e.kind() == std::io::ErrorKind::WouldBlock =>
                {
                    // Normal timeout, try again
                }
                Err(_) => {
                    // Port closed or error
                    let _ = app_clone.emit(&format!("serial:exit:{}", sid), ());
                    break;
                }
            }
        }
        let _ = app.emit(&format!("serial:exit:{}", session_id_clone), ());
    });

    manager.sessions.lock().insert(
        session_id.clone(),
        SerialSession { tx, stop: stop_tx },
    );

    Ok(session_id)
}

#[tauri::command]
pub async fn serial_write(
    session_id: String,
    data: Vec<u8>,
    manager: State<'_, SerialManager>,
) -> Result<(), String> {
    let sessions = manager.sessions.lock();
    let session = sessions
        .get(&session_id)
        .ok_or("Serial session not found")?;
    session.tx.send(data).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn serial_close(
    session_id: String,
    manager: State<'_, SerialManager>,
) -> Result<(), String> {
    let mut sessions = manager.sessions.lock();
    if let Some(session) = sessions.remove(&session_id) {
        let _ = session.stop.send(());
    }
    Ok(())
}
