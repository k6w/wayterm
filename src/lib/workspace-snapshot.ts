import type { SerialConfig, ShellType, SplitDirection, SplitNode, TerminalPane, TerminalTab } from "../types/terminal";
import type { SshConnection } from "../types/ssh";
import {
  SNAPSHOT_VERSION,
  type SnapshotNode,
  type SnapshotPane,
  type SnapshotPaneKind,
  type SnapshotTab,
  type WorkspaceSnapshot,
} from "../types/workspace";

/** The slice of the terminal store (plus the known SSH connections) a snapshot is built from. */
export interface SnapshotSource {
  tabs: TerminalTab[];
  panes: Record<string, TerminalPane>;
  activeTabId: string | null;
  activePaneId: string | null;
  paneFocusHistory: string[];
  connections: readonly SshConnection[];
}

const SHELL_TYPES: readonly ShellType[] = [
  "powershell", "cmd", "gitbash", "wsl", "bash", "zsh", "fish", "sh", "ssh", "sftp", "serial",
];
const KINDS: readonly SnapshotPaneKind[] = ["local", "ssh", "serial", "sftp"];
const DEFAULT_TITLE = "Terminal";

function kindOf(shellType: ShellType): SnapshotPaneKind {
  if (shellType === "ssh" || shellType === "sftp" || shellType === "serial") return shellType;
  return "local";
}

function leafIds(node: SplitNode): string[] {
  if (node.type === "pane") return node.paneId ? [node.paneId] : [];
  return node.children ? node.children.flatMap(leafIds) : [];
}

function snapshotPane(pane: TerminalPane, connections: readonly SshConnection[]): SnapshotPane {
  const kind = kindOf(pane.shellType);
  const quick = kind === "ssh" ? connections.find((c) => c.id === pane.sshConnectionId && c.transient) : undefined;
  return {
    id: pane.id,
    kind,
    shellType: pane.shellType,
    shellPath: pane.shellPath || null,
    cwd: kind === "local" ? pane.cwd || null : null,
    sshConnectionId: kind === "ssh" ? pane.sshConnectionId ?? null : null,
    sshQuick: quick ? { name: quick.name, host: quick.host, port: quick.port, username: quick.username } : null,
    sftpConnectionId: kind === "sftp" ? pane.sftpConnectionId ?? null : null,
    serialConfig: kind === "serial" ? pane.serialConfig ?? null : null,
    startupCommands: [],
  };
}

function snapshotNode(node: SplitNode, source: SnapshotSource): SnapshotNode | null {
  if (node.type === "pane") {
    const pane = node.paneId ? source.panes[node.paneId] : undefined;
    return pane ? { type: "pane", pane: snapshotPane(pane, source.connections) } : null;
  }
  const [first, second] = (node.children ?? []).map((child) => snapshotNode(child, source));
  if (!first) return second ?? null;
  if (!second) return first;
  return { type: "split", direction: node.direction ?? "horizontal", ratio: node.ratio ?? 0.5, children: [first, second] };
}

/** A versioned, id-free description of the open tabs, splits and panes. Sidebar state is not part of it. */
export function buildSnapshot(source: SnapshotSource): WorkspaceSnapshot {
  const tabs: SnapshotTab[] = [];
  let activeTab = 0;
  for (const tab of source.tabs) {
    const layout = snapshotNode(tab.panes, source);
    if (!layout) continue;
    const ids = leafIds(tab.panes).filter((id) => source.panes[id]);
    const isActive = tab.id === source.activeTabId;
    const focusId = isActive
      ? source.activePaneId
      : [...source.paneFocusHistory].reverse().find((id) => ids.includes(id));
    if (isActive) activeTab = tabs.length;
    tabs.push({
      title: tab.title,
      colorTag: tab.colorTag ?? null,
      focusedPane: Math.max(0, ids.indexOf(focusId ?? "")),
      layout,
    });
  }
  return { version: SNAPSHOT_VERSION, activeTab, tabs };
}

function nodePanes(node: SnapshotNode): SnapshotPane[] {
  return node.type === "pane" ? [node.pane] : node.children.flatMap(nodePanes);
}

/** Every pane of the snapshot in tab order, then tree order. */
export function snapshotPanes(snapshot: WorkspaceSnapshot): SnapshotPane[] {
  return snapshot.tabs.flatMap((tab) => nodePanes(tab.layout));
}

export function countSnapshot(snapshot: WorkspaceSnapshot): { tabs: number; panes: number } {
  return { tabs: snapshot.tabs.length, panes: snapshotPanes(snapshot).length };
}

function mapPanes(node: SnapshotNode, fn: (pane: SnapshotPane) => SnapshotPane): SnapshotNode {
  if (node.type === "pane") return { type: "pane", pane: fn(node.pane) };
  return { ...node, children: [mapPanes(node.children[0], fn), mapPanes(node.children[1], fn)] };
}

function mapSnapshotPanes(snapshot: WorkspaceSnapshot, fn: (pane: SnapshotPane, index: number) => SnapshotPane): WorkspaceSnapshot {
  let index = 0;
  return {
    ...snapshot,
    tabs: snapshot.tabs.map((tab) => ({ ...tab, layout: mapPanes(tab.layout, (pane) => fn(pane, index++)) })),
  };
}

/** Replaces each pane's startup commands (by position in `snapshotPanes` order); lines are trimmed and blanks dropped. */
export function setSnapshotStartupCommands(snapshot: WorkspaceSnapshot, commands: readonly (readonly string[])[]): WorkspaceSnapshot {
  return mapSnapshotPanes(snapshot, (pane, index) => ({
    ...pane,
    startupCommands: cleanCommands(commands[index] ?? pane.startupCommands),
  }));
}

/** Keeps the startup commands of `previous` on the matching panes (same position and kind) of a fresh snapshot of the same workspace. */
export function mergeStartupCommands(next: WorkspaceSnapshot, previous: WorkspaceSnapshot): WorkspaceSnapshot {
  const before = snapshotPanes(previous);
  return mapSnapshotPanes(next, (pane, index) => {
    const old = before[index];
    return old && old.kind === pane.kind ? { ...pane, startupCommands: old.startupCommands } : pane;
  });
}

/** Drops the pane ids, e.g. for a copy that must not share scrollback with the original. */
export function stripPaneIds(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  return mapSnapshotPanes(snapshot, (pane) => ({ ...pane, id: null }));
}

function cleanCommands(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((line): line is string => typeof line === "string").map((line) => line.trim()).filter(Boolean);
}

type Raw = Record<string, unknown>;
const isObject = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

function readSerial(value: unknown): SerialConfig | null {
  if (!isObject(value) || typeof value.portName !== "string") return null;
  return {
    portName: value.portName,
    baudRate: Number(value.baudRate) || 115200,
    dataBits: Number(value.dataBits) || 8,
    stopBits: Number(value.stopBits) || 1,
    parity: str(value.parity) ?? "none",
    flowControl: str(value.flowControl) ?? "none",
  };
}

function readQuick(value: unknown): SnapshotPane["sshQuick"] {
  if (!isObject(value) || !str(value.host)) return null;
  return {
    name: str(value.name) ?? String(value.host),
    host: String(value.host),
    port: Number(value.port) || 22,
    username: str(value.username) ?? "",
  };
}

function readPane(value: unknown): SnapshotPane | null {
  if (!isObject(value)) return null;
  const shellType = SHELL_TYPES.find((t) => t === value.shellType) ?? "sh";
  const kind = KINDS.find((k) => k === value.kind) ?? kindOf(shellType);
  return {
    id: str(value.id),
    kind,
    shellType,
    shellPath: str(value.shellPath),
    cwd: kind === "local" ? str(value.cwd) : null,
    sshConnectionId: kind === "ssh" ? str(value.sshConnectionId) : null,
    sshQuick: kind === "ssh" ? readQuick(value.sshQuick) : null,
    sftpConnectionId: kind === "sftp" ? str(value.sftpConnectionId) : null,
    serialConfig: kind === "serial" ? readSerial(value.serialConfig) : null,
    startupCommands: cleanCommands(value.startupCommands),
  };
}

function readNode(value: unknown): SnapshotNode | null {
  if (!isObject(value)) return null;
  if (value.type === "pane") {
    const pane = readPane(value.pane);
    return pane ? { type: "pane", pane } : null;
  }
  if (value.type !== "split" || !Array.isArray(value.children)) return null;
  const first = readNode(value.children[0]);
  const second = readNode(value.children[1]);
  if (!first || !second) return first ?? second;
  const direction: SplitDirection = value.direction === "vertical" ? "vertical" : "horizontal";
  const ratio = typeof value.ratio === "number" && value.ratio > 0 && value.ratio < 1 ? value.ratio : 0.5;
  return { type: "split", direction, ratio, children: [first, second] };
}

function readCurrent(raw: Raw): WorkspaceSnapshot | null {
  if (!Array.isArray(raw.tabs)) return null;
  const tabs: SnapshotTab[] = [];
  for (const entry of raw.tabs) {
    if (!isObject(entry)) continue;
    const layout = readNode(entry.layout);
    if (!layout) continue;
    const focused = typeof entry.focusedPane === "number" ? Math.trunc(entry.focusedPane) : 0;
    tabs.push({
      title: str(entry.title) ?? DEFAULT_TITLE,
      colorTag: str(entry.colorTag),
      focusedPane: Math.min(Math.max(focused, 0), nodePanes(layout).length - 1),
      layout,
    });
  }
  if (tabs.length === 0) return null;
  const active = typeof raw.activeTab === "number" ? Math.trunc(raw.activeTab) : 0;
  return { version: SNAPSHOT_VERSION, activeTab: active >= 0 && active < tabs.length ? active : 0, tabs };
}

/** The pre-versioning dump: `{ tabs: TerminalTab[], panes: Record<id, TerminalPane> }`. */
function readLegacy(raw: Raw): WorkspaceSnapshot | null {
  if (!Array.isArray(raw.tabs) || !isObject(raw.panes)) return null;
  const panes = raw.panes;
  const convert = (node: unknown): SnapshotNode | null => {
    if (!isObject(node)) return null;
    if (node.type === "pane") {
      const old = typeof node.paneId === "string" ? panes[node.paneId] : undefined;
      return isObject(old) ? readNodeFromLegacyPane(old) : null;
    }
    if (!Array.isArray(node.children)) return null;
    const first = convert(node.children[0]);
    const second = convert(node.children[1]);
    if (!first || !second) return first ?? second;
    return readNode({ type: "split", direction: node.direction, ratio: node.ratio, children: [first, second] });
  };
  const tabs: SnapshotTab[] = [];
  let activeTab = -1;
  for (const entry of raw.tabs) {
    if (!isObject(entry)) continue;
    const layout = convert(entry.panes);
    if (!layout) continue;
    if (entry.isActive === true) activeTab = tabs.length;
    tabs.push({ title: str(entry.title) ?? DEFAULT_TITLE, colorTag: str(entry.colorTag), focusedPane: 0, layout });
  }
  if (tabs.length === 0) return null;
  return { version: SNAPSHOT_VERSION, activeTab: Math.max(activeTab, 0), tabs };
}

function readNodeFromLegacyPane(old: Raw): SnapshotNode | null {
  const pane = readPane({ ...old, kind: undefined });
  return pane ? { type: "pane", pane } : null;
}

/**
 * Reads a workspace record's `layout`. Current snapshots are validated and
 * repaired; the legacy `{ tabs, panes }` dump is migrated. Anything else
 * (empty, malformed, written by a newer version) yields null.
 */
export function parseWorkspaceLayout(layout: string | undefined | null): WorkspaceSnapshot | null {
  if (!layout) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(layout);
  } catch {
    return null;
  }
  if (!isObject(raw)) return null;
  if (typeof raw.version === "number") return raw.version === SNAPSHOT_VERSION ? readCurrent(raw) : null;
  return readLegacy(raw);
}

function buildNode(node: SnapshotNode, ids: Map<string, string>, panes: Record<string, TerminalPane>, order: string[]): SplitNode {
  if (node.type === "split") {
    return {
      type: "split",
      direction: node.direction,
      ratio: node.ratio,
      children: [buildNode(node.children[0], ids, panes, order), buildNode(node.children[1], ids, panes, order)],
    };
  }
  const saved = node.pane;
  const id = crypto.randomUUID();
  if (saved.id) ids.set(saved.id, id);
  order.push(id);
  const pane: TerminalPane = {
    id,
    sessionId: "",
    isActive: false,
    cwd: saved.cwd ?? "",
    shellType: saved.shellType,
  };
  if (saved.shellPath) pane.shellPath = saved.shellPath;
  if (saved.sshConnectionId) pane.sshConnectionId = saved.sshConnectionId;
  if (saved.sftpConnectionId) pane.sftpConnectionId = saved.sftpConnectionId;
  if (saved.serialConfig) pane.serialConfig = saved.serialConfig;
  if (saved.kind === "local" && saved.cwd) pane.checkCwd = true;
  if (saved.startupCommands.length > 0) pane.startupCommands = [...saved.startupCommands];
  panes[id] = pane;
  return { type: "pane", paneId: id };
}

export interface MaterializedSnapshot {
  tabs: TerminalTab[];
  panes: Record<string, TerminalPane>;
  activeTabId: string;
  activePaneId: string;
  /** Focused pane of every tab, the active tab's last: seeds the store's focus history. */
  focusHistory: string[];
  /** Saved pane id to new pane id, for panes whose snapshot kept an id (scrollback lookup). */
  idMap: Map<string, string>;
}

/** Terminal-store tabs and panes with fresh ids for a snapshot; the saved tab and pane are active and focused. */
export function materializeSnapshot(snapshot: WorkspaceSnapshot): MaterializedSnapshot {
  const idMap = new Map<string, string>();
  const panes: Record<string, TerminalPane> = {};
  const tabs: TerminalTab[] = [];
  let activePaneId = "";
  const activeIndex = snapshot.activeTab >= 0 && snapshot.activeTab < snapshot.tabs.length ? snapshot.activeTab : 0;
  const focusHistory: string[] = [];
  snapshot.tabs.forEach((saved, index) => {
    const order: string[] = [];
    const tree = buildNode(saved.layout, idMap, panes, order);
    const isActive = index === activeIndex;
    const focusId = order[saved.focusedPane] ?? order[0];
    if (isActive) {
      activePaneId = focusId;
      panes[focusId].isActive = true;
    } else {
      focusHistory.push(focusId);
    }
    const shellType = panes[order[0]].shellType;
    const tab: TerminalTab = { id: crypto.randomUUID(), title: saved.title, icon: "terminal", shellType, panes: tree, isActive };
    if (saved.colorTag) tab.colorTag = saved.colorTag;
    tabs.push(tab);
  });
  focusHistory.push(activePaneId);
  return { tabs, panes, activeTabId: tabs[activeIndex].id, activePaneId, focusHistory, idMap };
}

export interface CwdChecks {
  dirExists: (path: string) => Promise<boolean>;
  home: () => Promise<string | null>;
}

/** Where a restored local shell starts: its saved folder, or home plus a notice when that folder no longer exists. */
export async function resolveRestoredCwd(cwd: string, checks: CwdChecks): Promise<{ cwd: string; notice?: string }> {
  let exists = false;
  try {
    exists = await checks.dirExists(cwd);
  } catch {
    exists = false;
  }
  if (exists) return { cwd };
  let home = "";
  try {
    home = (await checks.home()) ?? "";
  } catch {
    home = "";
  }
  return { cwd: home, notice: `${cwd} no longer exists. Started in your home folder.` };
}

export interface StartupTarget {
  /** Position of the pane in `snapshotPanes` order (what `setSnapshotStartupCommands` expects). */
  index: number;
  tabIndex: number;
  tab: string;
  /** 1-based position of the pane within its tab. */
  number: number;
  description: string;
  commands: string[];
}

/** The panes that take startup commands (shells and SSH sessions), described for the editing dialog. */
export function describeStartupTargets(snapshot: WorkspaceSnapshot): StartupTarget[] {
  const targets: StartupTarget[] = [];
  let index = 0;
  snapshot.tabs.forEach((tab, tabIndex) => {
    nodePanes(tab.layout).forEach((pane, i) => {
      if (pane.kind === "local" || pane.kind === "ssh") {
        const description =
          pane.kind === "ssh"
            ? pane.sshQuick
              ? `SSH ${pane.sshQuick.name}`
              : "SSH"
            : pane.cwd
              ? `${pane.shellType} in ${pane.cwd}`
              : pane.shellType;
        targets.push({ index: index + i, tabIndex, tab: tab.title, number: i + 1, description, commands: pane.startupCommands });
      }
    });
    index += nodePanes(tab.layout).length;
  });
  return targets;
}
