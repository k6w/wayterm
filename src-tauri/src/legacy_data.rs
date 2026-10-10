//! One-time copy of the data folder the app used before it was renamed from
//! Nexterm to Wayterm (bundle identifier `com.nexterm.terminal`).
//!
//! The old folder is only read, never changed or deleted.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use crate::db::DB_FILE;

/// Bundle identifier, and so data folder name, before the rename.
const LEGACY_IDENTIFIER: &str = "com.nexterm.terminal";
/// Database file name before the rename (plus its `-wal` / `-shm` siblings).
const LEGACY_DB_FILE: &str = "nexterm.db";
/// Top-level entries that are not copied: the app rewrites them on start.
const SKIPPED: &[&str] = &["shell-integration"];

/// The pre-rename data folder: a sibling of the current one.
pub fn legacy_dir(app_data: &Path) -> Option<PathBuf> {
    app_data.parent().map(|parent| parent.join(LEGACY_IDENTIFIER))
}

/// Runs [`migrate`] for the real data folders and logs the outcome.
pub fn migrate_on_startup(app_data: &Path) {
    let Some(legacy) = legacy_dir(app_data) else { return };
    match migrate(app_data, &legacy) {
        Ok(true) => eprintln!("copied data from {} to {}", legacy.display(), app_data.display()),
        Ok(false) => {}
        Err(err) => eprintln!("could not copy data from {}: {err}", legacy.display()),
    }
}

/// Copies `legacy` into `app_data` when `app_data` has no database yet and
/// `legacy` exists. The database is renamed on the way (`nexterm.db*` to
/// `wayterm.db*`) and written last, under a temporary name, so an interrupted
/// copy is retried on the next start. Existing files in `app_data` are kept.
/// Returns whether a copy happened.
pub fn migrate(app_data: &Path, legacy: &Path) -> io::Result<bool> {
    if app_data.join(DB_FILE).exists() || !legacy.is_dir() {
        return Ok(false);
    }
    fs::create_dir_all(app_data)?;

    let mut entries: Vec<fs::DirEntry> = fs::read_dir(legacy)?.collect::<io::Result<_>>()?;
    // The main database goes last: its presence marks the migration as done.
    entries.sort_by_key(|e| e.file_name() == LEGACY_DB_FILE);
    for entry in entries {
        let name = entry.file_name().to_string_lossy().into_owned();
        if SKIPPED.contains(&name.as_str()) {
            continue;
        }
        let dest = app_data.join(renamed(&name));
        if entry.file_type()?.is_dir() {
            copy_dir(&entry.path(), &dest)?;
        } else if name == LEGACY_DB_FILE {
            let tmp = app_data.join(format!("{DB_FILE}.migrating"));
            fs::copy(entry.path(), &tmp)?;
            fs::rename(&tmp, &dest)?;
        } else {
            copy_file(&entry.path(), &dest)?;
        }
    }
    Ok(true)
}

/// `nexterm.db`, `nexterm.db-wal`, `nexterm.db-shm` get the new database name.
fn renamed(name: &str) -> String {
    match name.strip_prefix(LEGACY_DB_FILE) {
        Some(rest) => format!("{DB_FILE}{rest}"),
        None => name.to_string(),
    }
}

fn copy_file(from: &Path, to: &Path) -> io::Result<()> {
    if !to.exists() {
        fs::copy(from, to)?;
    }
    Ok(())
}

fn copy_dir(from: &Path, to: &Path) -> io::Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let dest = to.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir(&entry.path(), &dest)?;
        } else {
            copy_file(&entry.path(), &dest)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write(path: &Path, contents: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, contents).unwrap();
    }

    fn read(path: &Path) -> String {
        fs::read_to_string(path).unwrap()
    }

    /// `<root>/com.wayterm.terminal` and `<root>/com.nexterm.terminal`.
    fn dirs(root: &Path) -> (PathBuf, PathBuf) {
        let new = root.join("com.wayterm.terminal");
        let old = legacy_dir(&new).unwrap();
        (new, old)
    }

    #[test]
    fn legacy_dir_is_the_old_identifier_next_to_the_new_one() {
        let new = Path::new("/data/com.wayterm.terminal");
        assert_eq!(legacy_dir(new).unwrap(), Path::new("/data/com.nexterm.terminal"));
    }

    #[test]
    fn copies_the_old_folder_and_renames_the_database() {
        let root = tempfile::tempdir().unwrap();
        let (new, old) = dirs(root.path());
        write(&old.join("nexterm.db"), "db");
        write(&old.join("nexterm.db-wal"), "wal");
        write(&old.join("themes/custom.json"), "theme");
        write(&old.join("shell-integration/v2/zsh/.zshenv"), "old script");

        assert!(migrate(&new, &old).unwrap());

        assert_eq!(read(&new.join("wayterm.db")), "db");
        assert_eq!(read(&new.join("wayterm.db-wal")), "wal");
        assert_eq!(read(&new.join("themes/custom.json")), "theme");
        assert!(!new.join("shell-integration").exists());
        assert!(!new.join("nexterm.db").exists());
        assert!(!new.join("wayterm.db.migrating").exists());
        // The old folder is left alone.
        assert_eq!(read(&old.join("nexterm.db")), "db");
        assert_eq!(read(&old.join("shell-integration/v2/zsh/.zshenv")), "old script");
    }

    #[test]
    fn does_nothing_once_the_new_database_exists() {
        let root = tempfile::tempdir().unwrap();
        let (new, old) = dirs(root.path());
        write(&old.join("nexterm.db"), "old");
        write(&old.join("extra.txt"), "x");
        write(&new.join("wayterm.db"), "new");

        assert!(!migrate(&new, &old).unwrap());
        assert_eq!(read(&new.join("wayterm.db")), "new");
        assert!(!new.join("extra.txt").exists());
    }

    #[test]
    fn does_nothing_without_an_old_folder() {
        let root = tempfile::tempdir().unwrap();
        let (new, old) = dirs(root.path());
        assert!(!migrate(&new, &old).unwrap());
        assert!(!new.exists());
    }

    #[test]
    fn a_retry_keeps_files_already_copied() {
        let root = tempfile::tempdir().unwrap();
        let (new, old) = dirs(root.path());
        write(&old.join("nexterm.db"), "db");
        write(&old.join("notes.txt"), "old");
        // An earlier run was interrupted after this file, before the database.
        write(&new.join("notes.txt"), "kept");

        assert!(migrate(&new, &old).unwrap());
        assert_eq!(read(&new.join("notes.txt")), "kept");
        assert_eq!(read(&new.join("wayterm.db")), "db");
    }
}
