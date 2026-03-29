use std::process::Command;

/// Get the current Git branch for a given directory
#[tauri::command]
pub async fn git_get_branch(path: String) -> Result<Option<String>, String> {
    let output = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&path)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let branch = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if branch.is_empty() {
            Ok(None)
        } else {
            Ok(Some(branch))
        }
    } else {
        Ok(None)
    }
}

/// Check if the working directory has uncommitted changes
#[tauri::command]
pub async fn git_is_dirty(path: String) -> Result<bool, String> {
    let output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&path)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
    let status = String::from_utf8_lossy(&output.stdout);
    let trimmed = status.trim();
    Ok(!trimmed.is_empty())
    } else {
        Ok(false)
    }
}