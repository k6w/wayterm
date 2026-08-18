use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;
use crate::db::{DbPool, connections};
use tauri::State;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Categorize one `git status --porcelain` entry line (e.g. " M src/foo.rs")
/// into the appropriate bucket. Header lines (starting with `##`) are handled
/// by the caller. Porcelain v1 format is "XY <path>" where X is the index
/// (staged) status and Y is the worktree status.
fn categorize_status_line(
    line: &str,
    staged: &mut Vec<String>,
    modified: &mut Vec<String>,
    added: &mut Vec<String>,
    deleted: &mut Vec<String>,
    untracked: &mut Vec<String>,
    conflicted: &mut i32,
) {
    if line.len() < 4 {
        return;
    }
    let bytes = line.as_bytes();
    let x = bytes[0] as char;
    let y = bytes[1] as char;
    let path = line[3..].to_string();

    match (x, y) {
        ('?', '?') => untracked.push(path),
        ('U', _) | (_, 'U') | ('A', 'A') | ('D', 'D') => *conflicted += 1,
        _ => {
            if x != ' ' && x != '?' {
                staged.push(path.clone());
            }
            match y {
                'D' => deleted.push(path),
                'A' => added.push(path),
                'M' | 'T' | 'R' | 'C' => modified.push(path),
                _ => {}
            }
        }
    }
}

/// The index status letter and path of a staged porcelain entry, if any.
fn staged_code(line: &str) -> Option<(String, String)> {
    if line.len() < 4 {
        return None;
    }
    let x = line.as_bytes()[0] as char;
    let y = line.as_bytes()[1] as char;
    if matches!(x, ' ' | '?' | 'U') || y == 'U' || (x, y) == ('A', 'A') || (x, y) == ('D', 'D') {
        return None;
    }
    Some((line[3..].to_string(), x.to_string()))
}

fn configure_silent_command(cmd: &mut Command) -> &mut Command {
    cmd.stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    
    cmd
}

async fn execute_ssh_git_command(pool: &DbPool, connection_id: &str, command: &str, cwd: &str) -> Result<String, String> {
    let conn = connections::get(pool, connection_id)?
        .ok_or_else(|| "Connection not found".to_string())?;
    
    let mut ssh_cmd = Command::new("ssh");
    configure_silent_command(&mut ssh_cmd);
    ssh_cmd.arg("-p").arg(conn.port.to_string());
    ssh_cmd.arg("-o").arg("StrictHostKeyChecking=accept-new");
    
    if conn.auth_method == "key" {
        if let Some(key_id) = conn.private_key_id.as_deref() {
            let key_path = write_temp_key(pool, key_id)?;
            ssh_cmd.arg("-i").arg(key_path);
        }
    }
    
    let full_command = format!("cd {} && {}", cwd, command);
    ssh_cmd.arg(format!("{}@{}", conn.username, conn.host));
    ssh_cmd.arg(full_command);
    
    let output = ssh_cmd.output()
        .map_err(|e| format!("Failed to execute SSH command: {}", e))?;
    
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn write_temp_key(pool: &DbPool, key_id: &str) -> Result<String, String> {
    let raw = crate::db::keys::get_private_key(pool, key_id)?;
    let raw_str = String::from_utf8(raw).map_err(|e| format!("Key is not valid UTF-8: {}", e))?;
    let normalized = raw_str.replace("\r\n", "\n").replace('\r', "\n");
    let content = if normalized.ends_with('\n') {
        normalized
    } else {
        format!("{}\n", normalized)
    };
    let path = std::env::temp_dir().join(format!("nexterm_key_{}", key_id));
    std::fs::write(&path, content.as_bytes()).map_err(|e| e.to_string())?;
    
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600)).map_err(|e| e.to_string())?;
    }
    
    Ok(path.to_string_lossy().to_string())
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub branch: String,
    pub ahead: i32,
    pub behind: i32,
    // File lists (real paths, not counts) so the panel can render and stage them.
    pub staged: Vec<String>,
    pub modified: Vec<String>,
    pub added: Vec<String>,
    pub deleted: Vec<String>,
    pub untracked: Vec<String>,
    pub conflicted: i32,
    pub stashes: i32,
    /// Index status letter (A/M/D/R/C/T) for each staged path.
    pub staged_codes: std::collections::HashMap<String, String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitBranch {
    pub name: String,
    pub current: bool,
    pub remote: bool,
    pub upstream: Option<String>,
    pub last_commit: Option<String>,
    pub last_commit_date: Option<i64>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitCommit {
    pub hash: String,
    pub short_hash: String,
    pub author: String,
    pub email: String,
    pub date: i64,
    pub message: String,
    pub files: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitRemote {
    pub name: String,
    pub url: String,
    pub fetch: String,
    pub push: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitDiff {
    pub file: String,
    pub additions: i32,
    pub deletions: i32,
    pub changes: String,
}

#[tauri::command]
pub async fn git_get_branch(path: String) -> Result<Option<String>, String> {
    let output = configure_silent_command(Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&path))
        .output()
        .map_err(|e| format!("Failed to execute git: {}", e))?;

    if !output.status.success() {
        return Ok(None);
    }

    let branch = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(Some(branch))
}

#[tauri::command]
pub async fn git_is_dirty(path: String) -> Result<bool, String> {
    let output = configure_silent_command(Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&path))
        .output()
        .map_err(|e| format!("Failed to execute git: {}", e))?;

    if !output.status.success() {
        return Ok(false);
    }

    Ok(!output.stdout.is_empty())
}

#[tauri::command]
pub async fn git_get_status(path: String, connection_id: Option<String>, pool: State<'_, DbPool>) -> Result<GitStatus, String> {
    if let Some(conn_id) = connection_id {
        return git_get_status_ssh(&pool, &conn_id, &path).await;
    }

    if !Path::new(&path).join(".git").exists() {
        return Err("Not a git repository".to_string());
    }

    let branch = git_get_branch(path.clone()).await?.unwrap_or_else(|| "HEAD".to_string());

    let status_output = configure_silent_command(Command::new("git")
        .args(["status", "--porcelain", "--branch"])
        .current_dir(&path))
        .output()
        .map_err(|e| format!("Failed to get status: {}", e))?;

    let status_str = String::from_utf8_lossy(&status_output.stdout);
    let mut staged: Vec<String> = Vec::new();
    let mut modified: Vec<String> = Vec::new();
    let mut added: Vec<String> = Vec::new();
    let mut deleted: Vec<String> = Vec::new();
    let mut untracked: Vec<String> = Vec::new();
    let mut conflicted = 0;
    let mut staged_codes = std::collections::HashMap::new();
    let mut ahead = 0;
    let mut behind = 0;

    for line in status_str.lines() {
        if line.starts_with("##") {
            if let Some(tracking) = line.split('[').nth(1) {
                if tracking.contains("ahead") {
                    if let Some(num) = tracking.split("ahead ").nth(1) {
                        ahead = num.split(']').next().unwrap_or("0").parse().unwrap_or(0);
                    }
                }
                if tracking.contains("behind") {
                    if let Some(num) = tracking.split("behind ").nth(1) {
                        behind = num.split(']').next().unwrap_or("0").parse().unwrap_or(0);
                    }
                }
            }
            continue;
        }

        if let Some((p, code)) = staged_code(line) {
            staged_codes.insert(p, code);
        }
        categorize_status_line(
            line,
            &mut staged,
            &mut modified,
            &mut added,
            &mut deleted,
            &mut untracked,
            &mut conflicted,
        );
    }

    let stash_output = configure_silent_command(Command::new("git")
        .args(["stash", "list"])
        .current_dir(&path))
        .output()
        .map_err(|e| format!("Failed to get stashes: {}", e))?;

    let stashes = String::from_utf8_lossy(&stash_output.stdout).lines().count() as i32;

    Ok(GitStatus {
        branch,
        ahead,
        behind,
        staged,
        modified,
        added,
        deleted,
        untracked,
        conflicted,
        stashes,
        staged_codes,
    })
}

#[tauri::command]
pub async fn git_get_branches(path: String, connection_id: Option<String>, pool: State<'_, DbPool>) -> Result<Vec<GitBranch>, String> {
    if let Some(conn_id) = connection_id {
        return git_get_branches_ssh(&pool, &conn_id, &path).await;
    }

    if !Path::new(&path).join(".git").exists() {
        return Err("Not a git repository".to_string());
    }

    let output = configure_silent_command(Command::new("git")
        .args(["branch", "-vv", "--all"])
        .current_dir(&path))
        .output()
        .map_err(|e| format!("Failed to get branches: {}", e))?;

    if !output.status.success() {
        return Err(format!("Failed to get branches: {}", String::from_utf8_lossy(&output.stderr).trim()));
    }

    let mut branches = Vec::new();
    let output_str = String::from_utf8_lossy(&output.stdout);

    for line in output_str.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let current = line.starts_with('*');
        let line = if current { &line[2..] } else { line };
        let parts: Vec<&str> = line.split_whitespace().collect();

        if parts.is_empty() {
            continue;
        }

        let name = parts[0].to_string();
        let remote = name.starts_with("remotes/");

        branches.push(GitBranch {
            name,
            current,
            remote,
            upstream: None,
            last_commit: None,
            last_commit_date: None,
        });
    }

    Ok(branches)
}

#[tauri::command]
pub async fn git_get_commits(path: String, limit: i32, connection_id: Option<String>, pool: State<'_, DbPool>) -> Result<Vec<GitCommit>, String> {
    if let Some(conn_id) = connection_id {
        return git_get_commits_ssh(&pool, &conn_id, &path, limit).await;
    }

    if !Path::new(&path).join(".git").exists() {
        return Err("Not a git repository".to_string());
    }

    let output = configure_silent_command(Command::new("git")
        .args([
            "log",
            &format!("-{}", limit),
            "--pretty=format:%H|%h|%an|%ae|%at|%s",
            "--name-only",
        ])
        .current_dir(&path))
        .output()
        .map_err(|e| format!("Failed to get commits: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stderr = stderr.trim();
        // A brand-new repo with no commits yet exits non-zero but isn't an error
        // worth surfacing — treat it as an empty history.
        if stderr.contains("does not have any commits yet")
            || stderr.contains("bad default revision")
            || stderr.contains("unknown revision")
        {
            return Ok(Vec::new());
        }
        return Err(format!("Failed to get commits: {}", stderr));
    }

    let mut commits = Vec::new();
    let output_str = String::from_utf8_lossy(&output.stdout);
    let mut current_commit: Option<GitCommit> = None;
    let mut files = Vec::new();

    for line in output_str.lines() {
        if line.contains('|') {
            if let Some(mut commit) = current_commit.take() {
                commit.files = files.clone();
                commits.push(commit);
                files.clear();
            }

            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() >= 6 {
                current_commit = Some(GitCommit {
                    hash: parts[0].to_string(),
                    short_hash: parts[1].to_string(),
                    author: parts[2].to_string(),
                    email: parts[3].to_string(),
                    date: parts[4].parse().unwrap_or(0),
                    message: parts[5].to_string(),
                    files: Vec::new(),
                });
            }
        } else if !line.is_empty() {
            files.push(line.to_string());
        }
    }

    if let Some(mut commit) = current_commit {
        commit.files = files;
        commits.push(commit);
    }

    Ok(commits)
}

#[tauri::command]
pub async fn git_get_remotes(path: String) -> Result<Vec<GitRemote>, String> {
    let output = configure_silent_command(Command::new("git")
        .args(["remote", "-v"])
        .current_dir(&path))
        .output()
        .map_err(|e| format!("Failed to get remotes: {}", e))?;

    if !output.status.success() {
        return Err("Failed to get remotes".to_string());
    }

    let mut remotes = Vec::new();
    let output_str = String::from_utf8_lossy(&output.stdout);

    for line in output_str.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3 {
            let name = parts[0].to_string();
            let url = parts[1].to_string();
            let op_type = parts[2].trim_matches(|c| c == '(' || c == ')');

            if op_type == "fetch" {
                remotes.push(GitRemote {
                    name: name.clone(),
                    url: url.clone(),
                    fetch: url.clone(),
                    push: String::new(),
                });
            } else if op_type == "push" {
                if let Some(remote) = remotes.iter_mut().find(|r| r.name == name) {
                    remote.push = url;
                }
            }
        }
    }

    Ok(remotes)
}

/// Run git with `args` in `path` and return stdout. `ok_codes` lists non-zero
/// exit codes that still count as success (`diff --no-index` exits 1 on a diff).
fn run_git(path: &str, args: &[&str], ok_codes: &[i32]) -> Result<String, String> {
    let output = configure_silent_command(Command::new("git").args(args).current_dir(path))
        .output()
        .map_err(|e| format!("Failed to execute git: {}", e))?;
    let code = output.status.code().unwrap_or(-1);
    if !output.status.success() && !ok_codes.contains(&code) {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Split a multi-file unified diff into one `GitDiff` per `diff --git` section.
fn parse_unified_diff(text: &str) -> Vec<GitDiff> {
    let mut diffs: Vec<GitDiff> = Vec::new();
    let mut in_hunk = false;
    for line in text.lines() {
        if let Some(rest) = line.strip_prefix("diff --git ") {
            in_hunk = false;
            // "a/<path> b/<path>": the b/ side is the current name.
            let file = rest.rsplit_once(" b/").map(|(_, f)| f).unwrap_or(rest).to_string();
            diffs.push(GitDiff { file, additions: 0, deletions: 0, changes: String::new() });
        }
        if let Some(d) = diffs.last_mut() {
            in_hunk |= line.starts_with("@@");
            if in_hunk {
                if line.starts_with('+') && !line.starts_with("+++") {
                    d.additions += 1;
                } else if line.starts_with('-') && !line.starts_with("---") {
                    d.deletions += 1;
                }
            }
            d.changes.push_str(line);
            d.changes.push('\n');
        }
    }
    diffs
}

fn is_untracked(path: &str, file: &str) -> bool {
    run_git(path, &["ls-files", "--others", "--exclude-standard", "--", file], &[])
        .map(|out| !out.trim().is_empty())
        .unwrap_or(false)
}

/// Unified diffs for `file` (or every changed file). `staged` diffs the index
/// against HEAD; otherwise the worktree against the index. An untracked file is
/// shown as entirely added.
fn collect_diff(path: &str, file: Option<&str>, staged: bool) -> Result<Vec<GitDiff>, String> {
    let mut args = vec!["diff", "--no-color", "--no-ext-diff"];
    if staged {
        args.push("--cached");
    }
    if let Some(f) = file {
        args.push("--");
        args.push(f);
    }
    let mut diffs = parse_unified_diff(&run_git(path, &args, &[])?);

    if !staged {
        if let Some(f) = file {
            if diffs.is_empty() && is_untracked(path, f) {
                let text = run_git(
                    path,
                    &["diff", "--no-color", "--no-index", "--", "/dev/null", f],
                    &[1],
                )?;
                diffs = parse_unified_diff(&text);
                for d in &mut diffs {
                    d.file = f.to_string();
                }
            }
        }
    }
    Ok(diffs)
}

#[tauri::command]
pub async fn git_get_diff(path: String, file: Option<String>, staged: Option<bool>) -> Result<Vec<GitDiff>, String> {
    collect_diff(&path, file.as_deref(), staged.unwrap_or(false))
}

#[tauri::command]
pub async fn git_init(path: String) -> Result<(), String> {
    let output = configure_silent_command(Command::new("git")
        .args(["init"])
        .current_dir(&path))
        .output()
        .map_err(|e| format!("Failed to run git init: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git init failed: {}", error.trim()));
    }

    Ok(())
}

#[tauri::command]
pub async fn git_checkout(path: String, branch: String) -> Result<(), String> {
    let output = configure_silent_command(Command::new("git")
        .args(["checkout", &branch])
        .current_dir(&path))
        .output()
        .map_err(|e| format!("Failed to checkout: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Checkout failed: {}", error));
    }

    Ok(())
}

#[tauri::command]
pub async fn git_pull(path: String) -> Result<(), String> {
    let output = configure_silent_command(Command::new("git")
        .args(["pull"])
        .current_dir(&path))
        .output()
        .map_err(|e| format!("Failed to pull: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Pull failed: {}", error));
    }

    Ok(())
}

#[tauri::command]
pub async fn git_push(path: String) -> Result<(), String> {
    let output = configure_silent_command(Command::new("git")
        .args(["push"])
        .current_dir(&path))
        .output()
        .map_err(|e| format!("Failed to push: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Push failed: {}", error));
    }

    Ok(())
}

#[tauri::command]
pub async fn git_commit(path: String, message: String) -> Result<(), String> {
    let output = configure_silent_command(Command::new("git")
        .args(["commit", "-m", &message])
        .current_dir(&path))
        .output()
        .map_err(|e| format!("Failed to commit: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Commit failed: {}", error));
    }

    Ok(())
}

#[tauri::command]
pub async fn git_stage(path: String, files: Vec<String>) -> Result<(), String> {
    let mut args = vec!["add"];
    for file in &files {
        args.push(file);
    }

    let output = configure_silent_command(Command::new("git")
        .args(&args)
        .current_dir(&path))
        .output()
        .map_err(|e| format!("Failed to stage: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Stage failed: {}", error));
    }

    Ok(())
}

#[tauri::command]
pub async fn git_unstage(path: String, files: Vec<String>) -> Result<(), String> {
    let mut args = vec!["reset", "HEAD"];
    for file in &files {
        args.push(file);
    }

    let output = configure_silent_command(Command::new("git")
        .args(&args)
        .current_dir(&path))
        .output()
        .map_err(|e| format!("Failed to unstage: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Unstage failed: {}", error));
    }

    Ok(())
}

#[tauri::command]
pub async fn git_stash(path: String, message: Option<String>) -> Result<(), String> {
    let output = if let Some(msg) = message {
        configure_silent_command(Command::new("git")
            .args(["stash", "push", "-m", &msg])
            .current_dir(&path))
            .output()
            .map_err(|e| format!("Failed to stash: {}", e))?
    } else {
        configure_silent_command(Command::new("git")
            .args(["stash", "push"])
            .current_dir(&path))
            .output()
            .map_err(|e| format!("Failed to stash: {}", e))?
    };

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Stash failed: {}", error));
    }

    Ok(())
}

#[tauri::command]
pub async fn git_stash_pop(path: String) -> Result<(), String> {
    let output = configure_silent_command(Command::new("git")
        .args(["stash", "pop"])
        .current_dir(&path))
        .output()
        .map_err(|e| format!("Failed to pop stash: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Stash pop failed: {}", error));
    }

    Ok(())
}

async fn git_get_status_ssh(pool: &DbPool, connection_id: &str, path: &str) -> Result<GitStatus, String> {
    let output = execute_ssh_git_command(pool, connection_id, "git status --porcelain --branch && echo '---' && git stash list", path).await?;

    let mut staged: Vec<String> = Vec::new();
    let mut modified: Vec<String> = Vec::new();
    let mut added: Vec<String> = Vec::new();
    let mut deleted: Vec<String> = Vec::new();
    let mut untracked: Vec<String> = Vec::new();
    let mut conflicted = 0;
    let mut staged_codes = std::collections::HashMap::new();
    let mut ahead = 0;
    let mut behind = 0;
    let mut branch = String::from("main");
    let mut stashes = 0;
    let mut in_stash_section = false;

    for line in output.lines() {
        if line == "---" {
            in_stash_section = true;
            continue;
        }

        if in_stash_section {
            stashes += 1;
            continue;
        }

        if line.starts_with("##") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() > 1 {
                branch = parts[1].split("...").next().unwrap_or("main").to_string();
            }
            if let Some(tracking) = line.split('[').nth(1) {
                if tracking.contains("ahead") {
                    if let Some(num) = tracking.split("ahead ").nth(1) {
                        ahead = num.split(']').next().unwrap_or("0").parse().unwrap_or(0);
                    }
                }
                if tracking.contains("behind") {
                    if let Some(num) = tracking.split("behind ").nth(1) {
                        behind = num.split(']').next().unwrap_or("0").parse().unwrap_or(0);
                    }
                }
            }
            continue;
        }

        if let Some((p, code)) = staged_code(line) {
            staged_codes.insert(p, code);
        }
        categorize_status_line(
            line,
            &mut staged,
            &mut modified,
            &mut added,
            &mut deleted,
            &mut untracked,
            &mut conflicted,
        );
    }

    Ok(GitStatus {
        branch,
        ahead,
        behind,
        staged,
        modified,
        added,
        deleted,
        untracked,
        conflicted,
        stashes,
        staged_codes,
    })
}

async fn git_get_branches_ssh(pool: &DbPool, connection_id: &str, path: &str) -> Result<Vec<GitBranch>, String> {
    let output = execute_ssh_git_command(pool, connection_id, "git branch -vv --all", path).await?;
    
    let mut branches = Vec::new();
    
    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        
        let current = line.starts_with('*');
        let line = if current { &line[2..] } else { line };
        let parts: Vec<&str> = line.split_whitespace().collect();
        
        if parts.is_empty() {
            continue;
        }
        
        let name = parts[0].to_string();
        let remote = name.starts_with("remotes/");
        
        branches.push(GitBranch {
            name,
            current,
            remote,
            upstream: None,
            last_commit: None,
            last_commit_date: None,
        });
    }
    
    Ok(branches)
}

async fn git_get_commits_ssh(pool: &DbPool, connection_id: &str, path: &str, limit: i32) -> Result<Vec<GitCommit>, String> {
    let cmd = format!("git log -{} --pretty=format:'%H|%h|%an|%ae|%at|%s' --name-only", limit);
    let output = execute_ssh_git_command(pool, connection_id, &cmd, path).await?;
    
    let mut commits = Vec::new();
    let mut current_commit: Option<GitCommit> = None;
    let mut files = Vec::new();
    
    for line in output.lines() {
        if line.contains('|') {
            if let Some(mut commit) = current_commit.take() {
                commit.files = files.clone();
                commits.push(commit);
                files.clear();
            }
            
            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() >= 6 {
                current_commit = Some(GitCommit {
                    hash: parts[0].to_string(),
                    short_hash: parts[1].to_string(),
                    author: parts[2].to_string(),
                    email: parts[3].to_string(),
                    date: parts[4].parse().unwrap_or(0),
                    message: parts[5].to_string(),
                    files: Vec::new(),
                });
            }
        } else if !line.is_empty() {
            files.push(line.to_string());
        }
    }
    
    if let Some(mut commit) = current_commit {
        commit.files = files;
        commits.push(commit);
    }
    
    Ok(commits)
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TempRepo(std::path::PathBuf);

    impl TempRepo {
        fn new(name: &str) -> Self {
            let dir = std::env::temp_dir().join(format!("nexterm_git_{}_{}", name, std::process::id()));
            let _ = std::fs::remove_dir_all(&dir);
            std::fs::create_dir_all(&dir).unwrap();
            let repo = TempRepo(dir);
            repo.git(&["init", "-q"]);
            repo.git(&["config", "user.email", "t@example.com"]);
            repo.git(&["config", "user.name", "T"]);
            repo.git(&["config", "commit.gpgsign", "false"]);
            repo
        }
        fn path(&self) -> &str {
            self.0.to_str().unwrap()
        }
        fn git(&self, args: &[&str]) {
            run_git(self.path(), args, &[]).unwrap();
        }
        fn write(&self, file: &str, body: &str) {
            std::fs::write(self.0.join(file), body).unwrap();
        }
    }

    impl Drop for TempRepo {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn committed_repo(name: &str) -> TempRepo {
        let repo = TempRepo::new(name);
        repo.write("a.txt", "one\ntwo\n");
        repo.git(&["add", "a.txt"]);
        repo.git(&["commit", "-q", "-m", "init"]);
        repo
    }

    #[test]
    fn unstaged_diff_has_real_lines() {
        let repo = committed_repo("unstaged");
        repo.write("a.txt", "one\nthree\n");
        let diffs = collect_diff(repo.path(), Some("a.txt"), false).unwrap();
        assert_eq!(diffs.len(), 1);
        assert_eq!(diffs[0].file, "a.txt");
        assert_eq!((diffs[0].additions, diffs[0].deletions), (1, 1));
        assert!(diffs[0].changes.contains("-two"));
        assert!(diffs[0].changes.contains("+three"));
    }

    #[test]
    fn staged_diff_compares_index_to_head() {
        let repo = committed_repo("staged");
        repo.write("a.txt", "one\ntwo\nfour\n");
        repo.git(&["add", "a.txt"]);
        assert!(collect_diff(repo.path(), Some("a.txt"), false).unwrap().is_empty());
        let diffs = collect_diff(repo.path(), Some("a.txt"), true).unwrap();
        assert_eq!(diffs.len(), 1);
        assert!(diffs[0].changes.contains("+four"));
    }

    #[test]
    fn untracked_file_is_all_added() {
        let repo = committed_repo("untracked");
        repo.write("new.txt", "x\ny\n");
        let diffs = collect_diff(repo.path(), Some("new.txt"), false).unwrap();
        assert_eq!(diffs.len(), 1);
        assert_eq!(diffs[0].file, "new.txt");
        assert_eq!((diffs[0].additions, diffs[0].deletions), (2, 0));
        assert!(diffs[0].changes.contains("+x"));
    }

    #[test]
    fn no_file_returns_every_changed_file() {
        let repo = committed_repo("all");
        repo.write("b.txt", "b\n");
        repo.git(&["add", "b.txt"]);
        repo.git(&["commit", "-q", "-m", "b"]);
        repo.write("a.txt", "changed\n");
        repo.write("b.txt", "changed\n");
        assert_eq!(collect_diff(repo.path(), None, false).unwrap().len(), 2);
    }

    #[test]
    fn staged_code_reports_index_letter() {
        assert_eq!(staged_code("A  new.rs"), Some(("new.rs".into(), "A".into())));
        assert_eq!(staged_code("MM both.rs"), Some(("both.rs".into(), "M".into())));
        assert_eq!(staged_code("D  gone.rs"), Some(("gone.rs".into(), "D".into())));
        assert_eq!(staged_code(" M work.rs"), None);
        assert_eq!(staged_code("?? new.rs"), None);
    }
}
