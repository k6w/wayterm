use super::*;
use std::fs;

struct Tmp(PathBuf);
impl Tmp {
    fn new() -> Self {
        let p = std::env::temp_dir().join(format!("nexterm_sshcfg_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(p.join(".ssh")).unwrap();
        Tmp(p)
    }
    fn write(&self, rel: &str, text: &str) -> PathBuf {
        let p = self.0.join(".ssh").join(rel);
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(&p, text).unwrap();
        p
    }
    fn env(&self) -> Env {
        Env { home: self.0.clone(), ssh_dir: self.0.join(".ssh"), user: "me".into() }
    }
    fn parse(&self) -> ParseOutput {
        parse_file(&self.0.join(".ssh").join("config"), &self.env())
    }
}
impl Drop for Tmp {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn host<'a>(out: &'a ParseOutput, alias: &str) -> &'a ConfigHost {
    out.hosts.iter().find(|h| h.alias == alias).unwrap_or_else(|| panic!("no host {alias}: {:?}", out.hosts))
}

#[test]
fn basic_host_with_defaults() {
    let t = Tmp::new();
    t.write("config", "Host web\n  HostName 10.0.0.5\n  User deploy\n  Port 2200\n");
    let out = t.parse();
    assert_eq!(out.hosts.len(), 1);
    let h = host(&out, "web");
    assert_eq!((h.hostname.as_str(), h.user.as_str(), h.port), ("10.0.0.5", "deploy", 2200));
}

#[test]
fn missing_options_default_to_alias_current_user_and_22() {
    let t = Tmp::new();
    t.write("config", "Host bare\n");
    let h = &t.parse().hosts[0];
    assert_eq!((h.hostname.as_str(), h.user.as_str(), h.port), ("bare", "me", 22));
}

#[test]
fn missing_file_yields_nothing() {
    let t = Tmp::new();
    let out = t.parse();
    assert!(out.hosts.is_empty());
    assert!(out.warnings.is_empty());
}

#[test]
fn comments_quotes_and_equals_syntax() {
    let t = Tmp::new();
    t.write(
        "config",
        "# top comment\nHost=eq\n  HostName=eq.example.com # trailing\n  User = \"quoted user\"\n  Port=\"2022\"\n\nHost sp\n\tHostName   sp.example.com\n",
    );
    let out = t.parse();
    let eq = host(&out, "eq");
    assert_eq!(eq.hostname, "eq.example.com");
    assert_eq!(eq.user, "quoted user");
    assert_eq!(eq.port, 2022);
    assert_eq!(host(&out, "sp").hostname, "sp.example.com");
}

#[test]
fn keywords_are_case_insensitive() {
    let t = Tmp::new();
    t.write("config", "HOST a\n  HOSTNAME a.example.com\n  USER bob\n");
    let h = &t.parse().hosts[0];
    assert_eq!((h.hostname.as_str(), h.user.as_str()), ("a.example.com", "bob"));
}

#[test]
fn wildcard_hosts_are_not_entries_but_supply_defaults() {
    let t = Tmp::new();
    t.write(
        "config",
        "Host web\n  HostName web.example.com\nHost *.example.com\n  User corp\nHost *\n  User fallback\n  Port 2222\n  ForwardAgent yes\n",
    );
    let out = t.parse();
    assert_eq!(out.hosts.len(), 1);
    let h = host(&out, "web");
    // `web` does not match *.example.com (the alias is matched, not HostName).
    assert_eq!(h.user, "fallback");
    assert_eq!(h.port, 2222);
    assert!(h.forward_agent);
}

#[test]
fn wildcard_block_applies_to_matching_alias() {
    let t = Tmp::new();
    t.write("config", "Host *.corp\n  User corp\nHost a.corp\n  User ignored\n");
    assert_eq!(t.parse().hosts[0].user, "corp");
}

#[test]
fn first_match_wins_regardless_of_specificity() {
    let t = Tmp::new();
    t.write(
        "config",
        "Host *\n  User first\nHost special\n  User second\n  HostName special.example.com\n",
    );
    let h = &t.parse().hosts[0];
    assert_eq!(h.user, "first");
    assert_eq!(h.hostname, "special.example.com");
}

#[test]
fn options_before_any_host_apply_to_all() {
    let t = Tmp::new();
    t.write("config", "User global\nHost a\nHost b\n  User own\n");
    let out = t.parse();
    assert_eq!(host(&out, "a").user, "global");
    assert_eq!(host(&out, "b").user, "global");
}

#[test]
fn multiple_patterns_and_negation() {
    let t = Tmp::new();
    t.write(
        "config",
        "Host a b !c\n  User multi\nHost prod-* !prod-skip\n  Port 2200\nHost prod-1 prod-skip\n  HostName x\n",
    );
    let out = t.parse();
    assert_eq!(host(&out, "a").user, "multi");
    assert_eq!(host(&out, "b").user, "multi");
    assert!(out.hosts.iter().all(|h| !h.alias.starts_with('!')));
    assert_eq!(host(&out, "prod-1").port, 2200);
    assert_eq!(host(&out, "prod-skip").port, 22);
}

#[test]
fn duplicate_alias_is_listed_once() {
    let t = Tmp::new();
    t.write("config", "Host a\n  User one\nHost a\n  User two\n");
    let out = t.parse();
    assert_eq!(out.hosts.len(), 1);
    assert_eq!(out.hosts[0].user, "one");
}

#[test]
fn identity_files_accumulate_and_expand_tokens() {
    let t = Tmp::new();
    t.write(
        "config",
        "Host app\n  HostName app.example.com\n  User deploy\n  Port 2200\n  IdentityFile ~/.ssh/id_%r\n  IdentityFile %d/keys/%h_%p_%u\n  IdentityFile /abs/100%%\nHost *\n  IdentityFile ~/.ssh/default\n",
    );
    let h = &t.parse().hosts[0];
    let home = t.0.to_string_lossy().to_string();
    assert_eq!(
        h.identity_files,
        vec![
            format!("{home}/.ssh/id_deploy"),
            format!("{home}/keys/app.example.com_2200_me"),
            "/abs/100%".to_string(),
            format!("{home}/.ssh/default"),
        ]
    );
}

#[test]
fn hostname_percent_h_expands_to_alias() {
    let t = Tmp::new();
    t.write("config", "Host db\n  HostName %h.internal\n");
    assert_eq!(t.parse().hosts[0].hostname, "db.internal");
}

#[test]
fn proxy_jump_and_none() {
    let t = Tmp::new();
    t.write("config", "Host in\n  ProxyJump bastion\nHost out\n  ProxyJump none\nHost bastion\n");
    let out = t.parse();
    assert_eq!(host(&out, "in").proxy_jump.as_deref(), Some("bastion"));
    assert_eq!(host(&out, "out").proxy_jump, None);
}

#[test]
fn proxy_command_without_jump_warns() {
    let t = Tmp::new();
    t.write("config", "Host x\n  ProxyCommand nc %h %p\n");
    let out = t.parse();
    assert!(out.warnings.iter().any(|w| w.contains("ProxyCommand") && w.contains('x')), "{:?}", out.warnings);
}

#[test]
fn forwards_are_parsed() {
    let t = Tmp::new();
    t.write(
        "config",
        "Host tun\n  LocalForward 8080 localhost:80\n  LocalForward 127.0.0.1:5433 db.internal:5432\n  LocalForward 9000 [::1]:9001\n  RemoteForward 9090 localhost:3000\n  DynamicForward 1080\n  DynamicForward localhost:1081\n",
    );
    let h = &t.parse().hosts[0];
    let f = |b, host: &str, p| ForwardSpec { bind_port: b, host: host.into(), port: p };
    assert_eq!(h.local_forwards, vec![f(8080, "localhost", 80), f(5433, "db.internal", 5432), f(9000, "::1", 9001)]);
    assert_eq!(h.remote_forwards, vec![f(9090, "localhost", 3000)]);
    assert_eq!(h.dynamic_forwards, vec![1080, 1081]);
}

#[test]
fn bad_forward_is_a_warning_not_a_failure() {
    let t = Tmp::new();
    t.write("config", "Host tun\n  LocalForward nonsense\n  HostName t\n");
    let out = t.parse();
    assert_eq!(out.hosts[0].hostname, "t");
    assert!(out.hosts[0].local_forwards.is_empty());
    assert!(out.warnings.iter().any(|w| w.contains("LocalForward")), "{:?}", out.warnings);
}

#[test]
fn match_blocks_are_skipped_with_a_warning() {
    let t = Tmp::new();
    t.write(
        "config",
        "Host a\n  HostName a.example.com\nMatch host a exec \"true\"\n  User hidden\n  Port 9999\nHost b\n  HostName b.example.com\n",
    );
    let out = t.parse();
    assert_eq!(host(&out, "a").user, "me");
    assert_eq!(host(&out, "a").port, 22);
    assert_eq!(host(&out, "b").hostname, "b.example.com");
    assert!(out.warnings.iter().any(|w| w.contains("Match")), "{:?}", out.warnings);
}

#[test]
fn include_with_glob_relative_to_ssh_dir() {
    let t = Tmp::new();
    t.write("config", "Include conf.d/*.conf\nHost main\n  HostName main.example.com\n");
    t.write("conf.d/10-a.conf", "Host a\n  HostName a.example.com\n");
    t.write("conf.d/20-b.conf", "Host b\n  HostName b.example.com\n");
    t.write("conf.d/ignored.txt", "Host nope\n");
    let out = t.parse();
    let aliases: Vec<_> = out.hosts.iter().map(|h| h.alias.as_str()).collect();
    assert_eq!(aliases, vec!["a", "b", "main"]);
}

#[test]
fn include_absolute_and_tilde_and_missing() {
    let t = Tmp::new();
    let abs = t.write("abs.conf", "Host abs\n");
    t.write(
        "config",
        &format!("Include {}\nInclude ~/.ssh/tilde.conf\nInclude nothing-here\nInclude nothing/*.conf\n", abs.display()),
    );
    t.write("tilde.conf", "Host tilde\n");
    let out = t.parse();
    assert_eq!(out.hosts.len(), 2);
    assert!(out.warnings.is_empty(), "{:?}", out.warnings);
}

#[test]
fn include_precedence_follows_position() {
    let t = Tmp::new();
    t.write("config", "Host x\n  User early\nInclude late.conf\n");
    t.write("late.conf", "Host x\n  User late\n  Port 2200\n");
    let h = &t.parse().hosts[0];
    assert_eq!(h.user, "early");
    assert_eq!(h.port, 2200);
}

#[test]
fn include_inside_host_block_extends_that_block() {
    let t = Tmp::new();
    t.write("config", "Host a\n  Include extra.conf\nHost b\n");
    t.write("extra.conf", "User from_include\n");
    let out = t.parse();
    assert_eq!(host(&out, "a").user, "from_include");
    assert_eq!(host(&out, "b").user, "me");
}

#[test]
fn include_cycles_terminate_with_a_warning() {
    let t = Tmp::new();
    t.write("config", "Include a.conf\nHost root\n");
    t.write("a.conf", "Host a\nInclude b.conf\n");
    t.write("b.conf", "Host b\nInclude a.conf\nInclude config\n");
    let out = t.parse();
    let aliases: Vec<_> = out.hosts.iter().map(|h| h.alias.as_str()).collect();
    assert_eq!(aliases, vec!["a", "b", "root"]);
    assert!(out.warnings.iter().any(|w| w.to_lowercase().contains("cycl")), "{:?}", out.warnings);
}

#[test]
fn include_depth_is_limited() {
    let t = Tmp::new();
    t.write("config", "Include l1.conf\n");
    for i in 1..=8 {
        t.write(&format!("l{i}.conf"), &format!("Host h{i}\nInclude l{}.conf\n", i + 1));
    }
    let out = t.parse();
    assert_eq!(out.hosts.len(), MAX_INCLUDE_DEPTH, "{:?}", out.hosts.iter().map(|h| &h.alias).collect::<Vec<_>>());
    assert!(out.warnings.iter().any(|w| w.to_lowercase().contains("depth")), "{:?}", out.warnings);
}

#[test]
fn glob_does_not_match_dotfiles() {
    let t = Tmp::new();
    t.write("config", "Include d/*\n");
    t.write("d/.hidden", "Host hidden\n");
    t.write("d/shown", "Host shown\n");
    let out = t.parse();
    assert_eq!(out.hosts.len(), 1);
    assert_eq!(out.hosts[0].alias, "shown");
}
