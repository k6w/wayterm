import type { SshConnection } from "../../types/ssh";

/**
 * ssh arguments for a connection that names a key file on disk (imported from
 * ~/.ssh/config) instead of a stored key. The path is one argv element, so it
 * never goes near a shell; ssh asks for a passphrase itself in the terminal.
 */
export function identityFileArgs(conn: Pick<SshConnection, "authMethod" | "privateKeyId" | "identityFile">): string[] {
  if (conn.authMethod !== "key" || conn.privateKeyId || !conn.identityFile) return [];
  return ["-i", conn.identityFile];
}
