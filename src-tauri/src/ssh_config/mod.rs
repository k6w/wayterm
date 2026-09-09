//! Reader for the user's OpenSSH client config (`~/.ssh/config`).
//!
//! Enumerates the concrete `Host` aliases and resolves each one with OpenSSH's
//! first-match-wins rules, so defaults from `Host *` blocks apply to every
//! alias that does not set the option itself. `Match` blocks are skipped.

pub mod import;

use std::path::{Path, PathBuf};

/// Include nesting beyond this is ignored (OpenSSH uses the same limit).
pub const MAX_INCLUDE_DEPTH: usize = 5;

/// Where tokens like `~` and `%d` point, and which directory relative
/// `Include` paths resolve against.
#[derive(Debug, Clone)]
pub struct Env {
    pub home: PathBuf,
    pub ssh_dir: PathBuf,
    pub user: String,
}

impl Env {
    /// The real user's environment, or `None` without a home directory.
    pub fn current() -> Option<Env> {
        let home = dirs::home_dir()?;
        let user = std::env::var("USER")
            .or_else(|_| std::env::var("USERNAME"))
            .unwrap_or_else(|_| "user".to_string());
        Some(Env { ssh_dir: home.join(".ssh"), home, user })
    }
}

/// A `[bind:]port host:port` forward as written in the config.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ForwardSpec {
    pub bind_port: u16,
    pub host: String,
    pub port: u16,
}

/// One concrete host alias with every option resolved.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigHost {
    pub alias: String,
    pub hostname: String,
    pub user: String,
    pub port: u16,
    pub identity_files: Vec<String>,
    pub proxy_jump: Option<String>,
    pub forward_agent: bool,
    pub local_forwards: Vec<ForwardSpec>,
    pub remote_forwards: Vec<ForwardSpec>,
    pub dynamic_forwards: Vec<u16>,
}

#[derive(Debug, Default, Clone)]
pub struct ParseOutput {
    pub hosts: Vec<ConfigHost>,
    pub warnings: Vec<String>,
}

struct Block {
    patterns: Vec<String>,
    is_match: bool,
    options: Vec<(String, Vec<String>)>,
}

struct Parser<'a> {
    env: &'a Env,
    blocks: Vec<Block>,
    warnings: Vec<String>,
    stack: Vec<PathBuf>,
}

/// Parses `path` (normally `~/.ssh/config`) and everything it includes.
pub fn parse_file(path: &Path, env: &Env) -> ParseOutput {
    let mut parser = Parser {
        env,
        blocks: vec![Block { patterns: vec!["*".to_string()], is_match: false, options: Vec::new() }],
        warnings: Vec::new(),
        stack: Vec::new(),
    };
    parser.read_file(path, 0);
    parser.resolve()
}

impl Parser<'_> {
    fn read_file(&mut self, path: &Path, depth: usize) {
        if depth > MAX_INCLUDE_DEPTH {
            self.warnings.push(format!(
                "Include depth limit ({MAX_INCLUDE_DEPTH}) reached; {} was not read",
                path.display()
            ));
            return;
        }
        let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
        if self.stack.contains(&canonical) {
            self.warnings.push(format!("Include cycle at {} ignored", path.display()));
            return;
        }
        let Ok(text) = std::fs::read_to_string(path) else { return };
        self.stack.push(canonical);
        let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();

        for (index, raw) in text.lines().enumerate() {
            let line = raw.trim_start();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            let key_end = line.find(|c: char| c.is_whitespace() || c == '=').unwrap_or(line.len());
            let key = line[..key_end].to_ascii_lowercase();
            let rest = line[key_end..].trim_start();
            let rest = rest.strip_prefix('=').unwrap_or(rest).trim_start();
            let args = split_args(rest);

            match key.as_str() {
                "host" => self.blocks.push(Block { patterns: args, is_match: false, options: Vec::new() }),
                "match" => {
                    self.warnings.push(format!("Match block at {name}:{} was skipped (not supported)", index + 1));
                    self.blocks.push(Block { patterns: Vec::new(), is_match: true, options: Vec::new() });
                }
                "include" => {
                    for pattern in &args {
                        for file in expand_include(pattern, self.env) {
                            self.read_file(&file, depth + 1);
                        }
                    }
                }
                _ => {
                    if let Some(block) = self.blocks.last_mut() {
                        block.options.push((key, args));
                    }
                }
            }
        }
        self.stack.pop();
    }

    fn resolve(mut self) -> ParseOutput {
        let mut aliases: Vec<String> = Vec::new();
        for block in self.blocks.iter().filter(|b| !b.is_match) {
            for p in &block.patterns {
                if !p.starts_with('!') && !has_wildcard(p) && !aliases.contains(p) {
                    aliases.push(p.clone());
                }
            }
        }
        let mut hosts = Vec::new();
        for alias in aliases {
            let host = self.resolve_alias(&alias);
            hosts.push(host);
        }
        ParseOutput { hosts, warnings: self.warnings }
    }

    fn resolve_alias(&mut self, alias: &str) -> ConfigHost {
        let applicable: Vec<&Block> = self.blocks.iter().filter(|b| applies(b, alias)).collect();
        let all = |key: &str| -> Vec<&Vec<String>> {
            applicable
                .iter()
                .flat_map(|b| b.options.iter())
                .filter(|(k, _)| k == key)
                .map(|(_, v)| v)
                .collect()
        };
        let first = |key: &str, valid: &dyn Fn(&str) -> bool| -> Option<String> {
            all(key).into_iter().filter_map(|v| v.first()).find(|v| valid(v)).cloned()
        };
        let any = |_: &str| true;

        let hostname = first("hostname", &any)
            .map(|h| h.replace("%h", alias).replace("%%", "%"))
            .unwrap_or_else(|| alias.to_string());
        let user = first("user", &any).unwrap_or_else(|| self.env.user.clone());
        let port = first("port", &|v| v.parse::<u16>().is_ok_and(|p| p > 0))
            .and_then(|v| v.parse().ok())
            .unwrap_or(22);

        let identity_files = all("identityfile")
            .into_iter()
            .filter_map(|v| v.first())
            .map(|v| expand_path_tokens(v, self.env, &hostname, port, &user))
            .collect();

        let proxy_jump = first("proxyjump", &any).filter(|v| !v.eq_ignore_ascii_case("none"));
        let has_proxy_command = first("proxycommand", &|v| !v.eq_ignore_ascii_case("none")).is_some();
        let forward_agent = first("forwardagent", &any)
            .is_some_and(|v| !v.eq_ignore_ascii_case("no") && !v.eq_ignore_ascii_case("false"));

        let mut warnings = Vec::new();
        if has_proxy_command && proxy_jump.is_none() {
            warnings.push(format!("{alias}: ProxyCommand is not supported; connect directly or use a jump host"));
        }
        let mut forwards = |key: &str, label: &str| -> Vec<ForwardSpec> {
            all(key)
                .into_iter()
                .filter_map(|args| {
                    let parsed = parse_forward(args);
                    if parsed.is_none() {
                        warnings.push(format!("{alias}: could not read {label} {}", args.join(" ")));
                    }
                    parsed
                })
                .collect()
        };
        let local_forwards = forwards("localforward", "LocalForward");
        let remote_forwards = forwards("remoteforward", "RemoteForward");
        let dynamic_forwards = all("dynamicforward")
            .into_iter()
            .filter_map(|args| {
                let port = args.first().and_then(|a| port_of(a));
                if port.is_none() {
                    warnings.push(format!("{alias}: could not read DynamicForward {}", args.join(" ")));
                }
                port
            })
            .collect();

        self.warnings.extend(warnings);
        ConfigHost {
            alias: alias.to_string(),
            hostname,
            user,
            port,
            identity_files,
            proxy_jump,
            forward_agent,
            local_forwards,
            remote_forwards,
            dynamic_forwards,
        }
    }
}

fn has_wildcard(pattern: &str) -> bool {
    pattern.contains(['*', '?'])
}

fn applies(block: &Block, alias: &str) -> bool {
    if block.is_match {
        return false;
    }
    let mut matched = false;
    for p in &block.patterns {
        if let Some(negated) = p.strip_prefix('!') {
            if wildcard_match(negated, alias, true) {
                return false;
            }
        } else if wildcard_match(p, alias, true) {
            matched = true;
        }
    }
    matched
}

/// `*` and `?` glob matching. Host patterns ignore case; file globs do not.
fn wildcard_match(pattern: &str, text: &str, ignore_case: bool) -> bool {
    let norm = |s: &str| -> Vec<char> {
        if ignore_case { s.to_lowercase().chars().collect() } else { s.chars().collect() }
    };
    let (p, t) = (norm(pattern), norm(text));
    let (mut pi, mut ti) = (0, 0);
    let mut star: Option<(usize, usize)> = None;
    while ti < t.len() {
        if pi < p.len() && (p[pi] == '?' || p[pi] == t[ti]) && p[pi] != '*' {
            pi += 1;
            ti += 1;
        } else if pi < p.len() && p[pi] == '*' {
            star = Some((pi, ti));
            pi += 1;
        } else if let Some((sp, st)) = star {
            pi = sp + 1;
            ti = st + 1;
            star = Some((sp, st + 1));
        } else {
            return false;
        }
    }
    while pi < p.len() && p[pi] == '*' {
        pi += 1;
    }
    pi == p.len()
}

/// Whitespace-separated words with double quotes; an unquoted `#` starts a comment.
fn split_args(text: &str) -> Vec<String> {
    let mut args = Vec::new();
    let mut current = String::new();
    let mut in_token = false;
    let mut quoted = false;
    let mut chars = text.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '"' => {
                quoted = !quoted;
                in_token = true;
            }
            '\\' if quoted && matches!(chars.peek(), Some('"') | Some('\\')) => {
                current.push(chars.next().unwrap_or('\\'));
            }
            '#' if !quoted && !in_token => break,
            c if c.is_whitespace() && !quoted => {
                if in_token {
                    args.push(std::mem::take(&mut current));
                    in_token = false;
                }
            }
            c => {
                current.push(c);
                in_token = true;
            }
        }
    }
    if in_token {
        args.push(current);
    }
    args
}

fn port_of(spec: &str) -> Option<u16> {
    let tail = spec.rsplit(':').next()?;
    tail.parse::<u16>().ok().filter(|p| *p > 0)
}

fn parse_forward(args: &[String]) -> Option<ForwardSpec> {
    let [listen, target] = args else { return None };
    let bind_port = port_of(listen)?;
    let (host, port) = target.rsplit_once(':')?;
    let port = port.parse::<u16>().ok().filter(|p| *p > 0)?;
    let host = host.trim_start_matches('[').trim_end_matches(']');
    if host.is_empty() {
        return None;
    }
    Some(ForwardSpec { bind_port, host: host.to_string(), port })
}

/// Expands `%%`, `%d`, `%u`, `%h`, `%r`, `%p` and a leading `~`.
fn expand_path_tokens(value: &str, env: &Env, host: &str, port: u16, remote_user: &str) -> String {
    let home = env.home.to_string_lossy();
    let mut out = String::new();
    let mut chars = value.chars();
    while let Some(c) = chars.next() {
        if c != '%' {
            out.push(c);
            continue;
        }
        match chars.next() {
            Some('%') => out.push('%'),
            Some('d') => out.push_str(&home),
            Some('u') => out.push_str(&env.user),
            Some('h') => out.push_str(host),
            Some('r') => out.push_str(remote_user),
            Some('p') => out.push_str(&port.to_string()),
            Some(other) => {
                out.push('%');
                out.push(other);
            }
            None => out.push('%'),
        }
    }
    expand_tilde(&out, &env.home)
}

fn expand_tilde(value: &str, home: &Path) -> String {
    if value == "~" {
        return home.to_string_lossy().to_string();
    }
    match value.strip_prefix("~/") {
        Some(rest) => format!("{}/{rest}", home.to_string_lossy()),
        None => value.to_string(),
    }
}

/// The files an `Include` argument names, sorted. Relative paths are relative
/// to `~/.ssh`; missing files and empty globs are silently nothing.
fn expand_include(pattern: &str, env: &Env) -> Vec<PathBuf> {
    let expanded = expand_tilde(pattern, &env.home);
    let path = PathBuf::from(&expanded);
    let path = if path.is_absolute() { path } else { env.ssh_dir.join(path) };

    let mut candidates: Vec<PathBuf> = vec![PathBuf::new()];
    for component in path.components() {
        let part = component.as_os_str().to_string_lossy().to_string();
        let is_name = matches!(component, std::path::Component::Normal(_));
        if is_name && has_wildcard(&part) {
            let mut next = Vec::new();
            for dir in &candidates {
                let Ok(entries) = std::fs::read_dir(dir) else { continue };
                let mut names: Vec<String> = entries
                    .filter_map(|e| e.ok())
                    .map(|e| e.file_name().to_string_lossy().to_string())
                    .filter(|n| (!n.starts_with('.') || part.starts_with('.')) && wildcard_match(&part, n, false))
                    .collect();
                names.sort();
                next.extend(names.into_iter().map(|n| dir.join(n)));
            }
            candidates = next;
        } else {
            candidates = candidates.into_iter().map(|c| c.join(component.as_os_str())).collect();
        }
    }
    candidates.retain(|p| p.is_file());
    candidates
}

#[cfg(test)]
mod tests;
