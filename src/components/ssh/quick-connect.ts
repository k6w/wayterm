export interface QuickConnectTarget {
  user: string;
  /** Unbracketed, so an IPv6 address is stored as `::1`. */
  host: string;
  port: number;
  /** False when `user` is the default rather than typed. */
  userGiven: boolean;
}

interface QuickConnectOptions {
  /** User to log in as when the input names none (the configured default, else the OS user). */
  defaultUser: string;
}

const USER = /^[A-Za-z0-9_][A-Za-z0-9_.+-]*$/;
const HOSTNAME = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?$/;
const IPV6 = /^(?=.*:.*:)[0-9A-Fa-f:.]+$/;

function parsePort(text: string): number | null {
  if (!/^\d{1,5}$/.test(text)) return null;
  const port = Number(text);
  return port >= 1 && port <= 65535 ? port : null;
}

/** `host`, `host:port`, `[v6]` or `[v6]:port`; the host must be safe to hand to ssh. */
function parseHostPort(text: string): { host: string; port: number | null } | null {
  if (text.startsWith("[")) {
    const close = text.indexOf("]");
    if (close < 0) return null;
    const host = text.slice(1, close);
    const rest = text.slice(close + 1);
    if (!IPV6.test(host)) return null;
    if (rest === "") return { host, port: null };
    if (!rest.startsWith(":")) return null;
    const port = parsePort(rest.slice(1));
    return port === null ? null : { host, port };
  }
  const colon = text.indexOf(":");
  const host = colon < 0 ? text : text.slice(0, colon);
  if (!HOSTNAME.test(host)) return null;
  if (colon < 0) return { host, port: null };
  const port = parsePort(text.slice(colon + 1));
  return port === null ? null : { host, port };
}

/** `[user@]host[:port]`. Returns the parts, or null when any part is not safe. */
function parseDestination(text: string): { user: string | null; host: string; port: number | null } | null {
  const at = text.indexOf("@");
  if (at !== text.lastIndexOf("@")) return null;
  let user: string | null = null;
  let rest = text;
  if (at >= 0) {
    user = text.slice(0, at);
    rest = text.slice(at + 1);
    if (!USER.test(user)) return null;
  }
  const hostPort = parseHostPort(rest);
  return hostPort ? { user, ...hostPort } : null;
}

/** The words of an `ssh` command line as a destination plus the only options we honour: -p and -l. */
function parseSshCommand(words: string[]): { destination: string; port: number | null; user: string | null } | null {
  let destination: string | null = null;
  let port: number | null = null;
  let user: string | null = null;
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    if (word.startsWith("-")) {
      const flag = word.slice(0, 2);
      if (flag !== "-p" && flag !== "-l") return null;
      const value = word.length > 2 ? word.slice(2) : words[++i];
      if (value === undefined) return null;
      if (flag === "-p") {
        port = parsePort(value);
        if (port === null) return null;
      } else {
        if (!USER.test(value)) return null;
        user = value;
      }
    } else if (destination === null) {
      destination = word;
    } else {
      return null;
    }
  }
  return destination === null ? null : { destination, port, user };
}

/**
 * Reads what the user typed in the command palette as an SSH target, or null
 * when it does not look like one. Recognises `user@host`, `host:port`,
 * `user@host:port` (hosts may be `[bracketed IPv6]`) and `ssh [-p N] [-l user]
 * [user@]host`. Pure and strict: every part is checked against a narrow
 * character set, so nothing parsed here can be mistaken for an ssh option or
 * carry shell syntax. A bare word is not a connection; it needs `@`, a port
 * or the `ssh` prefix.
 */
export function parseQuickConnect(input: string, { defaultUser }: QuickConnectOptions): QuickConnectTarget | null {
  const words = input.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  let destination: string;
  let flagPort: number | null = null;
  let flagUser: string | null = null;
  if (words[0] === "ssh") {
    const command = parseSshCommand(words);
    if (!command) return null;
    ({ destination, port: flagPort, user: flagUser } = command);
  } else if (words.length === 1) {
    destination = words[0];
    if (!destination.includes("@") && !/^\[.*\]:\d+$/.test(destination) && !/^[^:]+:\d+$/.test(destination)) return null;
  } else {
    return null;
  }

  const parsed = parseDestination(destination);
  if (!parsed) return null;
  const user = parsed.user ?? flagUser ?? (defaultUser || null);
  if (user === null) return null;
  return {
    user,
    host: parsed.host,
    port: flagPort ?? parsed.port ?? 22,
    userGiven: parsed.user !== null || flagUser !== null,
  };
}

/** `user@host`, plus `:port` when it is not 22. IPv6 hosts are bracketed. */
export function quickConnectLabel(target: QuickConnectTarget): string {
  const host = target.host.includes(":") ? `[${target.host}]` : target.host;
  return `${target.user}@${host}${target.port === 22 ? "" : `:${target.port}`}`;
}
