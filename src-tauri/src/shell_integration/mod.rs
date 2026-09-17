//! Decides how a local shell is started so that it reports its title, cwd and
//! (later) command boundaries to the terminal.

pub mod install;

use std::path::Path;

/// Extra arguments and environment for one shell spawn.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct SpawnPlan {
    pub args: Vec<String>,
    pub env: Vec<(String, String)>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ShellKind {
    PowerShell,
    Bash,
    Zsh,
    Fish,
    Cmd,
    Other,
}

/// Classifies a shell by the file name of its path (either separator).
fn shell_kind(shell_path: &str) -> ShellKind {
    let name = shell_path
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or(shell_path)
        .to_ascii_lowercase();
    if name.contains("pwsh") || name.contains("powershell") {
        ShellKind::PowerShell
    } else if name.contains("bash") {
        ShellKind::Bash
    } else if name.contains("zsh") {
        ShellKind::Zsh
    } else if name.contains("fish") {
        ShellKind::Fish
    } else if name.contains("cmd") {
        ShellKind::Cmd
    } else {
        ShellKind::Other
    }
}

const TITLE_PROMPT_COMMAND: &str = r#"printf "\033]0;%s\007" "$PWD""#;

fn strings(items: &[&str]) -> Vec<String> {
    items.iter().map(|s| s.to_string()).collect()
}

/// Title-only setup: the shell sets the window title to its cwd at each prompt.
fn title_plan(kind: ShellKind) -> SpawnPlan {
    let prompt_command = || ("PROMPT_COMMAND".to_string(), TITLE_PROMPT_COMMAND.to_string());
    match kind {
        ShellKind::PowerShell => SpawnPlan {
            args: strings(&[
                "-NoLogo",
                "-NoExit",
                "-Command",
                "function global:prompt { $Host.UI.RawUI.WindowTitle = $PWD.Path; 'PS ' + $PWD.Path + '> ' }",
            ]),
            env: Vec::new(),
        },
        ShellKind::Bash => SpawnPlan { args: Vec::new(), env: vec![prompt_command()] },
        ShellKind::Zsh => SpawnPlan {
            args: Vec::new(),
            env: vec![("NEXTERM_ZSH_INTEGRATION".to_string(), "1".to_string()), prompt_command()],
        },
        ShellKind::Fish => SpawnPlan {
            args: strings(&["-C", "function fish_title; echo $PWD; end"]),
            env: Vec::new(),
        },
        ShellKind::Cmd => SpawnPlan { args: strings(&["/K", r"prompt $e]0;$p$e\$p$g"]), env: Vec::new() },
        ShellKind::Other => SpawnPlan::default(),
    }
}

/// The spawn plan for `shell_path`. `enabled` is false for shells that must
/// start untouched (scratchpad, ssh, or integration turned off). `_dir` is where
/// the scripts were installed (`None` if that failed).
pub fn plan(shell_path: &str, enabled: bool, _dir: Option<&Path>) -> SpawnPlan {
    if !enabled {
        return SpawnPlan::default();
    }
    title_plan(shell_kind(shell_path))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn env(pairs: &[(&str, &str)]) -> Vec<(String, String)> {
        pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
    }

    #[test]
    fn disabled_changes_nothing() {
        for shell in ["/bin/bash", "/bin/zsh", "/usr/bin/fish", "pwsh.exe", "cmd.exe"] {
            assert_eq!(plan(shell, false, None), SpawnPlan::default(), "{shell}");
        }
    }

    #[test]
    fn bash_gets_title_prompt_command() {
        let p = plan("/opt/homebrew/bin/bash", true, None);
        assert!(p.args.is_empty());
        assert_eq!(p.env, env(&[("PROMPT_COMMAND", "printf \"\\033]0;%s\\007\" \"$PWD\"")]));
    }

    #[test]
    fn zsh_matches_previous_frontend_plan() {
        let p = plan("/bin/zsh", true, None);
        assert!(p.args.is_empty());
        assert_eq!(
            p.env,
            env(&[
                ("NEXTERM_ZSH_INTEGRATION", "1"),
                ("PROMPT_COMMAND", "printf \"\\033]0;%s\\007\" \"$PWD\""),
            ])
        );
    }

    #[test]
    fn fish_sets_fish_title() {
        let p = plan("/usr/local/bin/fish", true, None);
        assert_eq!(p.args, strings(&["-C", "function fish_title; echo $PWD; end"]));
        assert!(p.env.is_empty());
    }

    #[test]
    fn powershell_sets_title_in_prompt() {
        for shell in [r"C:\Program Files\PowerShell\7\pwsh.exe", r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"] {
            let p = plan(shell, true, None);
            assert_eq!(p.args[..3], strings(&["-NoLogo", "-NoExit", "-Command"])[..]);
            assert!(p.args[3].contains("WindowTitle = $PWD.Path"));
            assert!(p.env.is_empty());
        }
    }

    #[test]
    fn cmd_sets_title_prompt() {
        let p = plan(r"C:\Windows\System32\cmd.exe", true, None);
        assert_eq!(p.args, strings(&["/K", "prompt $e]0;$p$e\\$p$g"]));
    }

    #[test]
    fn unknown_shell_and_ssh_get_nothing() {
        assert_eq!(plan("/bin/sh", true, None), SpawnPlan::default());
        assert_eq!(plan("ssh", true, None), SpawnPlan::default());
    }

    #[test]
    fn kind_uses_file_name_only() {
        assert_eq!(shell_kind("/Users/cmdr/bin/zsh"), ShellKind::Zsh);
        assert_eq!(shell_kind("/home/bashful/.local/bin/fish"), ShellKind::Fish);
    }
}
