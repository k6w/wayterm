use super::*;
use std::path::Path;

const OLD_B64: &str = "AAAAC3NzaC1lZDI1NTE5AAAAIEBideruyixQqgBBMvV809wd4ptM2LMIU5Uy2rZb3H+h";
const OLD_FP: &str = "SHA256:ANn8TSkGESlxtfcNBritd0+eASn7b4Qk2d2wkUd9m+8";
const NEW_B64: &str = "AAAAC3NzaC1lZDI1NTE5AAAAICNbsieyVJqvXuKZPxUkHI3LEHkelfGm1+sUEaCQ9gax";
const NEW_FP: &str = "SHA256:LBuyLim8IdHpu2wb2n4XlpdeS449E1PMNZHGyxEusKo";
const OTHER_B64: &str = "AAAAC3NzaC1lZDI1NTE5AAAAIB/cEu9J5cpAf8zr0Ccw5DShchyD9YGg3vWk+QPhhn/u";
const OTHER_FP: &str = "SHA256:I3VmiVIBAV5Fd/GfWuIi1u3YgIueZSSLe9j2TCOTIhk";
const ECDSA_B64: &str = "AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBKgIamot+xkJ3/Yqw68zxq3mgjzWAzdDmZ7T7MfnTonUVUcGN6Jo4cNt6ZV2LKA0maILsIz1P4u70aCpaol2LhU=";
const ED: &str = "ssh-ed25519";

const PLAIN: &str = include_str!("fixtures/plain.known_hosts");
const PORT: &str = include_str!("fixtures/port.known_hosts");
const MULTI: &str = include_str!("fixtures/multi.known_hosts");
const HASHED: &str = include_str!("fixtures/hashed.known_hosts");
const MARKERS: &str = include_str!("fixtures/markers.known_hosts");
const REVOKED_NEW: &str = include_str!("fixtures/revoked-new.known_hosts");

fn replace(content: &str, host: &str, port: u16, expected_old: &str) -> Result<Replaced, String> {
    replace_in_content(content, host, port, expected_old, ED, NEW_B64)
}

fn check_ed(content: &str, host: &str, port: u16, key_b64: &str) -> HostKeyCheck {
    check_host_key(content, host, port, ED, key_b64)
}

/// The lines of `before` that are not in `after`, and the reverse.
fn line_diff(before: &str, after: &str) -> (Vec<String>, Vec<String>) {
    let b: Vec<&str> = before.split_inclusive('\n').collect();
    let a: Vec<&str> = after.split_inclusive('\n').collect();
    let removed = b.iter().filter(|l| !a.contains(l)).map(|l| l.to_string()).collect();
    let added = a.iter().filter(|l| !b.contains(l)).map(|l| l.to_string()).collect();
    (removed, added)
}

// ---------------------------------------------------------------- fingerprints

#[test]
fn fingerprint_matches_ssh_keygen() {
    assert_eq!(fingerprint_sha256(OLD_B64).unwrap(), OLD_FP);
    assert_eq!(fingerprint_sha256(NEW_B64).unwrap(), NEW_FP);
    assert_eq!(fingerprint_sha256(OTHER_B64).unwrap(), OTHER_FP);
    assert_eq!(fingerprint_sha256(ECDSA_B64).unwrap(), "SHA256:zDixxHzsm7GZ3bnHH/OaCRn/VaBcwZmQSgHjwKrZ3Ww");
}

#[test]
fn fingerprint_rejects_invalid_base64() {
    assert!(fingerprint_sha256("not base64!").is_err());
    assert!(fingerprint_sha256("").is_err());
}

// ---------------------------------------------------------------- checking

#[test]
fn check_plain_trusted_changed_unknown() {
    assert_eq!(check_ed(PLAIN, "example.com", 22, OLD_B64), HostKeyCheck::Trusted);
    assert_eq!(check_ed(PLAIN, "EXAMPLE.com", 22, OLD_B64), HostKeyCheck::Trusted);
    match check_ed(PLAIN, "example.com", 22, NEW_B64) {
        HostKeyCheck::Changed(old) => {
            assert_eq!(old.len(), 1);
            assert_eq!(old[0].key_type, ED);
            assert_eq!(old[0].fingerprint, OLD_FP);
            assert_eq!(old[0].line_number, 4);
        }
        other => panic!("expected Changed, got {other:?}"),
    }
    assert_eq!(check_ed(PLAIN, "unknown.example", 22, NEW_B64), HostKeyCheck::Unknown);
}

#[test]
fn check_non_default_port_only_uses_bracketed_entries() {
    assert_eq!(check_ed(PORT, "example.com", 2222, OLD_B64), HostKeyCheck::Trusted);
    assert_eq!(check_ed(PORT, "example.com", 22, OTHER_B64), HostKeyCheck::Trusted);
    // A port-22 entry says nothing about port 2022.
    assert_eq!(check_ed(PORT, "example.com", 2022, OTHER_B64), HostKeyCheck::Unknown);
    assert!(matches!(check_ed(PORT, "example.com", 2222, NEW_B64), HostKeyCheck::Changed(_)));
}

#[test]
fn check_trusts_any_matching_line() {
    let content = format!("example.com ecdsa-sha2-nistp256 {ECDSA_B64}\nexample.com {ED} {OLD_B64}\n");
    assert_eq!(check_ed(&content, "example.com", 22, OLD_B64), HostKeyCheck::Trusted);
}

#[test]
fn check_multi_host_line() {
    assert_eq!(check_ed(MULTI, "192.0.2.10", 22, OLD_B64), HostKeyCheck::Trusted);
    assert!(matches!(check_ed(MULTI, "alias.example.com", 22, NEW_B64), HostKeyCheck::Changed(_)));
}

#[test]
fn check_hashed_entries() {
    assert_eq!(check_ed(HASHED, "example.com", 22, OLD_B64), HostKeyCheck::Trusted);
    assert_eq!(check_ed(HASHED, "example.com", 2222, OLD_B64), HostKeyCheck::Trusted);
    assert_eq!(check_ed(HASHED, "other.org", 22, OTHER_B64), HostKeyCheck::Trusted);
    assert!(matches!(check_ed(HASHED, "example.com", 22, NEW_B64), HostKeyCheck::Changed(_)));
    assert_eq!(check_ed(HASHED, "nothere.example", 22, NEW_B64), HostKeyCheck::Unknown);
}

#[test]
fn check_ignores_cert_authority_and_honours_revoked() {
    // @cert-authority lines are not host keys.
    assert_eq!(check_ed(MARKERS, "www.example.com", 22, OTHER_B64), HostKeyCheck::Unknown);
    assert_eq!(check_ed(MARKERS, "example.com", 22, OLD_B64), HostKeyCheck::Trusted);
    assert_eq!(
        check_host_key(MARKERS, "anything.example", 22, "ecdsa-sha2-nistp256", ECDSA_B64),
        HostKeyCheck::Revoked
    );
    assert_eq!(check_ed(REVOKED_NEW, "example.com", 22, NEW_B64), HostKeyCheck::Revoked);
}

// ---------------------------------------------------------------- replacing (content)

#[test]
fn replace_plain_entry_keeps_every_other_byte() {
    let out = replace(PLAIN, "example.com", 22, OLD_FP).unwrap();
    let (removed, added) = line_diff(PLAIN, &out.content);
    assert_eq!(removed, vec![format!("example.com {ED} {OLD_B64}\n")]);
    assert_eq!(added, vec![format!("example.com {ED} {NEW_B64}\n")]);
    // Comments, blank and whitespace-only lines survive byte for byte, in order.
    let expected = PLAIN.replace(&format!("example.com {ED} {OLD_B64}\n"), "") + &format!("example.com {ED} {NEW_B64}\n");
    assert_eq!(out.content, expected);
    assert_eq!(out.replaced_lines, vec![4]);
    assert_eq!(out.old_fingerprint, OLD_FP);
    assert_eq!(out.new_fingerprint, NEW_FP);
    assert_eq!(check_ed(&out.content, "example.com", 22, NEW_B64), HostKeyCheck::Trusted);
    assert!(matches!(check_ed(&out.content, "example.com", 22, OLD_B64), HostKeyCheck::Changed(_)));
}

#[test]
fn replace_bracketed_port_entry_only() {
    let out = replace(PORT, "example.com", 2222, OLD_FP).unwrap();
    let (removed, added) = line_diff(PORT, &out.content);
    assert_eq!(removed, vec![format!("[example.com]:2222 {ED} {OLD_B64}\n")]);
    assert_eq!(added, vec![format!("[example.com]:2222 {ED} {NEW_B64}\n")]);
    // Port 22 and port 2200 keep their trust.
    assert_eq!(check_ed(&out.content, "example.com", 22, OTHER_B64), HostKeyCheck::Trusted);
    assert_eq!(check_ed(&out.content, "example.com", 2200, OLD_B64), HostKeyCheck::Trusted);
}

#[test]
fn replace_on_multi_host_line_removes_only_this_host() {
    let out = replace(MULTI, "192.0.2.10", 22, OLD_FP).unwrap();
    let (removed, added) = line_diff(MULTI, &out.content);
    assert_eq!(removed.len(), 1);
    assert_eq!(
        added,
        vec![
            format!("example.com,alias.example.com {ED} {OLD_B64} shared entry\n"),
            format!("192.0.2.10 {ED} {NEW_B64}\n"),
        ]
    );
    assert_eq!(check_ed(&out.content, "example.com", 22, OLD_B64), HostKeyCheck::Trusted);
    assert_eq!(check_ed(&out.content, "alias.example.com", 22, OLD_B64), HostKeyCheck::Trusted);
    assert_eq!(check_ed(&out.content, "192.0.2.10", 22, NEW_B64), HostKeyCheck::Trusted);
}

#[test]
fn replace_last_host_of_multi_line() {
    let out = replace(MULTI, "alias.example.com", 22, OLD_FP).unwrap();
    assert!(out.content.starts_with(&format!("example.com,192.0.2.10 {ED} {OLD_B64} shared entry\n")));
}

#[test]
fn replace_hashed_entry_writes_a_hashed_line() {
    let out = replace(HASHED, "example.com", 22, OLD_FP).unwrap();
    let (removed, added) = line_diff(HASHED, &out.content);
    assert_eq!(removed, vec![HASHED.lines().next().unwrap().to_string() + "\n"]);
    assert_eq!(added.len(), 1);
    assert!(added[0].starts_with("|1|"), "new entry stays hashed: {}", added[0]);
    assert!(!out.content.contains("example.com"));
    assert_eq!(check_ed(&out.content, "example.com", 22, NEW_B64), HostKeyCheck::Trusted);
    // The hashed port-2222 entry and other.org are untouched.
    assert_eq!(check_ed(&out.content, "example.com", 2222, OLD_B64), HostKeyCheck::Trusted);
    assert_eq!(check_ed(&out.content, "other.org", 22, OTHER_B64), HostKeyCheck::Trusted);
}

/// Interop: OpenSSH finds our hashed entry (skipped where ssh-keygen is not installed).
#[test]
fn replaced_hashed_entry_is_found_by_ssh_keygen() {
    let dir = tempfile::tempdir().unwrap();
    let path = write_fixture(dir.path(), HASHED, 0o600);
    replace_file(&path, "example.com", 22, OLD_FP, ED, NEW_B64).unwrap();
    let Ok(output) = std::process::Command::new("ssh-keygen")
        .args(["-F", "example.com", "-f"])
        .arg(&path)
        .output()
    else {
        return;
    };
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(output.status.success(), "ssh-keygen -F found nothing: {stdout}");
    assert!(stdout.contains(NEW_B64), "{stdout}");
    assert!(!stdout.contains(OLD_B64), "{stdout}");
}

#[test]
fn replace_never_touches_marker_lines() {
    let out = replace(MARKERS, "example.com", 22, OLD_FP).unwrap();
    let (removed, added) = line_diff(MARKERS, &out.content);
    assert_eq!(removed, vec![format!("example.com {ED} {OLD_B64}\n")]);
    assert_eq!(added, vec![format!("example.com {ED} {NEW_B64}\n")]);
    assert!(out.content.contains(&format!("@cert-authority *.example.com {ED} {OTHER_B64}\n")));
    assert!(out.content.contains(&format!("@revoked * ecdsa-sha2-nistp256 {ECDSA_B64}\n")));
}

#[test]
fn replace_refuses_a_revoked_new_key() {
    let err = replace(REVOKED_NEW, "example.com", 22, OLD_FP).unwrap_err();
    assert!(err.contains("revoked"), "{err}");
}

#[test]
fn replace_refuses_when_old_fingerprint_no_longer_matches() {
    // The file now holds a different key than the one the user was shown.
    let err = replace(PLAIN, "example.com", 22, OTHER_FP).unwrap_err();
    assert!(err.contains("no longer"), "{err}");
    let err = replace(PLAIN, "missing.example", 22, OLD_FP).unwrap_err();
    assert!(err.contains("no longer"), "{err}");
}

#[test]
fn replace_keeps_other_key_types_for_the_host() {
    let content = format!("example.com ecdsa-sha2-nistp256 {ECDSA_B64}\nexample.com {ED} {OLD_B64}\n");
    let out = replace(&content, "example.com", 22, OLD_FP).unwrap();
    assert!(out.content.starts_with(&format!("example.com ecdsa-sha2-nistp256 {ECDSA_B64}\n")));
}

#[test]
fn replace_preserves_crlf_and_missing_final_newline() {
    let content = format!("# hi\r\nexample.com,b.example {ED} {OLD_B64}\r\nother.org {ED} {OTHER_B64}");
    let out = replace(&content, "example.com", 22, OLD_FP).unwrap();
    assert_eq!(
        out.content,
        format!("# hi\r\nb.example {ED} {OLD_B64}\r\nother.org {ED} {OTHER_B64}\nexample.com {ED} {NEW_B64}\n")
    );
}

#[test]
fn replace_validates_inputs() {
    // Key blob type must match the claimed type.
    assert!(replace_in_content(PLAIN, "example.com", 22, OLD_FP, "ssh-rsa", NEW_B64).is_err());
    assert!(replace_in_content(PLAIN, "example.com", 22, OLD_FP, ED, "%%%").is_err());
    assert!(replace_in_content(PLAIN, "example.com", 22, OLD_FP, ED, &format!("{NEW_B64} extra")).is_err());
    for bad_host in ["", "a b", "a,b", "*.example.com", "!x", "[x]:22", "|1|abc", "x\ny"] {
        assert!(replace(PLAIN, bad_host, 22, OLD_FP).is_err(), "{bad_host:?}");
    }
    assert!(replace(PLAIN, "example.com", 0, OLD_FP).is_err());
    // Replacing a key with itself is not a replacement.
    assert!(replace_in_content(PLAIN, "example.com", 22, OLD_FP, ED, OLD_B64).is_err());
}

// ---------------------------------------------------------------- replacing (file)

fn write_fixture(dir: &Path, content: &str, mode: u32) -> std::path::PathBuf {
    let path = dir.join("known_hosts");
    std::fs::write(&path, content).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(mode)).unwrap();
    }
    #[cfg(not(unix))]
    let _ = mode;
    path
}

#[test]
fn replace_file_writes_atomically_with_backup_and_permissions() {
    let dir = tempfile::tempdir().unwrap();
    let path = write_fixture(dir.path(), PLAIN, 0o600);
    let out = replace_file(&path, "example.com", 22, OLD_FP, ED, NEW_B64).unwrap();
    let written = std::fs::read_to_string(&path).unwrap();
    assert_eq!(written, out.content);
    assert_eq!(check_ed(&written, "example.com", 22, NEW_B64), HostKeyCheck::Trusted);

    let backup = std::fs::read_to_string(dir.path().join("known_hosts.nexterm-bak")).unwrap();
    let mut backup_lines = backup.splitn(2, '\n');
    assert!(backup_lines.next().unwrap().starts_with("# nexterm backup of known_hosts taken "));
    assert_eq!(backup_lines.next().unwrap(), PLAIN);

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = |p: &Path| std::fs::metadata(p).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode(&path), 0o600);
        assert_eq!(mode(&dir.path().join("known_hosts.nexterm-bak")), 0o600);
    }
    // No temp files left behind.
    let names: Vec<_> = std::fs::read_dir(dir.path()).unwrap().map(|e| e.unwrap().file_name()).collect();
    assert_eq!(names.len(), 2, "{names:?}");
}

#[cfg(unix)]
#[test]
fn replace_file_preserves_other_permissions() {
    use std::os::unix::fs::PermissionsExt;
    let dir = tempfile::tempdir().unwrap();
    let path = write_fixture(dir.path(), PLAIN, 0o644);
    replace_file(&path, "example.com", 22, OLD_FP, ED, NEW_B64).unwrap();
    assert_eq!(std::fs::metadata(&path).unwrap().permissions().mode() & 0o777, 0o644);
    let bak = dir.path().join("known_hosts.nexterm-bak");
    assert_eq!(std::fs::metadata(bak).unwrap().permissions().mode() & 0o777, 0o600);
}

#[test]
fn replace_file_keeps_only_the_latest_backup() {
    let dir = tempfile::tempdir().unwrap();
    let path = write_fixture(dir.path(), PLAIN, 0o600);
    replace_file(&path, "example.com", 22, OLD_FP, ED, NEW_B64).unwrap();
    let after_first = std::fs::read_to_string(&path).unwrap();
    replace_file(&path, "example.com", 22, NEW_FP, ED, OLD_B64).unwrap();
    let backup = std::fs::read_to_string(dir.path().join("known_hosts.nexterm-bak")).unwrap();
    assert_eq!(backup.split_once('\n').unwrap().1, after_first);
    let count = std::fs::read_dir(dir.path()).unwrap().count();
    assert_eq!(count, 2);
}

#[test]
fn replace_file_refuses_stale_fingerprint_and_leaves_file_untouched() {
    let dir = tempfile::tempdir().unwrap();
    let path = write_fixture(dir.path(), PLAIN, 0o600);
    assert!(replace_file(&path, "example.com", 22, OTHER_FP, ED, NEW_B64).is_err());
    assert_eq!(std::fs::read_to_string(&path).unwrap(), PLAIN);
    assert!(!dir.path().join("known_hosts.nexterm-bak").exists());
}

#[test]
fn replace_file_detects_a_concurrent_write() {
    let dir = tempfile::tempdir().unwrap();
    let path = write_fixture(dir.path(), PLAIN, 0o600);
    let changed = format!("{PLAIN}late.example {ED} {OTHER_B64}\n");
    let err = replace_file_with_hook(&path, "example.com", 22, OLD_FP, ED, NEW_B64, || {
        std::fs::write(&path, &changed).unwrap();
    })
    .unwrap_err();
    assert!(err.contains("changed"), "{err}");
    // The other writer's content wins; nothing of ours was committed.
    assert_eq!(std::fs::read_to_string(&path).unwrap(), changed);
    let count = std::fs::read_dir(dir.path()).unwrap().filter(|e| {
        let name = e.as_ref().unwrap().file_name();
        name.to_string_lossy().contains(".tmp")
    }).count();
    assert_eq!(count, 0);
}

#[cfg(unix)]
#[test]
fn replace_file_follows_a_symlinked_known_hosts() {
    let dir = tempfile::tempdir().unwrap();
    let real_dir = dir.path().join("dotfiles");
    std::fs::create_dir(&real_dir).unwrap();
    let real = write_fixture(&real_dir, PLAIN, 0o600);
    let link = dir.path().join("known_hosts");
    std::os::unix::fs::symlink(&real, &link).unwrap();
    replace_file(&link, "example.com", 22, OLD_FP, ED, NEW_B64).unwrap();
    assert!(std::fs::symlink_metadata(&link).unwrap().file_type().is_symlink());
    let written = std::fs::read_to_string(&real).unwrap();
    assert_eq!(check_ed(&written, "example.com", 22, NEW_B64), HostKeyCheck::Trusted);
}

#[test]
fn replace_file_missing_file_is_an_error() {
    let dir = tempfile::tempdir().unwrap();
    assert!(replace_file(&dir.path().join("known_hosts"), "example.com", 22, OLD_FP, ED, NEW_B64).is_err());
}

fn dir_names(dir: &Path) -> Vec<String> {
    let mut names: Vec<String> =
        std::fs::read_dir(dir).unwrap().map(|e| e.unwrap().file_name().to_string_lossy().to_string()).collect();
    names.sort();
    names
}

#[test]
fn replace_file_refuses_a_read_only_file() {
    let dir = tempfile::tempdir().unwrap();
    let path = write_fixture(dir.path(), PLAIN, 0o444);
    #[cfg(not(unix))]
    {
        let mut p = std::fs::metadata(&path).unwrap().permissions();
        p.set_readonly(true);
        std::fs::set_permissions(&path, p).unwrap();
    }
    let err = replace_file(&path, "example.com", 22, OLD_FP, ED, NEW_B64).unwrap_err();
    assert!(err.contains("read-only"), "{err}");
    assert_eq!(std::fs::read_to_string(&path).unwrap(), PLAIN);
    assert_eq!(dir_names(dir.path()), vec!["known_hosts"]);
    assert!(std::fs::metadata(&path).unwrap().permissions().readonly(), "attributes are not changed");
}

#[test]
fn a_failed_rename_removes_the_temp_file() {
    let dir = tempfile::tempdir().unwrap();
    let path = write_fixture(dir.path(), PLAIN, 0o600);
    let err = replace_file_with_hook(&path, "example.com", 22, OLD_FP, ED, NEW_B64, fail_next_rename).unwrap_err();
    assert!(err.contains("Cannot replace"), "{err}");
    assert_eq!(std::fs::read_to_string(&path).unwrap(), PLAIN);
    assert!(dir_names(dir.path()).iter().all(|n| !n.ends_with(".tmp")), "{:?}", dir_names(dir.path()));
}

#[test]
fn backup_header_does_not_reveal_a_hashed_host() {
    let dir = tempfile::tempdir().unwrap();
    let path = write_fixture(dir.path(), HASHED, 0o600);
    let out = replace_file(&path, "example.com", 22, OLD_FP, ED, NEW_B64).unwrap();
    assert!(out.hashed);
    let backup = std::fs::read_to_string(dir.path().join("known_hosts.nexterm-bak")).unwrap();
    assert!(!backup.contains("example.com"), "{backup}");
    assert!(backup.lines().next().unwrap().contains("hashed host entry"));

    let dir = tempfile::tempdir().unwrap();
    let path = write_fixture(dir.path(), PLAIN, 0o600);
    assert!(!replace_file(&path, "example.com", 22, OLD_FP, ED, NEW_B64).unwrap().hashed);
    let backup = std::fs::read_to_string(dir.path().join("known_hosts.nexterm-bak")).unwrap();
    assert!(backup.lines().next().unwrap().contains("example.com"));
}

// ---------------------------------------------------------------- add / remove / clear

#[test]
fn add_file_creates_a_missing_file_owner_only() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("ssh").join("known_hosts");
    add_file(&path, "Example.com", 2222, ED, NEW_B64).unwrap();
    assert_eq!(std::fs::read_to_string(&path).unwrap(), format!("[example.com]:2222 {ED} {NEW_B64}\n"));
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        assert_eq!(std::fs::metadata(&path).unwrap().permissions().mode() & 0o777, 0o600);
    }
}

#[test]
fn add_file_appends_and_keeps_other_bytes() {
    let dir = tempfile::tempdir().unwrap();
    let content = format!("# c\r\nother.org {ED} {OTHER_B64}");
    let path = write_fixture(dir.path(), &content, 0o600);
    add_file(&path, "example.com", 22, ED, NEW_B64).unwrap();
    assert_eq!(std::fs::read_to_string(&path).unwrap(), format!("{content}\nexample.com {ED} {NEW_B64}\n"));
    // Adding the same key again changes nothing.
    add_file(&path, "example.com", 22, ED, NEW_B64).unwrap();
    assert_eq!(std::fs::read_to_string(&path).unwrap(), format!("{content}\nexample.com {ED} {NEW_B64}\n"));
    assert_eq!(dir_names(dir.path()), vec!["known_hosts"]);
}

#[test]
fn add_file_validates_like_replace() {
    let dir = tempfile::tempdir().unwrap();
    let path = write_fixture(dir.path(), PLAIN, 0o600);
    for bad_host in ["", "a b", "a,b", "*.example.com", "!x", "[x]:22", "|1|abc", "x\ny", "@revoked"] {
        assert!(add_file(&path, bad_host, 22, ED, NEW_B64).is_err(), "{bad_host:?}");
    }
    assert!(add_file(&path, "example.com", 0, ED, NEW_B64).is_err());
    assert!(add_file(&path, "example.com", 22, "ssh-rsa", NEW_B64).is_err());
    assert!(add_file(&path, "example.com", 22, ED, "%%%").is_err());
    assert!(add_file(&path, "example.com", 22, ED, &format!("{NEW_B64}\nevil.example {ED} {OTHER_B64}")).is_err());
    assert!(add_file(&path, "example.com", 22, "ssh-ed25519 x", NEW_B64).is_err());
    assert_eq!(std::fs::read_to_string(&path).unwrap(), PLAIN);
}

#[test]
fn add_file_refuses_a_revoked_key() {
    let dir = tempfile::tempdir().unwrap();
    let path = write_fixture(dir.path(), REVOKED_NEW, 0o600);
    assert!(add_file(&path, "new.example", 22, ED, NEW_B64).unwrap_err().contains("revoked"));
    assert_eq!(std::fs::read_to_string(&path).unwrap(), REVOKED_NEW);
}

#[test]
fn remove_host_file_removes_only_that_hosts_lines() {
    let dir = tempfile::tempdir().unwrap();
    let content = format!(
        "# keep\r\nexample.com {ED} {OLD_B64}\r\n[example.com]:2222 {ED} {OLD_B64}\nother.org {ED} {OTHER_B64}\n@revoked example.com {ED} {NEW_B64}\n"
    );
    let path = write_fixture(dir.path(), &content, 0o600);
    remove_host_file(&path, "example.com").unwrap();
    assert_eq!(
        std::fs::read_to_string(&path).unwrap(),
        format!("# keep\r\n[example.com]:2222 {ED} {OLD_B64}\nother.org {ED} {OTHER_B64}\n@revoked example.com {ED} {NEW_B64}\n")
    );
    remove_host_file(&path, "[example.com]:2222").unwrap();
    assert_eq!(
        std::fs::read_to_string(&path).unwrap(),
        format!("# keep\r\nother.org {ED} {OTHER_B64}\n@revoked example.com {ED} {NEW_B64}\n")
    );
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        assert_eq!(std::fs::metadata(&path).unwrap().permissions().mode() & 0o777, 0o600);
    }
}

#[test]
fn remove_host_file_matches_a_whole_hosts_field() {
    let dir = tempfile::tempdir().unwrap();
    let path = write_fixture(dir.path(), MULTI, 0o600);
    remove_host_file(&path, "example.com,192.0.2.10,alias.example.com").unwrap();
    assert_eq!(std::fs::read_to_string(&path).unwrap(), format!("other.org {ED} {OTHER_B64}\n"));
}

#[test]
fn remove_and_clear_on_a_missing_file_do_nothing() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("known_hosts");
    remove_host_file(&path, "example.com").unwrap();
    clear_file(&path).unwrap();
    assert!(dir_names(dir.path()).is_empty());
}

#[test]
fn clear_file_empties_atomically_and_keeps_a_backup() {
    let dir = tempfile::tempdir().unwrap();
    let path = write_fixture(dir.path(), PLAIN, 0o600);
    clear_file(&path).unwrap();
    assert_eq!(std::fs::read_to_string(&path).unwrap(), "");
    let backup = std::fs::read_to_string(dir.path().join("known_hosts.nexterm-bak")).unwrap();
    assert_eq!(backup.split_once('\n').unwrap().1, PLAIN);
}

// ---------------------------------------------------------------- mismatch payload

#[test]
fn mismatch_error_round_trips() {
    let mismatch = HostKeyMismatch {
        host: "example.com".into(),
        port: 22,
        known_hosts_path: "/home/u/.ssh/known_hosts".into(),
        old_keys: vec![SavedKey { key_type: ED.into(), fingerprint: OLD_FP.into(), line_number: 4 }],
        new_key_type: ED.into(),
        new_fingerprint: NEW_FP.into(),
        new_key_b64: NEW_B64.into(),
    };
    let msg = mismatch.to_error();
    assert!(msg.starts_with("HOST KEY CHANGED for example.com:22!"));
    let json = msg.split_once(MISMATCH_MARKER).unwrap().1;
    let value: serde_json::Value = serde_json::from_str(json).unwrap();
    assert_eq!(value["newFingerprint"], NEW_FP);
    assert_eq!(value["newKeyB64"], NEW_B64);
    assert_eq!(value["oldKeys"][0]["fingerprint"], OLD_FP);
    assert_eq!(value["oldKeys"][0]["lineNumber"], 4);
    assert_eq!(value["knownHostsPath"], "/home/u/.ssh/known_hosts");
}

#[test]
fn preferred_host_key_types_put_saved_types_first() {
    let content = format!("example.com ecdsa-sha2-nistp256 {ECDSA_B64}\n");
    let types = saved_key_types(&content, "example.com", 22);
    assert_eq!(types, vec!["ecdsa-sha2-nistp256".to_string()]);
    assert!(saved_key_types(HASHED, "example.com", 22).contains(&ED.to_string()));
    assert!(saved_key_types(MARKERS, "www.example.com", 22).is_empty());
}
