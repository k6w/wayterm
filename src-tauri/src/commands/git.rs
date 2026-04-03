use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub branch: String,
    pub ahead: i32,
    pub behind: i32,
    pub staged: i32,
    pub unstaged: i32,
    pub untracked: i32,
    pub conflicted: i32,
    pub stashes: i32,
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
    let output = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&path)
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
    let output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to execute git: {}", e))?;

    if !output.status.success() {
        return Ok(false);
    }

    Ok(!output.stdout.is_empty())
}

#[tauri::command]
pub async fn git_get_status(path: String) -> Result<GitStatus, String> {
    if !Path::new(&path).join(".git").exists() {
        return Err("Not a git repository".to_string());
    }

    let branch = git_get_branch(path.clone()).await?.unwrap_or_else(|| "HEAD".to_string());

    let status_output = Command::new("git")
        .args(["status", "--porcelain", "--branch"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to get status: {}", e))?;

    let status_str = String::from_utf8_lossy(&status_output.stdout);
    let mut staged = 0;
    let mut unstaged = 0;
    let mut untracked = 0;
    let mut conflicted = 0;
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

        let chars: Vec<char> = line.chars().collect();
        if chars.len() < 2 {
            continue;
        }

        match (chars[0], chars[1]) {
            ('?', '?') => untracked += 1,
            ('U', _) | (_, 'U') | ('A', 'A') | ('D', 'D') => conflicted += 1,
            (x, ' ') if x != ' ' && x != '?' => staged += 1,
            (' ', y) if y != ' ' && y != '?' => unstaged += 1,
            (x, y) if x != ' ' && y != ' ' && x != '?' && y != '?' => {
                staged += 1;
                unstaged += 1;
            }
            _ => {}
        }
    }

    let stash_output = Command::new("git")
        .args(["stash", "list"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to get stashes: {}", e))?;

    let stashes = String::from_utf8_lossy(&stash_output.stdout).lines().count() as i32;

    Ok(GitStatus {
        branch,
        ahead,
        behind,
        staged,
        unstaged,
        untracked,
        conflicted,
        stashes,
    })
}

#[tauri::command]
pub async fn git_get_branches(path: String) -> Result<Vec<GitBranch>, String> {
    let output = Command::new("git")
        .args(["branch", "-vv", "--all"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to get branches: {}", e))?;

    if !output.status.success() {
        return Err("Failed to get branches".to_string());
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
pub async fn git_get_commits(path: String, limit: i32) -> Result<Vec<GitCommit>, String> {
    let output = Command::new("git")
        .args([
            "log",
            &format!("-{}", limit),
            "--pretty=format:%H|%h|%an|%ae|%at|%s",
            "--name-only",
        ])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to get commits: {}", e))?;

    if !output.status.success() {
        return Err("Failed to get commits".to_string());
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
    let output = Command::new("git")
        .args(["remote", "-v"])
        .current_dir(&path)
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

#[tauri::command]
pub async fn git_get_diff(path: String, file: Option<String>) -> Result<Vec<GitDiff>, String> {
    let mut args = vec!["diff", "--numstat"];
    if let Some(ref f) = file {
        args.push(f);
    }

    let output = Command::new("git")
        .args(&args)
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to get diff: {}", e))?;

    if !output.status.success() {
        return Err("Failed to get diff".to_string());
    }

    let mut diffs = Vec::new();
    let output_str = String::from_utf8_lossy(&output.stdout);

    for line in output_str.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3 {
            diffs.push(GitDiff {
                additions: parts[0].parse().unwrap_or(0),
                deletions: parts[1].parse().unwrap_or(0),
                file: parts[2].to_string(),
                changes: String::new(),
            });
        }
    }

    Ok(diffs)
}

#[tauri::command]
pub async fn git_checkout(path: String, branch: String) -> Result<(), String> {
    let output = Command::new("git")
        .args(["checkout", &branch])
        .current_dir(&path)
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
    let output = Command::new("git")
        .args(["pull"])
        .current_dir(&path)
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
    let output = Command::new("git")
        .args(["push"])
        .current_dir(&path)
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
    let output = Command::new("git")
        .args(["commit", "-m", &message])
        .current_dir(&path)
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

    let output = Command::new("git")
        .args(&args)
        .current_dir(&path)
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

    let output = Command::new("git")
        .args(&args)
        .current_dir(&path)
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
        Command::new("git")
            .args(["stash", "push", "-m", &msg])
            .current_dir(&path)
            .output()
            .map_err(|e| format!("Failed to stash: {}", e))?
    } else {
        Command::new("git")
            .args(["stash", "push"])
            .current_dir(&path)
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
    let output = Command::new("git")
        .args(["stash", "pop"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to pop stash: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Stash pop failed: {}", error));
    }

    Ok(())
}
