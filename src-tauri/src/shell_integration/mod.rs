//! Decides how a local shell is started so that it reports its title, cwd and
//! (later) command boundaries to the terminal.

pub mod install;
#[cfg(all(test, unix))]
mod pty_tests;

use std::path::Path;

/// Extra arguments and environment for one shell spawn.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct SpawnPlan {
    pub args: Vec<String>,
    pub env: Vec<(String, String)>,
    /// The shell loads Nexterm's integration script and reports with the nonce.
    pub integrated: bool,
}

/// What the plan needs to know about this spawn besides the shell.
pub struct PlanContext<'a> {
    /// Where the scripts were installed; `None` if that failed.
    pub dir: Option<&'a Path>,
    /// Per-session secret the script puts in its OSC 133;C reports.
    pub nonce: &'a str,
    /// The environment the shell would otherwise inherit.
    pub orig_env: &'a dyn Fn(&str) -> Option<String>,
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
            ..Default::default()
        },
        ShellKind::Bash => SpawnPlan { env: vec![prompt_command()], ..Default::default() },
        ShellKind::Zsh => SpawnPlan {
            env: vec![("NEXTERM_ZSH_INTEGRATION".to_string(), "1".to_string()), prompt_command()],
            ..Default::default()
        },
        ShellKind::Fish => SpawnPlan {
            args: strings(&["-C", "function fish_title; echo $PWD; end"]),
            ..Default::default()
        },
        ShellKind::Cmd => SpawnPlan { args: strings(&["/K", r"prompt $e]0;$p$e\$p$g"]), ..Default::default() },
        ShellKind::Other => SpawnPlan::default(),
    }
}

fn session_env(ctx: &PlanContext) -> Vec<(String, String)> {
    vec![
        ("NEXTERM_SHELL_INTEGRATION".to_string(), "1".to_string()),
        ("NEXTERM_SI_NONCE".to_string(), ctx.nonce.to_string()),
    ]
}

fn dir_str(dir: &Path, sub: &str) -> String {
    dir.join(sub).to_string_lossy().into_owned()
}

/// zsh reads `$ZDOTDIR/.zshenv` first; ours restores the user's ZDOTDIR.
fn zsh_plan(dir: &Path, ctx: &PlanContext) -> SpawnPlan {
    let mut env = vec![("ZDOTDIR".to_string(), dir_str(dir, "zsh"))];
    match (ctx.orig_env)("ZDOTDIR") {
        Some(orig) => env.push(("NEXTERM_ORIG_ZDOTDIR".to_string(), orig)),
        None => env.push(("NEXTERM_ORIG_ZDOTDIR_UNSET".to_string(), "1".to_string())),
    }
    env.extend(session_env(ctx));
    SpawnPlan { args: Vec::new(), env, integrated: true }
}

/// The spawn plan for `shell_path`. `enabled` is false for shells that must
/// start untouched (scratchpad, ssh, or integration turned off). Shells without
/// a script, or when the scripts could not be installed, get the title-only setup.
pub fn plan(shell_path: &str, enabled: bool, ctx: &PlanContext) -> SpawnPlan {
    if !enabled {
        return SpawnPlan::default();
    }
    let kind = shell_kind(shell_path);
    match (kind, ctx.dir) {
        (ShellKind::Zsh, Some(dir)) => zsh_plan(dir, ctx),
        _ => title_plan(kind),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn no_env(_: &str) -> Option<String> {
        None
    }

    /// Context of a spawn whose scripts could not be installed.
    fn no_dir() -> PlanContext<'static> {
        PlanContext { dir: None, nonce: "n0nce", orig_env: &no_env }
    }

    fn env_of<'a>(p: &'a SpawnPlan, key: &str) -> Option<&'a str> {
        p.env.iter().find(|(k, _)| k == key).map(|(_, v)| v.as_str())
    }

    #[test]
    fn zsh_points_zdotdir_at_the_script_and_saves_the_users() {
        let dir = Path::new("/data/si/v1");
        let users = |k: &str| (k == "ZDOTDIR").then(|| "/home/u/.config/zsh".to_string());
        let ctx = PlanContext { dir: Some(dir), nonce: "abc", orig_env: &users };
        let p = plan("/bin/zsh", true, &ctx);
        assert!(p.integrated);
        assert!(p.args.is_empty());
        assert_eq!(env_of(&p, "ZDOTDIR"), Some(dir.join("zsh").to_str().unwrap()));
        assert_eq!(env_of(&p, "NEXTERM_ORIG_ZDOTDIR"), Some("/home/u/.config/zsh"));
        assert_eq!(env_of(&p, "NEXTERM_ORIG_ZDOTDIR_UNSET"), None);
        assert_eq!(env_of(&p, "NEXTERM_SHELL_INTEGRATION"), Some("1"));
        assert_eq!(env_of(&p, "NEXTERM_SI_NONCE"), Some("abc"));
        assert_eq!(env_of(&p, "PROMPT_COMMAND"), None);
    }

    #[test]
    fn zsh_marks_an_unset_zdotdir() {
        let ctx = PlanContext { dir: Some(Path::new("/d")), nonce: "abc", orig_env: &no_env };
        let p = plan("/bin/zsh", true, &ctx);
        assert_eq!(env_of(&p, "NEXTERM_ORIG_ZDOTDIR"), None);
        assert_eq!(env_of(&p, "NEXTERM_ORIG_ZDOTDIR_UNSET"), Some("1"));
    }

    #[test]
    fn zsh_disabled_is_untouched_even_with_scripts() {
        let ctx = PlanContext { dir: Some(Path::new("/d")), nonce: "abc", orig_env: &no_env };
        assert_eq!(plan("/bin/zsh", false, &ctx), SpawnPlan::default());
    }

    fn env(pairs: &[(&str, &str)]) -> Vec<(String, String)> {
        pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
    }

    #[test]
    fn disabled_changes_nothing() {
        for shell in ["/bin/bash", "/bin/zsh", "/usr/bin/fish", "pwsh.exe", "cmd.exe"] {
            assert_eq!(plan(shell, false, &no_dir()), SpawnPlan::default(), "{shell}");
        }
    }

    #[test]
    fn bash_gets_title_prompt_command() {
        let p = plan("/opt/homebrew/bin/bash", true, &no_dir());
        assert!(p.args.is_empty());
        assert_eq!(p.env, env(&[("PROMPT_COMMAND", "printf \"\\033]0;%s\\007\" \"$PWD\"")]));
    }

    #[test]
    fn zsh_matches_previous_frontend_plan() {
        let p = plan("/bin/zsh", true, &no_dir());
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
        let p = plan("/usr/local/bin/fish", true, &no_dir());
        assert_eq!(p.args, strings(&["-C", "function fish_title; echo $PWD; end"]));
        assert!(p.env.is_empty());
    }

    #[test]
    fn powershell_sets_title_in_prompt() {
        for shell in [r"C:\Program Files\PowerShell\7\pwsh.exe", r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"] {
            let p = plan(shell, true, &no_dir());
            assert_eq!(p.args[..3], strings(&["-NoLogo", "-NoExit", "-Command"])[..]);
            assert!(p.args[3].contains("WindowTitle = $PWD.Path"));
            assert!(p.env.is_empty());
        }
    }

    #[test]
    fn cmd_sets_title_prompt() {
        let p = plan(r"C:\Windows\System32\cmd.exe", true, &no_dir());
        assert_eq!(p.args, strings(&["/K", "prompt $e]0;$p$e\\$p$g"]));
    }

    #[test]
    fn unknown_shell_and_ssh_get_nothing() {
        assert_eq!(plan("/bin/sh", true, &no_dir()), SpawnPlan::default());
        assert_eq!(plan("ssh", true, &no_dir()), SpawnPlan::default());
    }

    #[test]
    fn kind_uses_file_name_only() {
        assert_eq!(shell_kind("/Users/cmdr/bin/zsh"), ShellKind::Zsh);
        assert_eq!(shell_kind("/home/bashful/.local/bin/fish"), ShellKind::Fish);
    }
}
