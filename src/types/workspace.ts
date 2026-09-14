import type { SerialConfig, ShellType, SplitDirection } from "./terminal";

/** Version of the JSON stored in a workspace record's `layout`. Records without a version are the legacy `{ tabs, panes }` dump. */
export const SNAPSHOT_VERSION = 2;

export type SnapshotPaneKind = "local" | "ssh" | "serial" | "sftp";

/** What it takes to recreate an in-memory (quick-connect or ssh config alias) connection that is not in the database. */
export interface SnapshotSshQuick {
  name: string;
  host: string;
  port: number;
  username: string;
}

export interface SnapshotPane {
  /** Pane id when the snapshot was taken; only used to find the pane's saved scrollback. */
  id: string | null;
  kind: SnapshotPaneKind;
  shellType: ShellType;
  shellPath: string | null;
  /** Working directory of a local shell; null for every other kind (an SSH cwd is remote). */
  cwd: string | null;
  sshConnectionId: string | null;
  sshQuick: SnapshotSshQuick | null;
  sftpConnectionId: string | null;
  serialConfig: SerialConfig | null;
  /** Lines typed into the pane once its shell (or SSH session) is ready, once per restore. */
  startupCommands: string[];
}

export type SnapshotNode =
  | { type: "pane"; pane: SnapshotPane }
  | { type: "split"; direction: SplitDirection; ratio: number; children: [SnapshotNode, SnapshotNode] };

export interface SnapshotTab {
  title: string;
  colorTag: string | null;
  /** Index of the focused pane among the tab's panes in tree order. */
  focusedPane: number;
  layout: SnapshotNode;
}

export interface WorkspaceSnapshot {
  version: typeof SNAPSHOT_VERSION;
  activeTab: number;
  tabs: SnapshotTab[];
}

export interface WorkspaceMeta {
  id: string;
  name: string;
  icon: string | null;
  /** The record's raw JSON; read it with `parseWorkspaceLayout`. */
  layout?: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt: string;
  lastOpenedAt?: string | null;
}

export type RestoreMode = "replace" | "add";
