//! Runs the integration scripts in real shells on a PTY, with a temporary HOME,
//! to prove the user's own config still loads and the reports are emitted.
//! Every test skips when its shell is not installed.

use super::{install, plan, PlanContext, ShellSetup};
use crate::pty::session::PtySession;
use parking_lot::Mutex;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};

pub(crate) const NONCE: &str = "test-nonce-7f3a";

/// Finds `name` on PATH (or in /bin, /usr/bin); `None` means skip the test.
pub(crate) fn find_shell(name: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH").unwrap_or_default();
    std::env::split_paths(&path)
        .chain([PathBuf::from("/bin"), PathBuf::from("/usr/bin")])
        .map(|d| d.join(name))
        .find(|p| p.is_file())
}

pub(crate) struct Shell {
    session: PtySession,
    out: Arc<Mutex<Vec<u8>>>,
    _data: tempfile::TempDir,
}

impl Shell {
    /// Starts `shell` integrated, with HOME=`home` and the given extra environment.
    /// `orig_env` is what the spawn plan sees as the inherited environment.
    pub(crate) fn start(
        shell: &Path,
        home: &Path,
        env: &[(&str, &str)],
        orig_env: &dyn Fn(&str) -> Option<String>,
    ) -> Self {
        let data = tempfile::tempdir().unwrap();
        let dir = install::install(data.path()).unwrap();
        let ctx = PlanContext { dir: Some(&dir), nonce: NONCE, orig_env };
        let p = plan(shell.to_str().unwrap(), ShellSetup::Integrated, &ctx);
        assert!(p.integrated, "{} should be integrated", shell.display());
        let mut full_env: Vec<(String, String)> = vec![("HOME".into(), home.to_string_lossy().into_owned())];
        full_env.extend(env.iter().map(|(k, v)| (k.to_string(), v.to_string())));
        full_env.extend(p.env);
        let (session, mut reader) =
            PtySession::spawn(shell.to_str().unwrap(), &p.args, home.to_str().unwrap(), &full_env, 24, 200)
                .unwrap();
        let out = Arc::new(Mutex::new(Vec::new()));
        let sink = out.clone();
        std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            while let Ok(n) = std::io::Read::read(&mut reader, &mut buf) {
                if n == 0 {
                    break;
                }
                sink.lock().extend_from_slice(&buf[..n]);
            }
        });
        Self { session, out, _data: data }
    }

    pub(crate) fn text(&self) -> String {
        String::from_utf8_lossy(&self.out.lock()).into_owned()
    }

    /// Waits until the output contains `needle` `count` times; false on timeout.
    pub(crate) fn wait_for_n(&self, needle: &str, count: usize) -> bool {
        let deadline = Instant::now() + Duration::from_secs(10);
        while Instant::now() < deadline {
            if self.text().matches(needle).count() >= count {
                return true;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        false
    }

    pub(crate) fn wait_for(&self, needle: &str) -> bool {
        self.wait_for_n(needle, 1)
    }

    pub(crate) fn send(&self, line: &str) {
        self.session.write(format!("{line}\r").as_bytes()).unwrap();
    }

    /// Runs `line` at the next prompt and waits until the prompt after it.
    pub(crate) fn run(&self, line: &str) {
        let prompts = self.text().matches("\x1b]133;A").count();
        self.send(line);
        assert!(
            self.wait_for_n("\x1b]133;A", prompts + 1),
            "no prompt after {line:?}; output: {:?}",
            self.text()
        );
    }
}

impl Drop for Shell {
    fn drop(&mut self) {
        let _ = self.session.kill();
    }
}

pub(crate) fn no_env(_: &str) -> Option<String> {
    None
}

pub(crate) fn write(path: &Path, contents: &str) {
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(path, contents).unwrap();
}

/// The reports one `false` produces in an integrated shell. `c_report` is the
/// expected OSC 133;C payload (`None` for the default with the command line).
pub(crate) fn assert_reports_false_with(sh: &Shell, c_report: Option<&str>) {
    assert!(sh.wait_for("\x1b]133;A"), "no prompt start: {:?}", sh.text());
    sh.run("false");
    let out = sh.text();
    assert!(out.contains("\x1b]133;B"), "no command start: {out:?}");
    assert!(out.contains(&format!("\x1b]133;A;nx={NONCE}\x07")), "no signed prompt start: {out:?}");
    let c = c_report.map(str::to_string).unwrap_or_else(|| format!("cmdline_url=false;nx={NONCE}"));
    assert!(out.contains(&format!("\x1b]133;C;{c}\x07")), "no command report: {out:?}");
    assert!(out.contains(&format!("\x1b]133;D;1;nx={NONCE}\x07")), "no exit status: {out:?}");
    assert!(out.contains("\x1b]7;file://"), "no cwd report: {out:?}");
}

pub(crate) fn assert_reports_false(sh: &Shell) {
    assert_reports_false_with(sh, None);
}

mod zsh {
    use super::*;

    fn zsh() -> Option<PathBuf> {
        let found = find_shell("zsh");
        if found.is_none() {
            eprintln!("skipping: zsh not installed");
        }
        found
    }

    fn home_with_rc() -> tempfile::TempDir {
        let home = tempfile::tempdir().unwrap();
        let h = home.path();
        write(&h.join(".zshenv"), "echo SENTINEL-ZSHENV\n");
        write(&h.join(".zprofile"), "echo SENTINEL-ZPROFILE\n");
        write(&h.join(".zshrc"), "echo SENTINEL-ZSHRC ZD=:${ZDOTDIR-unset}:\nPS1='%# '\n");
        home
    }

    #[test]
    fn loads_user_config_and_reports_commands() {
        let Some(zsh) = zsh() else { return };
        let home = home_with_rc();
        let sh = Shell::start(&zsh, home.path(), &[], &no_env);
        assert_reports_false(&sh);
        let out = sh.text();
        assert!(out.contains("SENTINEL-ZSHENV"), "{out:?}");
        assert!(out.contains("SENTINEL-ZSHRC ZD=:unset:"), "ZDOTDIR not restored: {out:?}");
        // Non-login, exactly as before: .zprofile is not read.
        assert!(!out.contains("SENTINEL-ZPROFILE"), "{out:?}");
    }

    #[test]
    fn restores_a_custom_zdotdir() {
        let Some(zsh) = zsh() else { return };
        let home = tempfile::tempdir().unwrap();
        let zd = home.path().join("cfg");
        write(&zd.join(".zshenv"), "echo SENTINEL-CUSTOM-ZSHENV\n");
        write(&zd.join(".zshrc"), "echo SENTINEL-CUSTOM-ZSHRC ZD=:${ZDOTDIR}:\n");
        write(&home.path().join(".zshrc"), "echo WRONG-HOME-ZSHRC\n");
        let zd_str = zd.to_string_lossy().into_owned();
        let orig = move |k: &str| (k == "ZDOTDIR").then(|| zd_str.clone());
        let sh = Shell::start(&zsh, home.path(), &[], &orig);
        assert!(sh.wait_for("\x1b]133;A"), "{:?}", sh.text());
        let out = sh.text();
        assert!(out.contains("SENTINEL-CUSTOM-ZSHENV"), "{out:?}");
        assert!(out.contains(&format!("SENTINEL-CUSTOM-ZSHRC ZD=:{}:", zd.display())), "{out:?}");
        assert!(!out.contains("WRONG-HOME-ZSHRC"), "{out:?}");
    }

    #[test]
    fn hides_the_nonce_and_does_not_integrate_nested_shells() {
        let Some(zsh) = zsh() else { return };
        let home = home_with_rc();
        let sh = Shell::start(&zsh, home.path(), &[], &no_env);
        assert!(sh.wait_for("\x1b]133;A"));
        sh.run("echo ENV=:$(env | grep -c NEXTERM_):");
        assert!(sh.text().contains("ENV=:0:"), "{:?}", sh.text());
        sh.run(&format!(
            "{} -ic 'echo NESTED ZD=:${{ZDOTDIR-unset}}:; whence _nx_precmd || echo NESTED-PLAIN'",
            zsh.display()
        ));
        let out = sh.text();
        assert!(out.contains("NESTED ZD=:unset:"), "{out:?}");
        assert!(out.contains("NESTED-PLAIN"), "{out:?}");
    }

    #[test]
    fn reports_status_even_after_user_precmd_hooks() {
        let Some(zsh) = zsh() else { return };
        let home = tempfile::tempdir().unwrap();
        write(
            &home.path().join(".zshrc"),
            "autoload -Uz add-zsh-hook\n_user_hook() { true; }\nadd-zsh-hook precmd _user_hook\nPS1='%# '\n",
        );
        let sh = Shell::start(&zsh, home.path(), &[], &no_env);
        assert_reports_false(&sh);
        sh.run("(exit 3)");
        assert!(sh.text().contains(&format!("\x1b]133;D;3;nx={NONCE}\x07")), "{:?}", sh.text());
    }

    #[test]
    fn marks_prompts_that_themes_rebuild_every_time() {
        let Some(zsh) = zsh() else { return };
        let home = tempfile::tempdir().unwrap();
        write(
            &home.path().join(".zshrc"),
            "autoload -Uz add-zsh-hook\n_theme() { PS1=\"theme-$((++n))> \"; }\nadd-zsh-hook precmd _theme\n",
        );
        let sh = Shell::start(&zsh, home.path(), &[], &no_env);
        assert!(sh.wait_for("\x1b]133;A"));
        sh.run("true");
        assert!(sh.wait_for("theme-2> \x1b]133;B\x07"), "{:?}", sh.text());
    }

    #[test]
    fn encodes_the_command_line() {
        let Some(zsh) = zsh() else { return };
        let home = home_with_rc();
        let sh = Shell::start(&zsh, home.path(), &[], &no_env);
        assert!(sh.wait_for("\x1b]133;A"));
        sh.run("echo 'a b;c' é");
        let want = format!("cmdline_url=echo%20%27a%20b%3Bc%27%20%C3%A9;nx={NONCE}");
        assert!(sh.text().contains(&want), "{:?}", sh.text());
    }
}

mod bash {
    use super::*;

    /// Every distinct bash available: the one on PATH and macOS's /bin/bash 3.2.
    fn bashes() -> Vec<PathBuf> {
        let mut found: Vec<PathBuf> = Vec::new();
        for candidate in [find_shell("bash"), Some(PathBuf::from("/bin/bash"))].into_iter().flatten() {
            let Ok(real) = candidate.canonicalize() else { continue };
            if !found.iter().any(|f| f.canonicalize().ok().as_ref() == Some(&real)) {
                found.push(candidate);
            }
        }
        if found.is_empty() {
            eprintln!("skipping: bash not installed");
        }
        found
    }

    /// bash 4.4+ reports C from PS0, older bash from a DEBUG trap; neither has the command line.
    fn c_report() -> String {
        format!("nx={NONCE}")
    }

    fn home_with(bashrc: &str) -> tempfile::TempDir {
        let home = tempfile::tempdir().unwrap();
        write(&home.path().join(".bashrc"), bashrc);
        write(&home.path().join(".bash_profile"), "echo SENTINEL-BASH-PROFILE\n");
        home
    }

    #[test]
    fn loads_bashrc_and_reports_commands() {
        for bash in bashes() {
            let home = home_with("echo SENTINEL-BASHRC\nPS1='$ '\n");
            let sh = Shell::start(&bash, home.path(), &[], &no_env);
            assert_reports_false_with(&sh, Some(&c_report()));
            // Not `(exit 3)`: bash 3.2 runs no DEBUG trap for a bare subshell, so
            // that line gets no C there (D still arrives).
            sh.run("sh -c 'exit 3'");
            let out = sh.text();
            assert!(out.contains(&format!("\x1b]133;D;3;nx={NONCE}\x07")), "{}: {out:?}", bash.display());
            assert!(out.contains("SENTINEL-BASHRC"), "{}: {out:?}", bash.display());
            // Non-login, exactly as before.
            assert!(!out.contains("SENTINEL-BASH-PROFILE"), "{}: {out:?}", bash.display());
            // One C per command line, none for the prompt commands.
            assert_eq!(out.matches("\x1b]133;C").count(), 2, "{}: {out:?}", bash.display());
        }
    }

    #[test]
    fn empty_lines_are_not_commands() {
        for bash in bashes() {
            let home = home_with("PS1='$ '\n");
            let sh = Shell::start(&bash, home.path(), &[], &no_env);
            assert!(sh.wait_for("\x1b]133;A"));
            sh.run("");
            sh.run("true");
            let out = sh.text();
            assert_eq!(out.matches("\x1b]133;C").count(), 1, "{}: {out:?}", bash.display());
        }
    }

    #[test]
    fn keeps_the_users_prompt_command() {
        for bash in bashes() {
            let home = home_with("PROMPT_COMMAND='echo USER-PC; true'\nPS1='$ '\n");
            let sh = Shell::start(&bash, home.path(), &[], &no_env);
            assert_reports_false_with(&sh, Some(&c_report()));
            assert!(sh.text().contains("USER-PC"), "{}: {:?}", bash.display(), sh.text());
        }
    }

    #[test]
    fn marks_prompts_that_frameworks_rebuild() {
        for bash in bashes() {
            let home = home_with("n=0\nPROMPT_COMMAND='n=$((n+1)); PS1=\"fw-$n> \"'\n");
            let sh = Shell::start(&bash, home.path(), &[], &no_env);
            assert!(sh.wait_for("\x1b]133;A"));
            sh.run("true");
            assert!(sh.wait_for("fw-2> \x1b]133;B\x07"), "{}: {:?}", bash.display(), sh.text());
        }
    }

    #[test]
    fn moves_the_mark_back_to_the_end_of_the_prompt() {
        for bash in bashes() {
            let home = home_with("PS1='$ '\nPROMPT_COMMAND='PS1=\"${PS1}x\"'\n");
            let sh = Shell::start(&bash, home.path(), &[], &no_env);
            assert!(sh.wait_for("\x1b]133;A"));
            sh.run("true");
            assert!(sh.wait_for("$ xx\x1b]133;B\x07"), "{}: {:?}", bash.display(), sh.text());
        }
    }

    #[test]
    fn encodes_the_cwd() {
        for bash in bashes() {
            let home = home_with("PS1='$ '\n");
            std::fs::create_dir(home.path().join("é x")).unwrap();
            let sh = Shell::start(&bash, home.path(), &[], &no_env);
            assert!(sh.wait_for("\x1b]133;A"));
            sh.run("cd 'é x'");
            assert!(sh.wait_for("/%C3%A9%20x\x07"), "{}: {:?}", bash.display(), sh.text());
        }
    }

    #[test]
    fn hides_the_nonce_and_does_not_integrate_nested_shells() {
        for bash in bashes() {
            let home = home_with("echo SENTINEL-BASHRC\nPS1='$ '\n");
            let sh = Shell::start(&bash, home.path(), &[], &no_env);
            assert!(sh.wait_for("\x1b]133;A"));
            sh.run("echo \"ENV=:$(env | grep -c NEXTERM_):\"");
            assert!(sh.text().contains("ENV=:0:"), "{}: {:?}", bash.display(), sh.text());
            sh.run(&format!("{} -ic 'declare -F _nx_precmd || echo NESTED-PLAIN'", bash.display()));
            let out = sh.text();
            assert!(out.contains("NESTED-PLAIN"), "{}: {out:?}", bash.display());
            assert_eq!(out.matches("SENTINEL-BASHRC\r").count(), 2, "{}: {out:?}", bash.display());
        }
    }

    #[test]
    fn keeps_the_nonce_out_of_prompt_strings() {
        for bash in bashes() {
            let home = home_with("PS1='$ '\n");
            let sh = Shell::start(&bash, home.path(), &[], &no_env);
            assert!(sh.wait_for("\x1b]133;A"));
            sh.run("case \"$PS0$PS1\" in *7f3a*) echo LE''AK;; *) echo CL''EAN;; esac");
            assert!(sh.text().contains("CLEAN"), "{}: {:?}", bash.display(), sh.text());
        }
    }

    #[test]
    fn leaves_a_users_debug_trap_alone() {
        for bash in bashes() {
            let home = home_with("trap 'USER_TRAP=1' DEBUG\nPS1='$ '\n");
            let sh = Shell::start(&bash, home.path(), &[], &no_env);
            assert!(sh.wait_for("\x1b]133;A"));
            sh.run("trap -p DEBUG");
            let out = sh.text();
            assert!(out.contains("USER_TRAP=1"), "{}: {out:?}", bash.display());
            assert!(out.contains(&format!("\x1b]133;D;0;nx={NONCE}\x07")), "{}: {out:?}", bash.display());
        }
    }

    /// The hooks contract of bash-preexec: precmd_functions run from
    /// PROMPT_COMMAND with $? set, preexec_functions get the command line.
    const FAKE_BASH_PREEXEC: &str = r#"
bash_preexec_imported=defined
precmd_functions=()
preexec_functions=()
__fake_ready=0
__fake_precmd() {
  local s=$? f
  for f in "${precmd_functions[@]}"; do (exit $s); "$f"; done
  __fake_ready=1
}
__fake_debug() {
  [[ $__fake_ready == 1 ]] || return 0
  __fake_ready=0
  [[ "$BASH_COMMAND" == __fake_precmd ]] && return 0
  local f
  for f in "${preexec_functions[@]}"; do "$f" "$BASH_COMMAND"; done
}
PROMPT_COMMAND=__fake_precmd
trap __fake_debug DEBUG
PS1='$ '
"#;

    #[test]
    fn joins_bash_preexec_hooks() {
        for bash in bashes() {
            let home = home_with(FAKE_BASH_PREEXEC);
            let sh = Shell::start(&bash, home.path(), &[], &no_env);
            assert_reports_false(&sh);
            let out = sh.text();
            assert_eq!(out.matches("\x1b]133;C").count(), 1, "{}: {out:?}", bash.display());
        }
    }
}

mod fish {
    use super::*;

    fn fish() -> Option<PathBuf> {
        let found = find_shell("fish");
        if found.is_none() {
            eprintln!("skipping: fish not installed");
        }
        found
    }

    fn home_with_config() -> tempfile::TempDir {
        let home = tempfile::tempdir().unwrap();
        write(
            &home.path().join(".config/fish/config.fish"),
            "echo SENTINEL-FISH-CONFIG\nfunction fish_prompt; echo -n 'fish> '; end\n",
        );
        home
    }

    fn start(fish: &Path, home: &Path) -> Shell {
        let config = home.join(".config").to_string_lossy().into_owned();
        Shell::start(fish, home, &[("XDG_CONFIG_HOME", &config)], &no_env)
    }

    #[test]
    fn loads_config_and_reports_commands() {
        let Some(fish) = fish() else { return };
        let home = home_with_config();
        let sh = start(&fish, home.path());
        // fish 4 marks A and D itself, fish 3 through the script; C always comes
        // from the script, with the command line and the nonce.
        assert!(sh.wait_for("\x1b]133;A"), "{:?}", sh.text());
        sh.run("false");
        let out = sh.text();
        assert!(out.contains(&format!("\x1b]133;C;cmdline_url=false;nx={NONCE}\x07")), "{out:?}");
        assert!(out.contains(&format!("\x1b]133;D;1;nx={NONCE}\x07")), "{out:?}");
        assert!(out.contains(&format!("\x1b]133;A;nx={NONCE}\x07")), "{out:?}");
        assert!(out.contains("\x1b]7;file://"), "{out:?}");
        assert!(out.contains("SENTINEL-FISH-CONFIG"), "{out:?}");
    }

    #[test]
    fn hides_the_nonce() {
        let Some(fish) = fish() else { return };
        let home = home_with_config();
        let sh = start(&fish, home.path());
        assert!(sh.wait_for("\x1b]133;A"), "{:?}", sh.text());
        sh.run("echo ENV=:(env | grep -c NEXTERM_):");
        assert!(sh.text().contains("ENV=:0:"), "{:?}", sh.text());
    }
}
