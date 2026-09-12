//! Changed host keys seen during a handshake, kept briefly so a replacement can
//! only pin the key the server actually presented (not an arbitrary key sent
//! over IPC) in place of a key that was actually saved.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// How long a detected change can be confirmed.
pub const PENDING_TTL: Duration = Duration::from_secs(10 * 60);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PendingChange {
    pub new_key_type: String,
    pub new_fingerprint: String,
    /// Fingerprints of the saved keys the server's key did not match.
    pub old_fingerprints: Vec<String>,
    pub recorded: Instant,
}

#[derive(Default)]
pub struct PendingChanges {
    map: HashMap<(String, u16), PendingChange>,
}

fn key(host: &str, port: u16) -> (String, u16) {
    (host.to_ascii_lowercase(), port)
}

impl PendingChanges {
    fn purge(&mut self, now: Instant) {
        self.map.retain(|_, c| now.saturating_duration_since(c.recorded) < PENDING_TTL);
    }

    /// Remembers the latest change seen for host:port (a newer one replaces it).
    pub fn record(&mut self, host: &str, port: u16, change: PendingChange) {
        let now = change.recorded;
        self.purge(now);
        self.map.insert(key(host, port), change);
    }

    /// Ok when a replacement of `expected_old_fingerprint` by this key matches a
    /// change recorded for host:port within the last 10 minutes.
    pub fn verify(
        &mut self,
        host: &str,
        port: u16,
        new_key_type: &str,
        new_fingerprint: &str,
        expected_old_fingerprint: &str,
        now: Instant,
    ) -> Result<(), String> {
        self.purge(now);
        let change = self.map.get(&key(host, port)).ok_or_else(|| {
            "No changed host key is waiting for confirmation for this server (it may have expired). \
             Connect again to review it. Nothing was changed."
                .to_string()
        })?;
        if change.new_key_type != new_key_type || change.new_fingerprint != new_fingerprint {
            return Err("Refused: this is not the key the server presented. Nothing was changed.".to_string());
        }
        if !change.old_fingerprints.iter().any(|f| f == expected_old_fingerprint) {
            return Err("Refused: that is not one of the saved keys for this server. Nothing was changed.".to_string());
        }
        Ok(())
    }

    /// Forgets the change for host:port (after a successful replacement).
    pub fn consume(&mut self, host: &str, port: u16) {
        self.map.remove(&key(host, port));
    }
}

pub static PENDING_CHANGES: Mutex<Option<PendingChanges>> = Mutex::new(None);

/// Runs `f` on a store.
pub fn with_store<R>(store: &Mutex<Option<PendingChanges>>, f: impl FnOnce(&mut PendingChanges) -> R) -> R {
    let mut guard = store.lock().unwrap_or_else(|e| e.into_inner());
    f(guard.get_or_insert_with(PendingChanges::default))
}

/// Runs `f` on the process-wide store.
pub fn with_pending<R>(f: impl FnOnce(&mut PendingChanges) -> R) -> R {
    with_store(&PENDING_CHANGES, f)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn change(at: Instant) -> PendingChange {
        PendingChange {
            new_key_type: "ssh-ed25519".into(),
            new_fingerprint: "SHA256:new".into(),
            old_fingerprints: vec!["SHA256:old".into(), "SHA256:oldrsa".into()],
            recorded: at,
        }
    }

    #[test]
    fn accepts_only_the_presented_key_and_a_saved_old_key() {
        let t0 = Instant::now();
        let mut store = PendingChanges::default();
        store.record("Example.com", 22, change(t0));
        assert!(store.verify("example.com", 22, "ssh-ed25519", "SHA256:new", "SHA256:old", t0).is_ok());
        assert!(store.verify("example.com", 22, "ssh-ed25519", "SHA256:new", "SHA256:oldrsa", t0).is_ok());
        assert!(store.verify("example.com", 22, "ssh-ed25519", "SHA256:other", "SHA256:old", t0).is_err());
        assert!(store.verify("example.com", 22, "ssh-rsa", "SHA256:new", "SHA256:old", t0).is_err());
        assert!(store.verify("example.com", 22, "ssh-ed25519", "SHA256:new", "SHA256:unknown", t0).is_err());
        assert!(store.verify("example.com", 2222, "ssh-ed25519", "SHA256:new", "SHA256:old", t0).is_err());
        assert!(store.verify("other.org", 22, "ssh-ed25519", "SHA256:new", "SHA256:old", t0).is_err());
    }

    #[test]
    fn expires_after_ten_minutes() {
        let t0 = Instant::now();
        let mut store = PendingChanges::default();
        store.record("example.com", 22, change(t0));
        let almost = t0 + PENDING_TTL - Duration::from_secs(1);
        assert!(store.verify("example.com", 22, "ssh-ed25519", "SHA256:new", "SHA256:old", almost).is_ok());
        let err = store.verify("example.com", 22, "ssh-ed25519", "SHA256:new", "SHA256:old", t0 + PENDING_TTL).unwrap_err();
        assert!(err.contains("expired"), "{err}");
    }

    #[test]
    fn consume_forgets_and_a_newer_change_wins() {
        let t0 = Instant::now();
        let mut store = PendingChanges::default();
        store.record("example.com", 22, change(t0));
        let mut newer = change(t0);
        newer.new_fingerprint = "SHA256:newer".into();
        store.record("example.com", 22, newer);
        assert!(store.verify("example.com", 22, "ssh-ed25519", "SHA256:new", "SHA256:old", t0).is_err());
        assert!(store.verify("example.com", 22, "ssh-ed25519", "SHA256:newer", "SHA256:old", t0).is_ok());
        store.consume("EXAMPLE.com", 22);
        assert!(store.verify("example.com", 22, "ssh-ed25519", "SHA256:newer", "SHA256:old", t0).is_err());
    }
}
