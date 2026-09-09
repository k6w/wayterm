//! Turns parsed config hosts into saved-connection records.

use super::ConfigHost;
use crate::db::{connections::ConnectionProfile, port_forwards::PortForward};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Skipped {
    pub alias: String,
    pub reason: String,
}

#[derive(Debug, Clone)]
pub struct PlannedConnection {
    pub profile: ConnectionProfile,
    pub forwards: Vec<PortForward>,
}

#[derive(Debug, Default)]
pub struct Plan {
    pub connections: Vec<PlannedConnection>,
    pub skipped: Vec<Skipped>,
    pub warnings: Vec<String>,
}

fn same_target(c: &ConnectionProfile, host: &str, user: &str, port: i32) -> bool {
    c.host.eq_ignore_ascii_case(host) && c.username == user && c.port == port
}

fn existing_match<'a>(host: &ConfigHost, existing: &'a [ConnectionProfile]) -> Option<&'a ConnectionProfile> {
    existing.iter().find(|c| same_target(c, &host.hostname, &host.user, i32::from(host.port)))
}

/// True when a saved connection already points at this host, user and port.
pub fn is_imported(host: &ConfigHost, existing: &[ConnectionProfile]) -> bool {
    existing_match(host, existing).is_some()
}

/// Splits a ProxyJump hop (`[user@]host[:port]`, host possibly `[v6]`).
fn split_hop(token: &str) -> (Option<&str>, &str, Option<i32>) {
    let (user, rest) = match token.split_once('@') {
        Some((u, r)) => (Some(u), r),
        None => (None, token),
    };
    if let Some(inner) = rest.strip_prefix('[') {
        if let Some((host, tail)) = inner.split_once(']') {
            return (user, host, tail.strip_prefix(':').and_then(|p| p.parse().ok()));
        }
    }
    match rest.rsplit_once(':') {
        Some((host, port)) if port.parse::<i32>().is_ok() && !host.contains(':') => {
            (user, host, port.parse().ok())
        }
        _ => (user, rest, None),
    }
}

/// Decides which selected hosts become connections. Pure: key files and ids
/// come in through the two callbacks so tests need neither disk nor database.
pub fn plan_import(
    hosts: &[ConfigHost],
    selected: &[String],
    existing: &[ConnectionProfile],
    resolve_key: &mut dyn FnMut(&str) -> Option<String>,
    new_id: &mut dyn FnMut() -> String,
) -> Plan {
    let mut plan = Plan::default();

    for alias in selected {
        if !hosts.iter().any(|h| &h.alias == alias) {
            plan.skipped.push(Skipped { alias: alias.clone(), reason: "Not found in the ssh config".into() });
        }
    }

    let mut planned_hosts: Vec<&ConfigHost> = Vec::new();
    for host in hosts.iter().filter(|h| selected.contains(&h.alias)) {
        if is_imported(host, existing) {
            plan.skipped.push(Skipped { alias: host.alias.clone(), reason: "Already imported".into() });
        } else if let Some(twin) = planned_hosts
            .iter()
            .find(|p| p.hostname.eq_ignore_ascii_case(&host.hostname) && p.user == host.user && p.port == host.port)
        {
            plan.skipped.push(Skipped { alias: host.alias.clone(), reason: format!("Same target as {}", twin.alias) });
        } else {
            planned_hosts.push(host);
        }
    }

    let ids: Vec<String> = planned_hosts.iter().map(|_| new_id()).collect();

    // Resolves a ProxyJump hop to a connection id: another host being
    // imported, a config host already saved, or any saved connection.
    let find_jump = |token: &str| -> Option<String> {
        if let Some(i) = planned_hosts.iter().position(|h| h.alias == token) {
            return Some(ids[i].clone());
        }
        if let Some(h) = hosts.iter().find(|h| h.alias == token) {
            if let Some(c) = existing_match(h, existing) {
                return Some(c.id.clone());
            }
        }
        if let Some(c) = existing.iter().find(|c| c.name == token) {
            return Some(c.id.clone());
        }
        let (user, host, port) = split_hop(token);
        existing
            .iter()
            .find(|c| {
                c.host.eq_ignore_ascii_case(host)
                    && user.is_none_or(|u| c.username == u)
                    && port.is_none_or(|p| c.port == p)
            })
            .map(|c| c.id.clone())
    };

    for (host, id) in planned_hosts.iter().zip(&ids) {
        let mut key_id = None;
        let mut failed = Vec::new();
        for file in &host.identity_files {
            match resolve_key(file) {
                Some(k) => {
                    key_id = Some(k);
                    break;
                }
                None => failed.push(file),
            }
        }
        if key_id.is_none() {
            for file in failed {
                plan.warnings.push(format!("{}: IdentityFile {file} could not be imported", host.alias));
            }
        }
        let auth_method = if key_id.is_some() {
            "key"
        } else if host.forward_agent {
            "agent"
        } else {
            "password"
        };

        let jump_host_id = match host.proxy_jump.as_deref() {
            None => None,
            Some(spec) if spec.contains(',') => {
                plan.warnings.push(format!("{}: multi-hop ProxyJump {spec} is not supported", host.alias));
                None
            }
            Some(spec) => {
                let found = find_jump(spec);
                if found.is_none() {
                    plan.warnings
                        .push(format!("{}: jump host {spec} is neither saved nor imported", host.alias));
                }
                found
            }
        };

        let mut forwards = Vec::new();
        for f in &host.local_forwards {
            forwards.push(PortForward {
                id: new_id(),
                connection_id: id.clone(),
                port_forward_type: "local".into(),
                local_port: i32::from(f.bind_port),
                remote_host: f.host.clone(),
                remote_port: i32::from(f.port),
                is_active: false,
                created_at: String::new(),
                updated_at: String::new(),
            });
        }
        if !host.remote_forwards.is_empty() {
            plan.warnings.push(format!("{}: RemoteForward is not supported and was not imported", host.alias));
        }
        if !host.dynamic_forwards.is_empty() {
            plan.warnings.push(format!("{}: DynamicForward is not supported and was not imported", host.alias));
        }

        plan.connections.push(PlannedConnection {
            profile: ConnectionProfile {
                id: id.clone(),
                name: host.alias.clone(),
                host: host.hostname.clone(),
                port: i32::from(host.port),
                username: host.user.clone(),
                auth_method: auth_method.into(),
                private_key_id: key_id,
                jump_host_id,
                startup_commands: None,
                color_tag: None,
                folder_path: String::new(),
                sort_order: 0,
                theme_override: None,
                agent_forwarding: host.forward_agent,
                env_vars: "{}".into(),
                created_at: String::new(),
                updated_at: String::new(),
            },
            forwards,
        });
    }

    break_jump_cycles(&mut plan);
    plan
}

/// The stored algorithm ("rsa" or "ed25519") for a private key file the app
/// can use, or `None` when the text is not a key or needs a passphrase.
/// `public_key` is the matching `.pub` text (may be empty) and wins when it says RSA.
pub fn classify_key(pem: &str, public_key: &str) -> Option<&'static str> {
    if !pem.contains("PRIVATE KEY-----") || pem.contains("ENCRYPTED") {
        return None;
    }
    let body = pem.lines().find(|l| !l.starts_with("-----")).unwrap_or("");
    // base64 of "openssh-key-v1\0" + cipher "none": anything else is passphrase-protected.
    if pem.contains("BEGIN OPENSSH PRIVATE KEY") && !body.starts_with("b3BlbnNzaC1rZXktdjEAAAAABG5vbmU") {
        return None;
    }
    if public_key.trim_start().starts_with("ssh-rsa") || pem.contains("BEGIN RSA PRIVATE KEY") {
        Some("rsa")
    } else {
        Some("ed25519")
    }
}

/// A jump chain that loops back on itself can never connect; unlink the host
/// that closes it.
fn break_jump_cycles(plan: &mut Plan) {
    for i in 0..plan.connections.len() {
        let start = plan.connections[i].profile.id.clone();
        let mut next = plan.connections[i].profile.jump_host_id.clone();
        let mut steps = 0;
        while let Some(id) = next {
            if id == start {
                plan.connections[i].profile.jump_host_id = None;
                let name = plan.connections[i].profile.name.clone();
                plan.warnings.push(format!("{name}: ProxyJump cycle removed"));
                break;
            }
            steps += 1;
            if steps > plan.connections.len() {
                break;
            }
            next = plan
                .connections
                .iter()
                .find(|c| c.profile.id == id)
                .and_then(|c| c.profile.jump_host_id.clone());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ssh_config::ForwardSpec;

    fn host(alias: &str) -> ConfigHost {
        ConfigHost {
            alias: alias.into(),
            hostname: format!("{alias}.example.com"),
            user: "me".into(),
            port: 22,
            identity_files: vec![],
            proxy_jump: None,
            forward_agent: false,
            local_forwards: vec![],
            remote_forwards: vec![],
            dynamic_forwards: vec![],
        }
    }

    fn saved(id: &str, name: &str, host: &str, user: &str, port: i32) -> ConnectionProfile {
        ConnectionProfile {
            id: id.into(),
            name: name.into(),
            host: host.into(),
            port,
            username: user.into(),
            auth_method: "password".into(),
            private_key_id: None,
            jump_host_id: None,
            startup_commands: None,
            color_tag: None,
            folder_path: String::new(),
            sort_order: 0,
            theme_override: None,
            agent_forwarding: false,
            env_vars: "{}".into(),
            created_at: String::new(),
            updated_at: String::new(),
        }
    }

    fn run(hosts: &[ConfigHost], selected: &[&str], existing: &[ConnectionProfile]) -> Plan {
        let selected: Vec<String> = selected.iter().map(|s| s.to_string()).collect();
        let mut n = 0;
        plan_import(
            hosts,
            &selected,
            existing,
            &mut |path| path.contains("good").then(|| format!("key-for-{path}")),
            &mut || {
                n += 1;
                format!("id{n}")
            },
        )
    }

    #[test]
    fn creates_a_connection_from_a_host() {
        let mut h = host("web");
        h.user = "deploy".into();
        h.port = 2200;
        let plan = run(&[h], &["web"], &[]);
        let p = &plan.connections[0].profile;
        assert_eq!((p.name.as_str(), p.host.as_str(), p.username.as_str(), p.port), ("web", "web.example.com", "deploy", 2200));
        assert_eq!(p.auth_method, "password");
        assert!(!p.id.is_empty());
        assert_eq!(p.env_vars, "{}");
    }

    #[test]
    fn only_selected_aliases_are_imported_and_unknown_ones_reported() {
        let plan = run(&[host("a"), host("b")], &["b", "ghost"], &[]);
        assert_eq!(plan.connections.len(), 1);
        assert_eq!(plan.connections[0].profile.name, "b");
        assert_eq!(plan.skipped.len(), 1);
        assert_eq!(plan.skipped[0].alias, "ghost");
    }

    #[test]
    fn existing_connection_with_same_target_is_skipped() {
        let existing = [saved("x", "other name", "WEB.example.com", "me", 22)];
        let plan = run(&[host("web")], &["web"], &existing);
        assert!(plan.connections.is_empty());
        assert_eq!(plan.skipped[0].alias, "web");
        assert!(plan.skipped[0].reason.contains("Already"));
        assert!(is_imported(&host("web"), &existing));
        assert!(!is_imported(&host("db"), &existing));
    }

    #[test]
    fn different_user_or_port_is_not_a_duplicate() {
        let existing = [saved("x", "web", "web.example.com", "root", 22), saved("y", "web", "web.example.com", "me", 2222)];
        assert_eq!(run(&[host("web")], &["web"], &existing).connections.len(), 1);
    }

    #[test]
    fn two_aliases_for_one_target_import_once() {
        let mut b = host("b");
        b.hostname = "a.example.com".into();
        let plan = run(&[host("a"), b], &["a", "b"], &[]);
        assert_eq!(plan.connections.len(), 1);
        assert_eq!(plan.skipped[0].alias, "b");
    }

    #[test]
    fn identity_file_becomes_key_auth_when_the_key_imports() {
        let mut h = host("k");
        h.identity_files = vec!["/missing".into(), "/keys/good_ed25519".into()];
        let plan = run(&[h], &["k"], &[]);
        let p = &plan.connections[0].profile;
        assert_eq!(p.auth_method, "key");
        assert_eq!(p.private_key_id.as_deref(), Some("key-for-/keys/good_ed25519"));
    }

    #[test]
    fn unreadable_identity_files_warn_and_fall_back_to_password() {
        let mut h = host("k");
        h.identity_files = vec!["/missing".into()];
        let plan = run(&[h], &["k"], &[]);
        assert_eq!(plan.connections[0].profile.auth_method, "password");
        assert!(plan.warnings.iter().any(|w| w.contains('k') && w.contains("/missing")), "{:?}", plan.warnings);
    }

    #[test]
    fn forward_agent_maps_and_selects_agent_auth_without_a_key() {
        let mut h = host("fa");
        h.forward_agent = true;
        let p = &run(&[h], &["fa"], &[]).connections[0].profile;
        assert!(p.agent_forwarding);
        assert_eq!(p.auth_method, "agent");
    }

    #[test]
    fn local_forwards_become_port_forwards_others_warn() {
        let mut h = host("tun");
        h.local_forwards = vec![ForwardSpec { bind_port: 8080, host: "localhost".into(), port: 80 }];
        h.remote_forwards = vec![ForwardSpec { bind_port: 9090, host: "localhost".into(), port: 3000 }];
        h.dynamic_forwards = vec![1080];
        let plan = run(&[h], &["tun"], &[]);
        let c = &plan.connections[0];
        assert_eq!(c.forwards.len(), 1);
        let f = &c.forwards[0];
        assert_eq!((f.port_forward_type.as_str(), f.local_port, f.remote_host.as_str(), f.remote_port), ("local", 8080, "localhost", 80));
        assert_eq!(f.connection_id, c.profile.id);
        assert!(!f.is_active);
        assert!(plan.warnings.iter().any(|w| w.contains("RemoteForward")));
        assert!(plan.warnings.iter().any(|w| w.contains("DynamicForward")));
    }

    #[test]
    fn proxy_jump_to_an_imported_alias_links_the_new_ids() {
        let mut inner = host("inner");
        inner.proxy_jump = Some("bastion".into());
        let plan = run(&[inner, host("bastion")], &["inner", "bastion"], &[]);
        let by = |n: &str| plan.connections.iter().find(|c| c.profile.name == n).unwrap().profile.clone();
        assert_eq!(by("inner").jump_host_id.as_deref(), Some(by("bastion").id.as_str()));
        assert_eq!(by("bastion").jump_host_id, None);
    }

    #[test]
    fn proxy_jump_to_an_already_saved_alias_uses_the_saved_id() {
        let mut inner = host("inner");
        inner.proxy_jump = Some("bastion".into());
        let existing = [saved("saved-bastion", "bastion", "bastion.example.com", "me", 22)];
        let plan = run(&[inner, host("bastion")], &["inner"], &existing);
        assert_eq!(plan.connections[0].profile.jump_host_id.as_deref(), Some("saved-bastion"));
    }

    #[test]
    fn proxy_jump_by_user_host_port_matches_a_saved_connection() {
        let mut inner = host("inner");
        inner.proxy_jump = Some("ops@jump.example.com:2022".into());
        let existing = [saved("j", "jumpbox", "jump.example.com", "ops", 2022)];
        let plan = run(&[inner], &["inner"], &existing);
        assert_eq!(plan.connections[0].profile.jump_host_id.as_deref(), Some("j"));
    }

    #[test]
    fn unresolvable_or_multi_hop_proxy_jump_warns_and_stays_unlinked() {
        let mut a = host("a");
        a.proxy_jump = Some("nowhere".into());
        let mut b = host("b");
        b.proxy_jump = Some("x,y".into());
        let plan = run(&[a, b], &["a", "b"], &[]);
        assert!(plan.connections.iter().all(|c| c.profile.jump_host_id.is_none()));
        assert!(plan.warnings.iter().any(|w| w.starts_with("a:") && w.contains("nowhere")), "{:?}", plan.warnings);
        assert!(plan.warnings.iter().any(|w| w.starts_with("b:") && w.contains("multi")), "{:?}", plan.warnings);
    }

    #[test]
    fn key_files_are_classified() {
        let open = "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZWQyNTUxOQ\n-----END OPENSSH PRIVATE KEY-----\n";
        assert_eq!(classify_key(open, ""), Some("ed25519"));
        let enc = "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1jdHIAAAAGYmNyeXB0AAAAGAAAABD\n-----END OPENSSH PRIVATE KEY-----\n";
        assert_eq!(classify_key(enc, ""), None);
        let rsa = "-----BEGIN RSA PRIVATE KEY-----\nMIIEow\n-----END RSA PRIVATE KEY-----\n";
        assert_eq!(classify_key(rsa, ""), Some("rsa"));
        let rsa_enc = "-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-128-CBC,AB\n\nMIIEow\n-----END RSA PRIVATE KEY-----\n";
        assert_eq!(classify_key(rsa_enc, ""), None);
        let pkcs8_enc = "-----BEGIN ENCRYPTED PRIVATE KEY-----\nMIIFH\n-----END ENCRYPTED PRIVATE KEY-----\n";
        assert_eq!(classify_key(pkcs8_enc, ""), None);
        assert_eq!(classify_key("not a key", ""), None);
        assert_eq!(classify_key(open, "ssh-rsa AAAA user@host"), Some("rsa"));
    }

    #[test]
    fn jump_cycles_are_broken() {
        let mut a = host("a");
        a.proxy_jump = Some("b".into());
        let mut b = host("b");
        b.proxy_jump = Some("a".into());
        let plan = run(&[a, b], &["a", "b"], &[]);
        let linked = plan.connections.iter().filter(|c| c.profile.jump_host_id.is_some()).count();
        assert!(linked < 2, "a jump cycle must not be saved");
        assert!(plan.warnings.iter().any(|w| w.to_lowercase().contains("cycle")));
    }
}
