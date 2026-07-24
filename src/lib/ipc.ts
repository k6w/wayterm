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

export async function setTrafficLightScale(scale: number): Promise<void> {
  return invoke("set_traffic_light_scale", { scale });
}

/**
 * Sets the native window title. Use this instead of the JS window API:
 * on macOS it also re-applies the traffic-light position, which AppKit resets
 * whenever the title changes.
 */
export async function setWindowTitle(title: string): Promise<void> {
  return invoke("set_window_title", { title });
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

export async function pathExists(path: string): Promise<boolean> {
  return invoke("path_exists", { path });
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

export async function sshKnownHostsAdd(host: string, port: number, keyType: string, keyData: string): Promise<void> {
  return invoke("ssh_known_hosts_add", { host, port, keyType, keyData });
}

export async function sshKnownHostsClear(): Promise<void> {
  return invoke("ssh_known_hosts_clear");
}

export interface PendingHostKey {
  host: string;
  port: number;
  keyType: string;
  keyData: string;
  fingerprint: string;
}

export async function sshGetPendingHostKey(host: string, port: number): Promise<PendingHostKey | null> {
  return invoke("ssh_get_pending_host_key", { host, port });
}

export async function sshClearPendingHostKey(host: string, port: number): Promise<void> {
  return invoke("ssh_clear_pending_host_key", { host, port });
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



export interface PortForward {
  id: string;
  connectionId: string;
  portForwardType: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function sshListPortForwards(connectionId: string): Promise<PortForward[]> {
  return invoke("ssh_list_port_forwards", { connectionId });
}

export async function sshSavePortForward(forward: PortForward): Promise<void> {
  return invoke("ssh_save_port_forward", { forward });
}

export async function sshDeletePortForward(id: string): Promise<void> {
  return invoke("ssh_delete_port_forward", { id });
}

export async function sshTogglePortForward(id: string, isActive: boolean, sessionId?: string): Promise<void> {
  return invoke("ssh_toggle_port_forward", { id, isActive, sessionId });
}



export async function gitGetBranch(path: string): Promise<string | null> {
  return invoke("git_get_branch", { path });
}

export async function gitIsDirty(path: string): Promise<boolean> {
  return invoke("git_is_dirty", { path });
}

export async function gitGetStatus(path: string, connectionId?: string): Promise<import("../types/git").GitStatus> {
  return invoke("git_get_status", { path, connectionId });
}

export async function gitGetBranches(path: string, connectionId?: string): Promise<import("../types/git").GitBranch[]> {
  return invoke("git_get_branches", { path, connectionId });
}

export async function gitGetCommits(path: string, limit: number, connectionId?: string): Promise<import("../types/git").GitCommit[]> {
  return invoke("git_get_commits", { path, limit, connectionId });
}

export async function gitGetRemotes(path: string): Promise<import("../types/git").GitRemote[]> {
  return invoke("git_get_remotes", { path });
}

export async function gitGetDiff(path: string, file?: string): Promise<import("../types/git").GitDiff[]> {
  return invoke("git_get_diff", { path, file });
}

export async function gitInit(path: string): Promise<void> {
  return invoke("git_init", { path });
}

export async function gitCheckout(path: string, branch: string): Promise<void> {
  return invoke("git_checkout", { path, branch });
}

export async function gitPull(path: string): Promise<void> {
  return invoke("git_pull", { path });
}

export async function gitPush(path: string): Promise<void> {
  return invoke("git_push", { path });
}

export async function gitCommit(path: string, message: string): Promise<void> {
  return invoke("git_commit", { path, message });
}

export async function gitStage(path: string, files: string[]): Promise<void> {
  return invoke("git_stage", { path, files });
}

export async function gitUnstage(path: string, files: string[]): Promise<void> {
  return invoke("git_unstage", { path, files });
}

export async function gitStash(path: string, message?: string): Promise<void> {
  return invoke("git_stash", { path, message });
}

export async function gitStashPop(path: string): Promise<void> {
  return invoke("git_stash_pop", { path });
}

export async function dbConnect(connectionId: string): Promise<void> {
  return invoke("db_connect", { connectionId });
}

export async function dbDisconnect(connectionId: string): Promise<void> {
  return invoke("db_disconnect", { connectionId });
}

export async function dbExecuteQuery(connectionId: string, query: string): Promise<import("../types/database").QueryResult> {
  return invoke("db_execute_query", { connectionId, query });
}

export async function dbGetTables(connectionId: string): Promise<import("../types/database").DatabaseTable[]> {
  return invoke("db_get_tables", { connectionId });
}

export async function dbGetTableSchema(connectionId: string, table: string): Promise<import("../types/database").DatabaseTable> {
  return invoke("db_get_table_schema", { connectionId, table });
}

export async function dbListConnections(): Promise<import("../types/database").DatabaseConnection[]> {
  return invoke("db_list_connections");
}

export async function dbSaveConnection(connection: import("../types/database").DatabaseConnection): Promise<void> {
  return invoke("db_save_connection", { connection });
}

export async function dbDeleteConnection(id: string): Promise<void> {
  return invoke("db_delete_connection", { id });
}

export interface SerialPortInfo {
  portName: string;
  description: string | null;
}

export interface SerialOpenRequest {
  portName: string;
  baudRate: number;
  dataBits: number;
  stopBits: number;
  parity: string;
  flowControl: string;
}

export async function serialListPorts(): Promise<SerialPortInfo[]> {
  return invoke("serial_list_ports");
}

export async function serialOpen(request: SerialOpenRequest): Promise<string> {
  return invoke("serial_open", { request });
}

export async function serialWrite(sessionId: string, data: number[]): Promise<void> {
  return invoke("serial_write", { sessionId, data });
}

export async function serialClose(sessionId: string): Promise<void> {
  return invoke("serial_close", { sessionId });
}

export function onSerialOutput(
  sessionId: string,
  callback: (data: number[]) => void
): Promise<import("@tauri-apps/api/event").UnlistenFn> {
  return listen<number[]>(`serial:output:${sessionId}`, (event) => {
    callback(event.payload);
  });
}

export function onSerialExit(
  sessionId: string,
  callback: () => void
): Promise<import("@tauri-apps/api/event").UnlistenFn> {
  return listen(`serial:exit:${sessionId}`, () => {
    callback();
  });
}

export async function sshImportConfig(): Promise<{
  name: string;
  host: string;
  port: number;
  username: string;
  identityFile: string | null;
  jumpHost: string | null;
}[]> {
  return invoke("ssh_import_config");
}

export async function terminalLogStart(sessionId: string, path: string): Promise<void> {
  return invoke("terminal_log_start", { sessionId, path });
}

export async function terminalLogStop(sessionId: string): Promise<void> {
  return invoke("terminal_log_stop", { sessionId });
}

export async function terminalLogWrite(sessionId: string, data: number[]): Promise<void> {
  return invoke("terminal_log_write", { sessionId, data });
}