//! Reading and safely rewriting an OpenSSH `known_hosts` file.
//!
//! Host matching follows OpenSSH: a host on port 22 is written `host`, on any
//! other port `[host]:port`; hashed entries (`|1|salt|hmac`) are matched with
//! HMAC-SHA1. Wildcard and negated patterns are never matched or rewritten.
//! Marker lines (`@cert-authority`, `@revoked`) are not host keys and are never
//! modified; a key listed under `@revoked` is refused.

use base64::engine::general_purpose::{STANDARD, STANDARD_NO_PAD};
use base64::Engine;
use hmac::{Hmac, Mac};
use serde::Serialize;
use sha1::Sha1;
use sha2::{Digest, Sha256};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// Separates the human-readable "HOST KEY CHANGED" message from its JSON payload.
pub const MISMATCH_MARKER: &str = "\nnexterm-host-key-mismatch:";

/// Name of the single backup written next to known_hosts before a replacement.
const BACKUP_SUFFIX: &str = ".nexterm-bak";

pub mod pending;
pub mod resolve;

/// Serialises our own writers of known_hosts within this process.
static WRITE_LOCK: Mutex<()> = Mutex::new(());

/// A key already saved for a host.
#[derive(Debug, PartialEq, Eq, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedKey {
    pub key_type: String,
    /// "SHA256:…", or "invalid key" when the saved key does not decode.
    pub fingerprint: String,
    /// 1-based line in known_hosts.
    pub line_number: usize,
}

#[derive(Debug, PartialEq, Eq)]
pub enum HostKeyCheck {
    /// A saved entry for this host holds exactly this key.
    Trusted,
    /// No entry for this host.
    Unknown,
    /// The host has saved keys, none of them this one.
    Changed(Vec<SavedKey>),
    /// This key is listed under `@revoked`.
    Revoked,
}

/// Everything the UI needs to show a changed key and to request its replacement.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostKeyMismatch {
    pub host: String,
    pub port: u16,
    pub known_hosts_path: String,
    pub old_keys: Vec<SavedKey>,
    pub new_key_type: String,
    pub new_fingerprint: String,
    pub new_key_b64: String,
}

impl HostKeyMismatch {
    /// The connect error: a readable sentence, then the JSON payload after [`MISMATCH_MARKER`].
    pub fn to_error(&self) -> String {
        let json = serde_json::to_string(self).unwrap_or_else(|_| "{}".to_string());
        format!(
            "HOST KEY CHANGED for {}:{}! This could indicate a man-in-the-middle attack. \
             The connection was not made.{MISMATCH_MARKER}{json}",
            self.host, self.port
        )
    }
}

/// The result of a replacement.
#[derive(Debug)]
pub struct Replaced {
    /// The new file content.
    pub content: String,
    /// 1-based lines whose entry for this host was removed.
    pub replaced_lines: Vec<usize>,
    pub old_fingerprint: String,
    pub new_fingerprint: String,
    /// True when a replaced entry was hashed (the new entry is hashed too).
    pub hashed: bool,
}

/// OpenSSH SHA256 fingerprint ("SHA256:" + unpadded base64) of a base64 key blob.
pub fn fingerprint_sha256(key_b64: &str) -> Result<String, String> {
    let blob = decode_blob(key_b64).ok_or_else(|| "Invalid public key encoding".to_string())?;
    Ok(fingerprint_of_blob(&blob))
}

fn fingerprint_of_blob(blob: &[u8]) -> String {
    format!("SHA256:{}", STANDARD_NO_PAD.encode(Sha256::digest(blob)))
}

fn decode_blob(key_b64: &str) -> Option<Vec<u8>> {
    let blob = STANDARD.decode(key_b64).ok()?;
    (!blob.is_empty()).then_some(blob)
}

/// The key type string embedded at the start of an SSH public key blob.
fn blob_key_type(blob: &[u8]) -> Option<&str> {
    let len = u32::from_be_bytes(blob.get(..4)?.try_into().ok()?) as usize;
    std::str::from_utf8(blob.get(4..4 + len)?).ok()
}

// ---------------------------------------------------------------------------
// Line parsing

/// One known_hosts line, borrowed from the file. Byte offsets are into `body`.
struct Entry<'a> {
    marker: Option<&'a str>,
    hosts: &'a str,
    hosts_start: usize,
    hosts_end: usize,
    key_type: &'a str,
    key_b64: &'a str,
}

/// Splits a line into its body and its terminator ("\n", "\r\n" or "").
fn split_terminator(line: &str) -> (&str, &str) {
    if let Some(body) = line.strip_suffix("\r\n") {
        (body, "\r\n")
    } else if let Some(body) = line.strip_suffix('\n') {
        (body, "\n")
    } else {
        (line, "")
    }
}

/// Whitespace-separated tokens with their byte ranges.
fn tokens(body: &str) -> Vec<(usize, usize)> {
    let mut out = Vec::new();
    let mut start = None;
    for (i, c) in body.char_indices() {
        match (c == ' ' || c == '\t', start) {
            (true, Some(s)) => {
                out.push((s, i));
                start = None;
            }
            (false, None) => start = Some(i),
            _ => {}
        }
    }
    if let Some(s) = start {
        out.push((s, body.len()));
    }
    out
}

/// None for comments, blank and malformed lines (which are always kept as they are).
fn parse_entry(body: &str) -> Option<Entry<'_>> {
    let toks = tokens(body);
    let first = toks.first()?;
    let first_text = &body[first.0..first.1];
    if first_text.starts_with('#') {
        return None;
    }
    let (marker, rest) = if first_text.starts_with('@') {
        (Some(first_text), &toks[1..])
    } else {
        (None, &toks[..])
    };
    if rest.len() < 3 {
        return None;
    }
    let (hs, he) = rest[0];
    Some(Entry {
        marker,
        hosts: &body[hs..he],
        hosts_start: hs,
        hosts_end: he,
        key_type: &body[rest[1].0..rest[1].1],
        key_b64: &body[rest[2].0..rest[2].1],
    })
}

/// How OpenSSH names this host in known_hosts (lowercase).
fn host_pattern(host: &str, port: u16) -> String {
    let host = host.to_ascii_lowercase();
    if port == 22 {
        host
    } else {
        format!("[{host}]:{port}")
    }
}

fn hash_matches(token: &str, pattern: &str) -> bool {
    let Some(rest) = token.strip_prefix("|1|") else {
        return false;
    };
    let Some((salt_b64, hash_b64)) = rest.split_once('|') else {
        return false;
    };
    let (Ok(salt), Ok(hash)) = (STANDARD.decode(salt_b64), STANDARD.decode(hash_b64)) else {
        return false;
    };
    let Ok(mut mac) = Hmac::<Sha1>::new_from_slice(&salt) else {
        return false;
    };
    mac.update(pattern.as_bytes());
    mac.verify_slice(&hash).is_ok()
}

fn hashed_token(pattern: &str) -> String {
    use rand::RngCore;
    let mut salt = [0u8; 20];
    rand::thread_rng().fill_bytes(&mut salt);
    let mut mac = Hmac::<Sha1>::new_from_slice(&salt).expect("HMAC accepts any key length");
    mac.update(pattern.as_bytes());
    format!("|1|{}|{}", STANDARD.encode(salt), STANDARD.encode(mac.finalize().into_bytes()))
}

/// True when one comma-separated host token names exactly this host:port.
fn token_matches(token: &str, host: &str, port: u16) -> bool {
    let pattern = host_pattern(host, port);
    if token.starts_with("|1|") {
        return hash_matches(token, &pattern);
    }
    let token = token.to_ascii_lowercase();
    token == pattern || (port == 22 && token == format!("[{}]:22", host.to_ascii_lowercase()))
}

fn entry_matches(entry: &Entry<'_>, host: &str, port: u16) -> bool {
    entry.hosts.split(',').any(|t| token_matches(t, host, port))
}

/// Every parsed line with its 1-based number.
fn entries(content: &str) -> impl Iterator<Item = (usize, Entry<'_>)> {
    content
        .split_inclusive('\n')
        .enumerate()
        .filter_map(|(i, line)| parse_entry(split_terminator(line).0).map(|e| (i + 1, e)))
}

fn is_revoked(content: &str, blob: &[u8]) -> bool {
    // Conservative: a revoked key is refused for every host, whatever the line's host field says.
    entries(content).any(|(_, e)| {
        e.marker.is_some_and(|m| m.eq_ignore_ascii_case("@revoked"))
            && decode_blob(e.key_b64).as_deref() == Some(blob)
    })
}

// ---------------------------------------------------------------------------
// Checking

/// Checks the key a server presented against known_hosts content.
pub fn check_host_key(content: &str, host: &str, port: u16, key_type: &str, key_b64: &str) -> HostKeyCheck {
    let server_blob = decode_blob(key_b64);
    if let Some(blob) = &server_blob {
        if is_revoked(content, blob) {
            return HostKeyCheck::Revoked;
        }
    }
    let mut saved = Vec::new();
    for (line_number, entry) in entries(content) {
        if entry.marker.is_some() || !entry_matches(&entry, host, port) {
            continue;
        }
        let blob = decode_blob(entry.key_b64);
        if entry.key_type == key_type && blob.is_some() && blob == server_blob {
            return HostKeyCheck::Trusted;
        }
        saved.push(SavedKey {
            key_type: entry.key_type.to_string(),
            fingerprint: blob.map(|b| fingerprint_of_blob(&b)).unwrap_or_else(|| "invalid key".to_string()),
            line_number,
        });
    }
    if saved.is_empty() {
        HostKeyCheck::Unknown
    } else {
        HostKeyCheck::Changed(saved)
    }
}

/// Key types saved for this host, in file order (to prefer them during key exchange).
pub fn saved_key_types(content: &str, host: &str, port: u16) -> Vec<String> {
    let mut types: Vec<String> = Vec::new();
    for (_, entry) in entries(content) {
        if entry.marker.is_none() && entry_matches(&entry, host, port) && !types.iter().any(|t| t == entry.key_type) {
            types.push(entry.key_type.to_string());
        }
    }
    types
}

// ---------------------------------------------------------------------------
// Replacing

fn validate_host(host: &str, port: u16) -> Result<(), String> {
    let bad = host.is_empty()
        || host.starts_with('@')
        || host
            .chars()
            .any(|c| c.is_whitespace() || c.is_control() || ",[]|*?!#".contains(c));
    if bad {
        return Err(format!("Refused: {host:?} is not a plain host name"));
    }
    if port == 0 {
        return Err("Refused: invalid port 0".to_string());
    }
    Ok(())
}

/// Validates the replacement key and returns its blob.
fn validate_new_key(new_key_type: &str, new_key_b64: &str) -> Result<Vec<u8>, String> {
    if new_key_type.is_empty() || !new_key_type.chars().all(|c| c.is_ascii_graphic()) {
        return Err("Refused: invalid key type".to_string());
    }
    let blob = decode_blob(new_key_b64).ok_or_else(|| "Refused: the new key is not valid base64".to_string())?;
    if blob_key_type(&blob) != Some(new_key_type) {
        return Err(format!("Refused: the new key is not a {new_key_type} key"));
    }
    Ok(blob)
}

/// Replaces this host's saved key whose fingerprint is `expected_old_fingerprint`
/// with the new key, changing nothing else. On a multi-host line only this
/// host's name is removed. Errors leave the content untouched (it is not returned).
pub fn replace_in_content(
    content: &str,
    host: &str,
    port: u16,
    expected_old_fingerprint: &str,
    new_key_type: &str,
    new_key_b64: &str,
) -> Result<Replaced, String> {
    validate_host(host, port)?;
    let new_blob = validate_new_key(new_key_type, new_key_b64)?;
    let new_fingerprint = fingerprint_of_blob(&new_blob);
    if new_fingerprint == expected_old_fingerprint {
        return Err("Refused: the new key is the same as the saved key".to_string());
    }
    if is_revoked(content, &new_blob) {
        return Err("Refused: the server's new key is marked @revoked in known_hosts".to_string());
    }

    let mut out = String::with_capacity(content.len() + new_key_b64.len() + 64);
    let mut replaced_lines = Vec::new();
    let mut removed_hashed = false;
    let mut new_key_already_saved = false;

    for (i, line) in content.split_inclusive('\n').enumerate() {
        let (body, terminator) = split_terminator(line);
        let entry = match parse_entry(body) {
            Some(e) if e.marker.is_none() && entry_matches(&e, host, port) => e,
            _ => {
                out.push_str(line);
                continue;
            }
        };
        let blob = decode_blob(entry.key_b64);
        let is_target = blob.as_deref().map(fingerprint_of_blob).as_deref() == Some(expected_old_fingerprint);
        if !is_target {
            if entry.key_type == new_key_type && blob.as_deref() == Some(new_blob.as_slice()) {
                new_key_already_saved = true;
            }
            out.push_str(line);
            continue;
        }
        replaced_lines.push(i + 1);
        let (matched, kept): (Vec<&str>, Vec<&str>) =
            entry.hosts.split(',').partition(|t| token_matches(t, host, port));
        removed_hashed |= matched.iter().any(|t| t.starts_with("|1|"));
        if kept.is_empty() {
            continue; // the whole line was only this host
        }
        out.push_str(&body[..entry.hosts_start]);
        out.push_str(&kept.join(","));
        out.push_str(&body[entry.hosts_end..]);
        out.push_str(terminator);
    }

    if replaced_lines.is_empty() {
        return Err(format!(
            "The saved key for {} no longer matches the fingerprint you were shown ({expected_old_fingerprint}). \
             known_hosts changed in the meantime, so nothing was replaced. Connect again to review the current key.",
            host_pattern(host, port)
        ));
    }

    if !new_key_already_saved {
        if !out.is_empty() && !out.ends_with('\n') {
            out.push('\n');
        }
        let pattern = host_pattern(host, port);
        let host_field = if removed_hashed { hashed_token(&pattern) } else { pattern };
        out.push_str(&format!("{host_field} {new_key_type} {new_key_b64}\n"));
    }

    Ok(Replaced {
        content: out,
        replaced_lines,
        old_fingerprint: expected_old_fingerprint.to_string(),
        new_fingerprint,
        hashed: removed_hashed,
    })
}

// ---------------------------------------------------------------------------
// Adding and removing (Settings and the trust-on-first-use prompt)

/// Appends `host key_type key` for a first-use trust, after the same checks as a replacement.
/// Adding a key that is already saved for this host changes nothing.
pub fn add_in_content(content: &str, host: &str, port: u16, key_type: &str, key_b64: &str) -> Result<String, String> {
    validate_host(host, port)?;
    let blob = validate_new_key(key_type, key_b64)?;
    if is_revoked(content, &blob) {
        return Err("Refused: this key is marked @revoked in known_hosts".to_string());
    }
    if check_host_key(content, host, port, key_type, key_b64) == HostKeyCheck::Trusted {
        return Ok(content.to_string());
    }
    let mut out = content.to_string();
    if !out.is_empty() && !out.ends_with('\n') {
        out.push('\n');
    }
    out.push_str(&format!("{} {key_type} {key_b64}\n", host_pattern(host, port)));
    Ok(out)
}

/// Drops the host-key lines naming `hostname` (the whole hosts field, or one of
/// its names); comments, marker lines and every other line are kept byte for byte.
pub fn remove_in_content(content: &str, hostname: &str) -> String {
    content
        .split_inclusive('\n')
        .filter(|line| {
            let Some(entry) = parse_entry(split_terminator(line).0) else {
                return true;
            };
            if entry.marker.is_some() {
                return true;
            }
            let named = entry.hosts == hostname
                || entry
                    .hosts
                    .split(',')
                    .any(|h| h == hostname || h.trim_matches(|c| c == '[' || c == ']') == hostname);
            !named
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Atomic file write

#[cfg(test)]
thread_local! {
    static FAIL_NEXT_RENAME: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
}

/// Test hook: the next rename on this thread fails.
#[cfg(test)]
pub(crate) fn fail_next_rename() {
    FAIL_NEXT_RENAME.with(|f| f.set(true));
}

fn rename(from: &Path, to: &Path) -> std::io::Result<()> {
    #[cfg(test)]
    if FAIL_NEXT_RENAME.with(|f| f.replace(false)) {
        return Err(std::io::Error::other("injected rename failure"));
    }
    fs::rename(from, to)
}

/// Removes a temp file unless it was committed by a rename.
struct TempFile {
    path: PathBuf,
    committed: bool,
}

impl Drop for TempFile {
    fn drop(&mut self) {
        if !self.committed {
            let _ = fs::remove_file(&self.path);
        }
    }
}

fn temp_path(dir: &Path, name: &str) -> PathBuf {
    use rand::RngCore;
    dir.join(format!(".{name}.{}-{:016x}.tmp", std::process::id(), rand::thread_rng().next_u64()))
}

/// Writes `bytes` to a new temp file in `dir` and fsyncs it. The file is created
/// 0600 on Unix, then given `permissions` when set.
fn write_temp(dir: &Path, name: &str, bytes: &[u8], permissions: Option<fs::Permissions>) -> Result<TempFile, String> {
    let path = temp_path(dir, name);
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(&path).map_err(|e| format!("Cannot create temp file: {e}"))?;
    let temp = TempFile { path, committed: false };
    file.write_all(bytes).map_err(|e| format!("Cannot write temp file: {e}"))?;
    if let Some(permissions) = permissions {
        fs::set_permissions(&temp.path, permissions).map_err(|e| format!("Cannot set permissions: {e}"))?;
    }
    file.sync_all().map_err(|e| format!("Cannot flush temp file: {e}"))?;
    Ok(temp)
}

/// Renames the temp file over `target`. On failure the temp file is deleted and the target is untouched.
fn commit(mut temp: TempFile, target: &Path) -> Result<(), String> {
    if let Err(e) = rename(&temp.path, target) {
        let _ = fs::remove_file(&temp.path);
        temp.committed = true; // already removed
        return Err(format!("Cannot replace {}: {e}", target.display()));
    }
    temp.committed = true;
    #[cfg(unix)]
    if let Some(dir) = target.parent() {
        // Make the rename itself durable.
        if let Ok(d) = fs::File::open(dir) {
            let _ = d.sync_all();
        }
    }
    Ok(())
}

/// The backup is owner-only (0600) on Unix; elsewhere it copies the original's permissions.
fn backup_permissions(original: Option<&fs::Permissions>) -> Option<fs::Permissions> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = original;
        Some(fs::Permissions::from_mode(0o600))
    }
    #[cfg(not(unix))]
    {
        original.cloned()
    }
}

/// "YYYY-MM-DDTHH:MM:SSZ" for now (UTC).
pub(crate) fn utc_timestamp() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let (days, rem) = (secs.div_euclid(86_400), secs.rem_euclid(86_400));
    // Howard Hinnant's civil_from_days.
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z",
        rem / 3600,
        rem % 3600 / 60,
        rem % 60
    )
}

/// What a rewrite produces: the new content, and a backup comment when the old content is to be backed up.
struct Rewrite<R> {
    content: String,
    backup_header: Option<String>,
    result: R,
}

/// The one way this app writes known_hosts. Under a process-wide lock it reads
/// the file (following a symlink to the real file), lets `transform` compute the
/// new content, optionally saves the old content to `known_hosts.nexterm-bak`
/// (only the latest backup is kept), writes and fsyncs a temp file with the
/// original permissions in the same directory, checks the file did not change
/// meanwhile, and renames the temp file over it.
///
/// A read-only file is refused with an error; its attributes are never changed.
/// A missing file is created owner-only when `create` is set. The rewritten file
/// is owned by the user running the app (a rename cannot keep another owner).
fn rewrite_file<R>(
    path: &Path,
    create: bool,
    transform: impl FnOnce(&str) -> Result<Rewrite<R>, String>,
    before_commit: impl FnOnce(),
) -> Result<R, String> {
    let _guard = WRITE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let exists = fs::symlink_metadata(path).is_ok();
    let (target, original, permissions) = if exists {
        let target = fs::canonicalize(path).map_err(|e| format!("Cannot open {}: {e}", path.display()))?;
        let permissions = fs::metadata(&target).map_err(|e| e.to_string())?.permissions();
        if permissions.readonly() {
            return Err(format!("{} is read-only, so nothing was changed.", target.display()));
        }
        let original = fs::read(&target).map_err(|e| format!("Cannot read {}: {e}", target.display()))?;
        (target, Some(original), Some(permissions))
    } else if create {
        let dir = path.parent().ok_or("known_hosts has no parent directory")?;
        fs::create_dir_all(dir).map_err(|e| format!("Cannot create {}: {e}", dir.display()))?;
        (path.to_path_buf(), None, None)
    } else {
        return Err(format!("{} does not exist", path.display()));
    };

    let content = match &original {
        Some(bytes) => std::str::from_utf8(bytes).map_err(|_| "known_hosts is not valid UTF-8; nothing was changed".to_string())?,
        None => "",
    };
    let rewrite = transform(content)?;
    if original.is_some() && rewrite.content == content {
        return Ok(rewrite.result);
    }

    let dir = target.parent().ok_or("known_hosts has no parent directory")?;
    let name = target.file_name().ok_or("known_hosts has no file name")?.to_string_lossy().to_string();

    if let (Some(header), Some(old)) = (&rewrite.backup_header, &original) {
        let mut backup = format!("{header}\n").into_bytes();
        backup.extend_from_slice(old);
        let backup_temp = write_temp(dir, &name, &backup, backup_permissions(permissions.as_ref()))?;
        commit(backup_temp, &dir.join(format!("{name}{BACKUP_SUFFIX}")))?;
    }

    let temp = write_temp(dir, &name, rewrite.content.as_bytes(), permissions)?;
    before_commit();
    let unchanged = match (&original, fs::read(&target)) {
        (Some(old), Ok(now)) => *old == now,
        (None, Err(e)) => e.kind() == std::io::ErrorKind::NotFound,
        _ => false,
    };
    if !unchanged {
        return Err("known_hosts changed while saving, so nothing was changed. Try again.".to_string());
    }
    commit(temp, &target)?;
    Ok(rewrite.result)
}

/// Replaces the key in the known_hosts file at `path` (see [`replace_in_content`]
/// and the write guarantees of `rewrite_file`). The old content is backed up first.
pub fn replace_file(
    path: &Path,
    host: &str,
    port: u16,
    expected_old_fingerprint: &str,
    new_key_type: &str,
    new_key_b64: &str,
) -> Result<Replaced, String> {
    replace_file_with_hook(path, host, port, expected_old_fingerprint, new_key_type, new_key_b64, || {})
}

/// [`replace_file`] with a hook that runs just before the final change check (tests simulate a concurrent writer).
pub(crate) fn replace_file_with_hook(
    path: &Path,
    host: &str,
    port: u16,
    expected_old_fingerprint: &str,
    new_key_type: &str,
    new_key_b64: &str,
    before_commit: impl FnOnce(),
) -> Result<Replaced, String> {
    if fs::symlink_metadata(path).is_err() {
        return Err(format!("{} does not exist", path.display()));
    }
    rewrite_file(
        path,
        false,
        |content| {
            let replaced = replace_in_content(content, host, port, expected_old_fingerprint, new_key_type, new_key_b64)?;
            // Never write a hashed host name in clear text, not even in a comment.
            let subject = if replaced.hashed { "a hashed host entry".to_string() } else { host_pattern(host, port) };
            Ok(Rewrite {
                content: replaced.content.clone(),
                backup_header: Some(format!(
                    "# nexterm backup of known_hosts taken {} before replacing the key for {subject}",
                    utc_timestamp()
                )),
                result: replaced,
            })
        },
        before_commit,
    )
}

/// Adds a first-use host key (see [`add_in_content`]); creates the file owner-only if it is missing.
pub fn add_file(path: &Path, host: &str, port: u16, key_type: &str, key_b64: &str) -> Result<(), String> {
    rewrite_file(
        path,
        true,
        |content| {
            Ok(Rewrite { content: add_in_content(content, host, port, key_type, key_b64)?, backup_header: None, result: () })
        },
        || {},
    )
}

/// Removes a host's lines (see [`remove_in_content`]). A missing file is left alone.
pub fn remove_host_file(path: &Path, hostname: &str) -> Result<(), String> {
    if fs::symlink_metadata(path).is_err() {
        return Ok(());
    }
    rewrite_file(
        path,
        false,
        |content| Ok(Rewrite { content: remove_in_content(content, hostname), backup_header: None, result: () }),
        || {},
    )
}

/// Empties known_hosts, keeping the old content in the backup. A missing file is left alone.
pub fn clear_file(path: &Path) -> Result<(), String> {
    if fs::symlink_metadata(path).is_err() {
        return Ok(());
    }
    rewrite_file(
        path,
        false,
        |_| {
            Ok(Rewrite {
                content: String::new(),
                backup_header: Some(format!("# nexterm backup of known_hosts taken {} before clearing it", utc_timestamp())),
                result: (),
            })
        },
        || {},
    )
}

#[cfg(test)]
mod tests;
