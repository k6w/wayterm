// Helpers for the host-key trust flow. The backend (src-tauri/src/commands/
// known_hosts.rs) reports an unknown host as an error containing
// "TOFU_REQUIRED" (the key waits in ssh_get_pending_host_key) and a key that no
// longer matches known_hosts as an error starting "HOST KEY CHANGED".

/** True when a connect error says the saved host key no longer matches. */
export function isHostKeyChanged(message: string): boolean {
  return message.includes("HOST KEY CHANGED");
}

/** "host" on port 22, "host:port" otherwise (how the dialogs show a host). */
export function hostLabel(host: string, port: number): string {
  return port === 22 ? host : `${host}:${port}`;
}

/**
 * known_hosts names to remove so a changed key can be trusted again. The
 * backend matches a host by "[host]:port", by plain "host" (any port) and, on
 * port 22, by "[host]:22", so all of those go.
 */
export function knownHostsNames(host: string, port: number): string[] {
  return port === 22 ? [host, `[${host}]:22`] : [`[${host}]:${port}`, host];
}

export interface FingerprintParts {
  /** "SHA256", or null when the fingerprint has no algorithm prefix. */
  algorithm: string | null;
  /** The digest split into groups of 4 characters for reading aloud and comparing. */
  groups: string[];
}

/** Splits "SHA256:AbCd..." into its algorithm and 4-character groups. */
export function fingerprintParts(fingerprint: string): FingerprintParts {
  const match = /^([A-Za-z0-9-]+):(.+)$/.exec(fingerprint.trim());
  const algorithm = match ? match[1] : null;
  const digest = match ? match[2] : fingerprint.trim();
  return { algorithm, groups: digest.match(/.{1,4}/g) ?? [] };
}
