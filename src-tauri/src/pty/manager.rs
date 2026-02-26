use super::session::PtySession;
use parking_lot::Mutex;
use std::collections::HashMap;
use std::io::Read;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtySession>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn spawn(
        &self,
        session_id: String,
        shell: &str,
        args: &[String],
        cwd: &str,
        env: &[(String, String)],
        rows: u16,
        cols: u16,
        app: AppHandle,
    ) -> Result<(), String> {
        // Validate minimum terminal size to prevent issues
        if rows < 2 || cols < 2 {
            return Err(format!("Invalid terminal size: {}x{} (minimum 2x2)", rows, cols));
        }
        let (session, reader) = PtySession::spawn(shell, args, cwd, env, rows, cols)?;
        self.sessions.lock().insert(session_id.clone(), session);

        let sid = session_id.clone();
        std::thread::spawn(move || {
            Self::read_loop(reader, &sid, &app);
        });

        Ok(())
    }

    fn read_loop(mut reader: Box<dyn Read + Send>, session_id: &str, app: &AppHandle) {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = buf[..n].to_vec();
                    let _ = app.emit(&format!("terminal:output:{}", session_id), data);
                }
                Err(_) => break,
            }
        }
        let _ = app.emit(&format!("terminal:exit:{}", session_id), ());
    }

    pub fn write(&self, session_id: &str, data: &[u8]) -> Result<(), String> {
        let sessions = self.sessions.lock();
        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("session {} not found", session_id))?;
        session.write(data)
    }

    pub fn resize(&self, session_id: &str, rows: u16, cols: u16) -> Result<(), String> {
        let sessions = self.sessions.lock();
        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("session {} not found", session_id))?;
        session.resize(rows, cols)
    }

    pub fn kill(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock();
        if let Some(session) = sessions.remove(session_id) {
            let _ = session.kill();
        }
        Ok(())
    }
}
