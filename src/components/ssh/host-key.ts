// Helpers for the host-key trust flow. The backend (src-tauri/src/commands/
// known_hosts.rs) reports an unknown host as an error containing
// "TOFU_REQUIRED" (the key waits in ssh_get_pending_host_key) and a key that no
// longer matches known_hosts as an error starting "HOST KEY CHANGED", followed
// by MISMATCH_MARKER and a JSON HostKeyMismatch.
import type { HostKeyMismatch, SavedHostKey } from "../../lib/ipc";

const MISMATCH_MARKER = "\nwayterm-host-key-mismatch:";

/** True when a connect error says the saved host key no longer matches. */
export function isHostKeyChanged(message: string): boolean {
  return message.includes("HOST KEY CHANGED");
}

const isString = (v: unknown): v is string => typeof v === "string" && v.length > 0;

function isSavedKey(v: unknown): v is SavedHostKey {
  if (typeof v !== "object" || v === null) return false;
  const k = v as Record<string, unknown>;
  return isString(k.keyType) && isString(k.fingerprint) && typeof k.lineNumber === "number";
}

/** The structured changed-key payload of a connect error, or null when there is none or it is malformed. */
export function parseHostKeyMismatch(message: string): HostKeyMismatch | null {
  const at = message.indexOf(MISMATCH_MARKER);
  if (at < 0 || !isHostKeyChanged(message)) return null;
  let value: unknown;
  try {
    value = JSON.parse(message.slice(at + MISMATCH_MARKER.length));
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const m = value as Record<string, unknown>;
  const valid =
    isString(m.host) &&
    typeof m.port === "number" &&
    isString(m.knownHostsPath) &&
    Array.isArray(m.oldKeys) &&
    m.oldKeys.length > 0 &&
    m.oldKeys.every(isSavedKey) &&
    isString(m.newKeyType) &&
    isString(m.newFingerprint) &&
    isString(m.newKeyB64);
  return valid ? (value as HostKeyMismatch) : null;
}

/** A connect error for display: the changed-key payload is dropped. */
export function hostKeyErrorText(message: string): string {
  const at = message.indexOf(MISMATCH_MARKER);
  return at < 0 ? message : message.slice(0, at);
}

/** What the user types to confirm a replacement: the last 4 characters of the new fingerprint. */
export function confirmationCode(fingerprint: string): string {
  return fingerprint.slice(-4);
}

/** The saved key a replacement replaces: the one of the new key's type, else the first. */
export function expectedOldKey(mismatch: HostKeyMismatch): SavedHostKey {
  return mismatch.oldKeys.find((k) => k.keyType === mismatch.newKeyType) ?? mismatch.oldKeys[0];
}

/** "host" on port 22, "host:port" otherwise (how the dialogs show a host). */
export function hostLabel(host: string, port: number): string {
  return port === 22 ? host : `${host}:${port}`;
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
