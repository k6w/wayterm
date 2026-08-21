import type { SshConnection } from "../../types/ssh";

/** One Host entry read from ~/.ssh/config (the sshImportConfig IPC result). */
export interface ImportedHost {
  name: string;
  host: string;
  port: number;
  username: string;
  identityFile: string | null;
  jumpHost: string | null;
}

const sameTarget = (a: Pick<SshConnection, "host" | "username" | "port">, b: ImportedHost) =>
  a.host === b.host && a.username === b.username && a.port === b.port;

/**
 * Saved connections for the chosen config hosts, in list order. Hosts already
 * saved (same host, user and port), or chosen twice, are skipped. A host with
 * an IdentityFile uses key auth, otherwise password.
 */
export function connectionsFromConfig(
  hosts: readonly ImportedHost[],
  chosen: ReadonlySet<number>,
  existing: readonly SshConnection[],
  now: string,
  newId: () => string
): SshConnection[] {
  const added: SshConnection[] = [];
  hosts.forEach((h, index) => {
    if (!chosen.has(index)) return;
    if ([...existing, ...added].some((c) => sameTarget(c, h))) return;
    added.push({
      id: newId(),
      name: h.name,
      host: h.host,
      port: h.port,
      username: h.username,
      authMethod: h.identityFile ? "key" : "password",
      privateKeyId: null,
      sortOrder: 0,
      startupCommands: null,
      jumpHostId: null,
      colorTag: null,
      folderPath: "",
      createdAt: now,
      updatedAt: now,
      themeOverride: null,
      agentForwarding: false,
      envVars: {},
    });
  });
  return added;
}
