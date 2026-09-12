//! Where `ssh <host>` will really connect, as `ssh -G` reports it after
//! applying ~/.ssh/config, and whether the app may probe that host key itself.
//!
//! OpenSSH looks a host key up under HostKeyAlias when it is set, otherwise
//! under the HostName after config substitution (written `name` on port 22 and
//! `[name]:port` otherwise) in UserKnownHostsFile. The probe only runs when that
//! name and file are the ones this app reads and edits: the resolved HostName
//! and port, no HostKeyAlias, the default ~/.ssh/known_hosts, and a direct
//! connection (no ProxyCommand or ProxyJump). In every other case `ssh` is left
//! to enforce its own host-key checking.

use std::ffi::OsString;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Resolved {
    pub hostname: String,
    pub port: u16,
    pub host_key_alias: Option<String>,
    pub proxy_command: Option<String>,
    pub proxy_jump: Option<String>,
    pub user_known_hosts_files: Vec<String>,
    pub global_known_hosts_files: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProbePlan {
    /// Probe this host:port and use it as the known_hosts name.
    Probe { host: String, port: u16 },
    /// Do not probe; `ssh` checks the host key itself. The reason is for logs.
    Skip(String),
}

/// A set value, or None for an absent or "none" value.
fn set(value: &str) -> Option<String> {
    let v = value.trim();
    (!v.is_empty() && !v.eq_ignore_ascii_case("none")).then(|| v.to_string())
}

/// Parses `ssh -G` output ("keyword value" lines, keywords in lowercase).
pub fn parse_ssh_g(output: &str) -> Result<Resolved, String> {
    let mut resolved = Resolved::default();
    let mut port = None;
    for line in output.lines() {
        let Some((keyword, value)) = line.trim().split_once(' ') else {
            continue;
        };
        match keyword.to_ascii_lowercase().as_str() {
            "hostname" if resolved.hostname.is_empty() => resolved.hostname = value.trim().to_string(),
            "port" if port.is_none() => port = value.trim().parse::<u16>().ok(),
            "hostkeyalias" if resolved.host_key_alias.is_none() => resolved.host_key_alias = set(value),
            "proxycommand" if resolved.proxy_command.is_none() => resolved.proxy_command = set(value),
            "proxyjump" if resolved.proxy_jump.is_none() => resolved.proxy_jump = set(value),
            "userknownhostsfile" if resolved.user_known_hosts_files.is_empty() => {
                resolved.user_known_hosts_files = value.split_whitespace().map(str::to_string).collect();
            }
            "globalknownhostsfile" if resolved.global_known_hosts_files.is_empty() => {
                resolved.global_known_hosts_files = value.split_whitespace().map(str::to_string).collect();
            }
            _ => {}
        }
    }
    if resolved.hostname.is_empty() {
        return Err("ssh -G reported no hostname".to_string());
    }
    resolved.port = port.filter(|p| *p != 0).ok_or("ssh -G reported no port")?;
    Ok(resolved)
}

fn expand_home(path: &str, home: &Path) -> PathBuf {
    match path.strip_prefix("~/") {
        Some(rest) => home.join(rest),
        None => PathBuf::from(path),
    }
}

/// Decides whether the app may probe the host key for this destination.
pub fn plan_probe(resolved: &Resolved, home: &Path) -> ProbePlan {
    if resolved.proxy_command.is_some() {
        return ProbePlan::Skip("ProxyCommand is set".to_string());
    }
    if resolved.proxy_jump.is_some() {
        return ProbePlan::Skip("ProxyJump is set".to_string());
    }
    if resolved.host_key_alias.is_some() {
        return ProbePlan::Skip("HostKeyAlias is set".to_string());
    }
    let ssh_dir = home.join(".ssh");
    let files: Vec<PathBuf> = resolved.user_known_hosts_files.iter().map(|f| expand_home(f, home)).collect();
    let default_files = files.first() == Some(&ssh_dir.join("known_hosts"))
        && files[1..].iter().all(|f| *f == ssh_dir.join("known_hosts2"));
    if !default_files {
        return ProbePlan::Skip("UserKnownHostsFile is not the default ~/.ssh/known_hosts".to_string());
    }
    ProbePlan::Probe { host: resolved.hostname.clone(), port: resolved.port }
}

/// Arguments for `ssh -G` (an argv array, never a shell command line).
pub fn ssh_g_args(host: &str, port: Option<u16>, config: Option<&Path>) -> Vec<OsString> {
    let mut args: Vec<OsString> = vec!["-G".into()];
    if let Some(config) = config {
        args.push("-F".into());
        args.push(config.as_os_str().to_owned());
    }
    if let Some(port) = port {
        args.push("-p".into());
        args.push(port.to_string().into());
    }
    // "--" ends the options, so a host starting with "-" cannot become one.
    args.push("--".into());
    args.push(host.into());
    args
}

/// Runs `ssh -G` for this destination. Errors when ssh is missing, fails or times out.
pub async fn resolve_destination(host: &str, port: Option<u16>, config: Option<&Path>) -> Result<Resolved, String> {
    if host.is_empty() {
        return Err("No host".to_string());
    }
    let mut command = tokio::process::Command::new("ssh");
    command
        .args(ssh_g_args(host, port, config))
        .stdin(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .kill_on_drop(true);
    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    let output = tokio::time::timeout(std::time::Duration::from_secs(5), command.output())
        .await
        .map_err(|_| "ssh -G timed out".to_string())?
        .map_err(|e| format!("Cannot run ssh -G: {e}"))?;
    if !output.status.success() {
        return Err(format!("ssh -G failed ({})", output.status));
    }
    parse_ssh_g(&String::from_utf8_lossy(&output.stdout))
}

#[cfg(test)]
mod tests {
    use super::*;

    const HOME: &str = "/home/u";

    fn output(extra: &str) -> String {
        format!(
            "user u\nhostname real.example.com\nport 2200\naddressfamily any\n\
             globalknownhostsfile /etc/ssh/ssh_known_hosts /etc/ssh/ssh_known_hosts2\n\
             userknownhostsfile /home/u/.ssh/known_hosts /home/u/.ssh/known_hosts2\n{extra}"
        )
    }

    fn plan(extra: &str) -> ProbePlan {
        plan_probe(&parse_ssh_g(&output(extra)).unwrap(), Path::new(HOME))
    }

    #[test]
    fn parses_the_destination() {
        let r = parse_ssh_g(&output("proxycommand none\n")).unwrap();
        assert_eq!(r.hostname, "real.example.com");
        assert_eq!(r.port, 2200);
        assert_eq!(r.proxy_command, None);
        assert_eq!(r.user_known_hosts_files, vec!["/home/u/.ssh/known_hosts", "/home/u/.ssh/known_hosts2"]);
        assert_eq!(r.global_known_hosts_files, vec!["/etc/ssh/ssh_known_hosts", "/etc/ssh/ssh_known_hosts2"]);
        assert!(parse_ssh_g("port 22\n").is_err());
        assert!(parse_ssh_g("hostname x\n").is_err());
        assert!(parse_ssh_g("hostname x\nport 0\n").is_err());
    }

    #[test]
    fn probes_the_resolved_host_and_port() {
        assert_eq!(plan(""), ProbePlan::Probe { host: "real.example.com".into(), port: 2200 });
        assert_eq!(plan("proxyjump none\nproxycommand none\n"), ProbePlan::Probe { host: "real.example.com".into(), port: 2200 });
    }

    #[test]
    fn skips_proxies_aliases_and_other_known_hosts_files() {
        assert!(matches!(plan("proxycommand nc %h %p\n"), ProbePlan::Skip(_)));
        assert!(matches!(plan("proxyjump bastion\n"), ProbePlan::Skip(_)));
        assert!(matches!(plan("hostkeyalias pinned\n"), ProbePlan::Skip(_)));
        let mut r = parse_ssh_g(&output("")).unwrap();
        r.user_known_hosts_files = vec!["/tmp/other".into()];
        assert!(matches!(plan_probe(&r, Path::new(HOME)), ProbePlan::Skip(_)));
        r.user_known_hosts_files = vec!["/home/u/.ssh/known_hosts".into(), "/tmp/extra".into()];
        assert!(matches!(plan_probe(&r, Path::new(HOME)), ProbePlan::Skip(_)));
        r.user_known_hosts_files = vec![];
        assert!(matches!(plan_probe(&r, Path::new(HOME)), ProbePlan::Skip(_)));
        r.user_known_hosts_files = vec!["~/.ssh/known_hosts".into()];
        assert!(matches!(plan_probe(&r, Path::new(HOME)), ProbePlan::Probe { .. }));
    }

    #[test]
    fn args_end_options_before_the_host() {
        let args = ssh_g_args("-oProxyCommand=evil", Some(2222), None);
        assert_eq!(args, ["-G", "-p", "2222", "--", "-oProxyCommand=evil"].map(OsString::from).to_vec());
        assert_eq!(ssh_g_args("h", None, None), ["-G", "--", "h"].map(OsString::from).to_vec());
    }

    /// Interop with the real OpenSSH client (skipped where ssh is not installed).
    #[tokio::test]
    async fn real_ssh_resolution_matches_the_known_hosts_name() {
        if std::process::Command::new("ssh").arg("-V").output().is_err() {
            return;
        }
        let dir = tempfile::tempdir().unwrap();
        let config = dir.path().join("config");
        std::fs::write(
            &config,
            "Host myhost\n  HostName Real.Example.com\n  Port 2200\nHost jumpy\n  ProxyJump bastion\n\
             Host pinned\n  HostKeyAlias other-name\nHost elsewhere\n  UserKnownHostsFile /tmp/x_known_hosts\n",
        )
        .unwrap();
        let home = dirs::home_dir().unwrap();
        let resolved = resolve_destination("myhost", None, Some(&config)).await.unwrap();
        assert_eq!(plan_probe(&resolved, &home), ProbePlan::Probe { host: "real.example.com".into(), port: 2200 });
        let resolved = resolve_destination("myhost", Some(2222), Some(&config)).await.unwrap();
        assert_eq!(resolved.port, 2222, "-p overrides the config Port, as for ssh itself");
        for skipped in ["jumpy", "pinned", "elsewhere"] {
            let resolved = resolve_destination(skipped, None, Some(&config)).await.unwrap();
            assert!(matches!(plan_probe(&resolved, &home), ProbePlan::Skip(_)), "{skipped}");
        }

        // The name OpenSSH looks up ([hostname]:port) is the one this app checks and replaces.
        let key = "AAAAC3NzaC1lZDI1NTE5AAAAIEBideruyixQqgBBMvV809wd4ptM2LMIU5Uy2rZb3H+h";
        let kh = dir.path().join("known_hosts");
        std::fs::write(&kh, format!("[real.example.com]:2200 ssh-ed25519 {key}\n")).unwrap();
        let found = std::process::Command::new("ssh-keygen").args(["-F", "[real.example.com]:2200", "-f"]).arg(&kh).output();
        if let Ok(found) = found {
            assert!(found.status.success());
        }
        let content = std::fs::read_to_string(&kh).unwrap();
        assert_eq!(
            super::super::check_host_key(&content, "real.example.com", 2200, "ssh-ed25519", key),
            super::super::HostKeyCheck::Trusted
        );
    }
}
