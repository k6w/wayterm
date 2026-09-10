import { useSshStore } from "../../stores/ssh";
import { useTerminalStore } from "../../stores/terminal";
import type { SshConfigHost } from "../../lib/ipc";
import type { SshConnection } from "../../types/ssh";
import { quickConnectLabel, type QuickConnectTarget } from "./quick-connect";

/** Opens an SSH tab for a connection that is already in the store, titled with its name. */
export function openSavedConnection(conn: SshConnection): void {
  const { addTab, renameTab } = useTerminalStore.getState();
  addTab("ssh", undefined, conn.id);
  const { tabs } = useTerminalStore.getState();
  const newTab = tabs[tabs.length - 1];
  if (newTab) renameTab(newTab.id, conn.name);
}

function adHocConnection(fields: Pick<SshConnection, "name" | "host" | "port" | "username">): SshConnection {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    ...fields,
    // ssh asks for a password or passphrase itself in the terminal.
    authMethod: "password",
    privateKeyId: null,
    jumpHostId: null,
    startupCommands: null,
    colorTag: null,
    folderPath: "",
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    envVars: {},
  };
}

/**
 * Connects to a host typed in the palette. The connection lives in memory only
 * (hidden from the connection list, never written to the database) unless
 * `save` is set, in which case it is saved first and the tab opens once that
 * has succeeded.
 */
export async function openQuickTarget(target: QuickConnectTarget, save: boolean): Promise<void> {
  const conn = adHocConnection({
    name: quickConnectLabel(target),
    host: target.host,
    port: target.port,
    username: target.user,
  });
  if (save) {
    await useSshStore.getState().saveConnection(conn);
  } else {
    useSshStore.getState().addTransientConnection({ ...conn, transient: true });
  }
  openSavedConnection(conn);
}

/**
 * Connects to a ~/.ssh/config alias without importing it. The alias itself is
 * the host, so ssh resolves HostName, Port, IdentityFile, ProxyJump and the
 * rest from the config, exactly as `ssh alias` would.
 */
export function openConfigHost(host: SshConfigHost): void {
  const conn = adHocConnection({ name: host.alias, host: host.alias, port: 22, username: host.user });
  useSshStore.getState().addTransientConnection({ ...conn, transient: true });
  openSavedConnection(conn);
}
