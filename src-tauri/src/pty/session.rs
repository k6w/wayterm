use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::io::{Read, Write};
use std::sync::Arc;

pub struct PtySession {
    master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
    child: Arc<Mutex<Box<dyn portable_pty::Child + Send + Sync>>>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
}

impl PtySession {
    pub fn spawn(
        shell: &str,
        args: &[String],
        cwd: &str,
        env: &[(String, String)],
        rows: u16,
        cols: u16,
    ) -> Result<(Self, Box<dyn Read + Send>), String> {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;

        let mut cmd = CommandBuilder::new(shell);
        for arg in args {
            cmd.arg(arg);
        }
        cmd.cwd(cwd);
        
        
        let mut has_term = false;
        for (key, value) in env {
            cmd.env(key, value);
            if key == "TERM" {
                has_term = true;
            }
        }
        
        
        if !has_term {
            cmd.env("TERM", "xterm-256color");
        }

        let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
        let reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
        let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

        Ok((
            Self {
                master: Arc::new(Mutex::new(pair.master)),
                child: Arc::new(Mutex::new(child)),
                writer: Arc::new(Mutex::new(writer)),
            },
            reader,
        ))
    }

    pub fn write(&self, data: &[u8]) -> Result<(), String> {
        self.writer
            .lock()
            .write_all(data)
            .map_err(|e| e.to_string())
    }

    pub fn resize(&self, rows: u16, cols: u16) -> Result<(), String> {
        self.master
            .lock()
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())
    }

    pub fn kill(&self) -> Result<(), String> {
        self.child.lock().kill().map_err(|e| e.to_string())
    }
}
