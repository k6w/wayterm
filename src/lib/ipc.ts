import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export async function terminalSpawn(request: {
  shell: string;
  args: string[];
  cwd: string;
  env: [string, string][];
  rows: number;
  cols: number;
}): Promise<string> {
  return invoke("terminal_spawn", { request });
}

export async function terminalWrite(
  sessionId: string,
  data: number[]
): Promise<void> {
  return invoke("terminal_write", { sessionId, data });
}

export async function terminalResize(
  sessionId: string,
  rows: number,
  cols: number
): Promise<void> {
  return invoke("terminal_resize", { sessionId, rows, cols });
}

export async function terminalKill(sessionId: string): Promise<void> {
  return invoke("terminal_kill", { sessionId });
}

export async function settingsGetAll(): Promise<Record<string, unknown>> {
  return invoke("settings_get_all");
}

export async function settingsSet(
  key: string,
  value: unknown
): Promise<void> {
  return invoke("settings_set", { key, value });
}

export async function historyRecent(
  limit: number
): Promise<{ id: number; command: string; cwd: string | null }[]> {
  return invoke("terminal_history_recent", { limit });
}

export async function historyAdd(
  sessionId: string,
  command: string,
  exitCode: number | null,
  cwd: string | null
): Promise<number> {
  return invoke("terminal_history_add", { sessionId, command, exitCode, cwd });
}

export async function sshListConnections(): Promise<unknown[]> {
  return invoke("ssh_list_connections");
}

export async function sshSaveConnection(profile: unknown): Promise<void> {
  return invoke("ssh_save_connection", { profile });
}

export async function sshDeleteConnection(id: string): Promise<void> {
  return invoke("ssh_delete_connection", { id });
}

export async function sshListKeys(): Promise<unknown[]> {
  return invoke("ssh_list_keys");
}

export async function sshImportKey(request: {
  name: string;
  publicKey: string;
  privateKeyPem: string;
  algorithm: string;
}): Promise<unknown> {
  return invoke("ssh_import_key", { request });
}

export async function sshDeleteKey(id: string): Promise<void> {
  return invoke("ssh_delete_key", { id });
}

export async function sshGetKeyTempPath(keyId: string): Promise<string> {
  return invoke("ssh_get_key_temp_path", { keyId });
}

export async function workspaceList(): Promise<unknown[]> {
  return invoke("workspace_list");
}

export async function workspaceSave(workspace: unknown): Promise<void> {
  return invoke("workspace_save", { workspace });
}

export async function workspaceDelete(id: string): Promise<void> {
  return invoke("workspace_delete", { id });
}

export function onTerminalOutput(
  sessionId: string,
  callback: (data: number[]) => void
): Promise<UnlistenFn> {
  return listen<number[]>(`terminal:output:${sessionId}`, (event) => {
    callback(event.payload);
  });
}

export function onTerminalExit(
  sessionId: string,
  callback: () => void
): Promise<UnlistenFn> {
  return listen(`terminal:exit:${sessionId}`, () => {
    callback();
  });
}
