use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::io::{Read, Write};
use std::sync::Arc;

/// Terminal.app variables that make macOS zsh start its session save/restore
/// ("Restored session...") and touch ~/.zsh_sessions.
const APPLE_TERMINAL_VARS: &[&str] = &["TERM_SESSION_ID"];

/// Builds the child environment: caller vars, our own terminal identity (never the
/// launcher's Apple_Terminal one) and a default TERM.
fn apply_env(cmd: &mut CommandBuilder, env: &[(String, String)], version: &str) {
    for (key, value) in env {
        cmd.env(key, value);
    }
    if cmd.get_env("TERM").is_none() {
        cmd.env("TERM", "xterm-256color");
    }
    for key in APPLE_TERMINAL_VARS {
        cmd.env_remove(key);
    }
    if cmd.get_env("__CFBundleIdentifier").is_some_and(|v| v == "com.apple.Terminal") {
        cmd.env_remove("__CFBundleIdentifier");
    }
    cmd.env("TERM_PROGRAM", "nexterm");
    cmd.env("TERM_PROGRAM_VERSION", version);
}

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
        
        
        apply_env(&mut cmd, env, env!("CARGO_PKG_VERSION"));

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

    /// Working directory of the PTY's foreground process (falling back to the
    /// shell itself), independent of which shell is running.
    pub fn cwd(&self) -> Option<String> {
        let foreground = self.master.lock().process_group_leader();
        foreground
            .and_then(super::cwd::cwd_of_pid)
            .or_else(|| {
                let pid = self.child.lock().process_id()?;
                super::cwd::cwd_of_pid(pid as i32)
            })
    }

    pub fn kill(&self) -> Result<(), String> {
        self.child.lock().kill().map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn get(cmd: &CommandBuilder, key: &str) -> Option<String> {
        cmd.get_env(key).map(|v| v.to_string_lossy().into_owned())
    }

    #[test]
    fn replaces_apple_terminal_identity() {
        let mut cmd = CommandBuilder::new("/bin/zsh");
        cmd.env("TERM_PROGRAM", "Apple_Terminal");
        cmd.env("TERM_PROGRAM_VERSION", "455");
        cmd.env("TERM_SESSION_ID", "ABC-123");
        cmd.env("__CFBundleIdentifier", "com.apple.Terminal");
        apply_env(&mut cmd, &[], "1.2.3");
        assert_eq!(get(&cmd, "TERM_PROGRAM").as_deref(), Some("nexterm"));
        assert_eq!(get(&cmd, "TERM_PROGRAM_VERSION").as_deref(), Some("1.2.3"));
        assert_eq!(get(&cmd, "TERM_SESSION_ID"), None);
        assert_eq!(get(&cmd, "__CFBundleIdentifier"), None);
    }

    #[test]
    fn keeps_explicit_term_and_defaults_otherwise() {
        let mut cmd = CommandBuilder::new("/bin/zsh");
        apply_env(&mut cmd, &[("TERM".into(), "screen".into())], "1");
        assert_eq!(get(&cmd, "TERM").as_deref(), Some("screen"));
        let mut cmd = CommandBuilder::new("/bin/zsh");
        cmd.env_remove("TERM");
        apply_env(&mut cmd, &[], "1");
        assert_eq!(get(&cmd, "TERM").as_deref(), Some("xterm-256color"));
    }

    #[cfg(unix)]
    #[test]
    fn session_cwd_follows_foreground_process() {
        let dir = std::env::temp_dir().canonicalize().unwrap();
        let (session, _reader) =
            PtySession::spawn("/bin/sh", &[], dir.to_str().unwrap(), &[], 24, 80).unwrap();
        let got = (0..20).find_map(|_| {
            std::thread::sleep(std::time::Duration::from_millis(50));
            session.cwd()
        });
        let _ = session.kill();
        assert_eq!(std::path::Path::new(&got.unwrap()).canonicalize().unwrap(), dir);
    }
}
