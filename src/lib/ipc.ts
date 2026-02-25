import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { SftpEntry } from "../types/sftp";

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

export async function setVibrancy(
  enabled: boolean,
  r = 0,
  g = 0,
  b = 0,
  a = 0,
): Promise<void> {
  return invoke("set_vibrancy", { enabled, r, g, b, a });
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

export async function sshUpdateKey(request: {
  id: string;
  name: string;
  publicKey: string;
}): Promise<void> {
  return invoke("ssh_update_key", { request });
}

export async function sshGetKeyTempPath(keyId: string): Promise<string> {
  return invoke("ssh_get_key_temp_path", { keyId });
}

export interface KnownHost {
  hostname: string;
  keyType: string;
  fingerprintPreview: string;
  lineNumber: number;
}

export async function sshKnownHostsList(): Promise<KnownHost[]> {
  return invoke("ssh_known_hosts_list");
}

export async function sshKnownHostsRemove(hostname: string): Promise<void> {
  return invoke("ssh_known_hosts_remove", { hostname });
}

export async function sshKnownHostsClear(): Promise<void> {
  return invoke("ssh_known_hosts_clear");
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

export async function getLaunchCwd(): Promise<string | null> {
  return invoke("get_launch_cwd");
}

export async function getHomeDir(): Promise<string | null> {
  return invoke("get_home_dir");
}

export async function bufferSaveBatch(
  entries: { paneId: string; bufferData: string }[]
): Promise<void> {
  return invoke("buffer_save_batch", { entries });
}

export async function bufferLoadBatch(
  paneIds: string[]
): Promise<{ paneId: string; bufferData: string }[]> {
  return invoke("buffer_load_batch", { paneIds });
}

export async function bufferCleanup(): Promise<number> {
  return invoke("buffer_cleanup");
}

export async function customThemeList(): Promise<
  { id: string; themeJson: string }[]
> {
  return invoke("custom_theme_list");
}

export async function customThemeSave(
  id: string,
  themeJson: string
): Promise<void> {
  return invoke("custom_theme_save", { id, themeJson });
}

export async function customThemeDelete(id: string): Promise<void> {
  return invoke("custom_theme_delete", { id });
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

// ── SFTP commands ──

export async function sftpConnect(connectionId: string): Promise<string> {
  return invoke("sftp_connect", { connectionId });
}

export async function sftpDisconnect(sessionId: string): Promise<void> {
  return invoke("sftp_disconnect", { sessionId });
}

export async function sftpListDir(sessionId: string, path: string): Promise<SftpEntry[]> {
  return invoke("sftp_list_dir", { sessionId, path });
}

export async function sftpMkdir(sessionId: string, path: string): Promise<void> {
  return invoke("sftp_mkdir", { sessionId, path });
}

export async function sftpRemove(sessionId: string, path: string, isDir: boolean): Promise<void> {
  return invoke("sftp_remove", { sessionId, path, isDir });
}

export async function sftpRename(sessionId: string, oldPath: string, newPath: string): Promise<void> {
  return invoke("sftp_rename", { sessionId, oldPath, newPath });
}

export async function sftpDownload(sessionId: string, remotePath: string, localPath: string, transferId: string): Promise<void> {
  return invoke("sftp_download", { sessionId, remotePath, localPath, transferId });
}

export async function sftpUpload(sessionId: string, localPath: string, remotePath: string, transferId: string): Promise<void> {
  return invoke("sftp_upload", { sessionId, localPath, remotePath, transferId });
}

export async function sftpChmod(sessionId: string, path: string, mode: number): Promise<void> {
  return invoke("sftp_chmod", { sessionId, path, mode });
}

export async function localListDir(path: string): Promise<SftpEntry[]> {
  return invoke("local_list_dir", { path });
}

export function onSftpTransferProgress(
  callback: (data: { transferId: string; bytesTransferred: number; totalBytes: number; status: string; error: string | null }) => void
): Promise<UnlistenFn> {
  return listen("sftp:transfer:progress", (event) => {
    callback(event.payload as { transferId: string; bytesTransferred: number; totalBytes: number; status: string; error: string | null });
  });
}
