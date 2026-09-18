//! Writes the embedded shell scripts to `<app_data>/shell-integration/v{N}/`.

use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

/// Bump whenever any script changes, so shells started by an older Nexterm keep
/// reading the files they were started with.
pub const SCRIPT_VERSION: u32 = 1;

/// Script path (relative to the versioned directory) and contents.
pub const SCRIPTS: &[(&str, &str)] = &[
    ("zsh/.zshenv", include_str!("zsh/.zshenv")),
    ("bash/nexterm.bash", include_str!("bash/nexterm.bash")),
    ("fish/nexterm.fish", include_str!("fish/nexterm.fish")),
];

/// Directory the scripts of this version live in.
pub fn versioned_dir(app_data: &Path) -> PathBuf {
    app_data.join("shell-integration").join(format!("v{SCRIPT_VERSION}"))
}

/// Writes every script that is missing or differs. Each file goes to a temp file
/// first and is renamed into place, so a starting shell never reads half a file.
pub fn install(app_data: &Path) -> io::Result<PathBuf> {
    let dir = versioned_dir(app_data);
    for (rel, contents) in SCRIPTS {
        let path = dir.join(rel);
        if fs::read(&path).is_ok_and(|current| current == contents.as_bytes()) {
            continue;
        }
        let parent = path.parent().expect("script paths have a parent");
        fs::create_dir_all(parent)?;
        let mut tmp = tempfile_in(parent)?;
        tmp.1.write_all(contents.as_bytes())?;
        tmp.1.sync_all()?;
        drop(tmp.1);
        if let Err(err) = fs::rename(&tmp.0, &path) {
            let _ = fs::remove_file(&tmp.0);
            return Err(err);
        }
    }
    Ok(dir)
}

/// A new file next to the target, unique to this process and attempt.
fn tempfile_in(dir: &Path) -> io::Result<(PathBuf, fs::File)> {
    for attempt in 0..100u32 {
        let path = dir.join(format!(".nexterm-{}-{attempt}.tmp", std::process::id()));
        match fs::OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(file) => return Ok((path, file)),
            Err(err) if err.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(err) => return Err(err),
        }
    }
    Err(io::Error::new(io::ErrorKind::AlreadyExists, "no free temp file name"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use sha2::{Digest, Sha256};

    /// Changing a script without bumping SCRIPT_VERSION would let two Nexterm
    /// builds overwrite each other's files. Update both together.
    const SCRIPTS_SHA256: &str = "05dfb8c183699ed4bc82c8385a8bc7e39a73698f89f37c4c4550ea0d8a8ed16a";

    #[test]
    fn script_version_is_bumped_with_the_scripts() {
        let mut hasher = Sha256::new();
        for (rel, contents) in SCRIPTS {
            hasher.update(rel.as_bytes());
            hasher.update([0]);
            hasher.update(contents.as_bytes());
            hasher.update([0]);
        }
        let digest: String = hasher.finalize().iter().map(|b| format!("{b:02x}")).collect();
        assert_eq!(
            digest, SCRIPTS_SHA256,
            "the shell scripts changed: bump SCRIPT_VERSION and update SCRIPTS_SHA256"
        );
    }

    #[test]
    fn writes_scripts_into_versioned_dir() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = install(tmp.path()).unwrap();
        assert_eq!(dir, tmp.path().join("shell-integration").join(format!("v{SCRIPT_VERSION}")));
        for (rel, contents) in SCRIPTS {
            assert_eq!(fs::read_to_string(dir.join(rel)).unwrap(), *contents, "{rel}");
        }
    }

    #[test]
    fn install_is_idempotent_and_repairs_changed_files() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = install(tmp.path()).unwrap();
        let (rel, contents) = SCRIPTS[0];
        fs::write(dir.join(rel), "tampered").unwrap();
        assert_eq!(install(tmp.path()).unwrap(), dir);
        assert_eq!(fs::read_to_string(dir.join(rel)).unwrap(), contents);
        install(tmp.path()).unwrap();
        let leftovers: Vec<_> = walk(&dir).into_iter().filter(|p| p.ends_with(".tmp")).collect();
        assert!(leftovers.is_empty(), "{leftovers:?}");
    }

    fn walk(dir: &Path) -> Vec<String> {
        let mut out = Vec::new();
        for entry in fs::read_dir(dir).unwrap().flatten() {
            let path = entry.path();
            if path.is_dir() {
                out.extend(walk(&path));
            } else {
                out.push(path.to_string_lossy().into_owned());
            }
        }
        out
    }

    #[cfg(unix)]
    fn syntax_check(shell: &str, rel: &str) {
        let found = if shell.starts_with('/') {
            Some(PathBuf::from(shell)).filter(|p| p.is_file())
        } else {
            super::super::pty_tests::find_shell(shell)
        };
        let Some(bin) = found else {
            eprintln!("skipping: {shell} not installed");
            return;
        };
        let tmp = tempfile::tempdir().unwrap();
        let dir = install(tmp.path()).unwrap();
        let out = std::process::Command::new(bin).arg("-n").arg(dir.join(rel)).output().unwrap();
        assert!(out.status.success(), "{shell} -n {rel}: {}", String::from_utf8_lossy(&out.stderr));
    }

    #[cfg(unix)]
    #[test]
    fn zsh_script_parses() {
        syntax_check("zsh", "zsh/.zshenv");
    }

    #[cfg(unix)]
    #[test]
    fn bash_script_parses() {
        syntax_check("bash", "bash/nexterm.bash");
        // macOS ships bash 3.2 as /bin/bash.
        syntax_check("/bin/bash", "bash/nexterm.bash");
    }

    #[cfg(unix)]
    #[test]
    fn fish_script_parses() {
        syntax_check("fish", "fish/nexterm.fish");
    }
}
