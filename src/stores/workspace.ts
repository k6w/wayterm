import { create } from "zustand";
import type { RestoreMode, WorkspaceMeta, WorkspaceSnapshot } from "../types/workspace";
import { workspaceList, workspaceSave, workspaceDelete, bufferLoadBatch, terminalCwd, terminalKill } from "../lib/ipc";
import { useTerminalStore } from "./terminal";
import { useSshStore } from "./ssh";
import { getCachedTerminal, removeCachedTerminal } from "../lib/terminal-registry";
import { adHocConnection } from "../components/ssh/open-connection";
import {
  buildSnapshot,
  materializeSnapshot,
  mergeStartupCommands,
  parseWorkspaceLayout,
  setSnapshotStartupCommands,
  snapshotPanes,
  stripPaneIds,
} from "../lib/workspace-snapshot";

const SESSION_ID = "__session__";

interface WorkspaceState {
  workspaces: WorkspaceMeta[];
  loaded: boolean;
  pendingBuffers: Record<string, string>;
  _buffersReadyPromise: Promise<void> | null;
  load: () => Promise<void>;
  /** Saves the current layout under a name; resolves to the new id, or null when no tabs are open. */
  save: (name: string) => Promise<string | null>;
  /** Re-captures the current layout into an existing workspace, keeping its name and startup commands. */
  update: (id: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  duplicate: (id: string) => Promise<string | null>;
  /** Replaces the startup commands of every pane, in `snapshotPanes` order. */
  setStartupCommands: (id: string, commands: string[][]) => Promise<void>;
  /** Opens a workspace, replacing or adding to the current tabs. False when the record cannot be read. */
  restore: (id: string, mode?: RestoreMode) => boolean;
  remove: (id: string) => Promise<void>;
  autoSave: () => Promise<void>;
  restoreSession: () => boolean;
  consumeBuffer: (paneId: string) => string | undefined;
  loadBuffersForRestore: (idMap: Map<string, string>) => void;
}

function currentSource() {
  return { ...useTerminalStore.getState(), connections: useSshStore.getState().connections };
}

/**
 * Snapshot of the open layout. Local panes are asked for the working directory
 * of their PTY's foreground process first, so every pane (not only the focused
 * one the poller watches) is saved where it actually is.
 */
async function captureSnapshot(): Promise<WorkspaceSnapshot> {
  const { panes, updatePaneCwd } = useTerminalStore.getState();
  await Promise.all(
    Object.values(panes)
      .filter((pane) => pane.sessionId && !pane.sshConnectionId && pane.shellType !== "ssh" && pane.shellType !== "sftp" && pane.shellType !== "serial")
      .map(async (pane) => {
        try {
          const cwd = await terminalCwd(pane.sessionId);
          if (cwd) updatePaneCwd(pane.id, cwd);
        } catch {
          // session gone or backend unavailable: keep the last known cwd
        }
      })
  );
  return buildSnapshot(currentSource());
}

function disposeLiveTerminals(paneIds: string[]) {
  for (const paneId of paneIds) {
    const cached = getCachedTerminal(paneId);
    if (!cached) continue;
    cached.unlistenOutput?.();
    cached.unlistenExit?.();
    if (cached.sessionId) terminalKill(cached.sessionId).catch(() => {});
    cached.terminal.dispose();
    removeCachedTerminal(paneId);
  }
}

/** Puts a snapshot on screen. Returns the saved-to-new pane id map (for scrollback). */
function applySnapshot(snapshot: WorkspaceSnapshot, mode: RestoreMode): Map<string, string> {
  // Quick-connect and ssh-alias connections live in memory only: bring them back so their panes can connect.
  const ssh = useSshStore.getState();
  for (const pane of snapshotPanes(snapshot)) {
    if (pane.sshQuick && pane.sshConnectionId && !ssh.connections.some((c) => c.id === pane.sshConnectionId)) {
      ssh.addTransientConnection(adHocConnection(pane.sshQuick, pane.sshConnectionId));
    }
  }

  const restored = materializeSnapshot(snapshot);
  const term = useTerminalStore.getState();
  if (mode === "replace") {
    disposeLiveTerminals(Object.keys(term.panes));
    useTerminalStore.setState({
      tabs: restored.tabs,
      panes: restored.panes,
      activeTabId: restored.activeTabId,
      activePaneId: restored.activePaneId,
      paneFocusHistory: restored.focusHistory,
      zoomedPaneId: null,
    });
  } else {
    useTerminalStore.setState({
      tabs: [...term.tabs.map((t) => ({ ...t, isActive: false })), ...restored.tabs],
      panes: { ...term.panes, ...restored.panes },
      activeTabId: restored.activeTabId,
      activePaneId: restored.activePaneId,
      paneFocusHistory: [...term.paneFocusHistory, ...restored.focusHistory],
      zoomedPaneId: null,
    });
  }
  return restored.idMap;
}

function newRecord(base: WorkspaceMeta, layout: string, now: string): WorkspaceMeta {
  return { ...base, layout, updatedAt: now };
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => {
  const find = (id: string) => get().workspaces.find((w) => w.id === id);

  /** Writes a record and mirrors it in the list. */
  const persist = async (record: WorkspaceMeta) => {
    await workspaceSave({
      id: record.id,
      name: record.name,
      icon: record.icon ?? null,
      layout: record.layout ?? "",
      isDefault: record.isDefault,
      createdAt: record.createdAt ?? record.updatedAt,
      updatedAt: record.updatedAt,
      lastOpenedAt: record.lastOpenedAt ?? null,
    });
    set((s) => ({
      workspaces: s.workspaces.some((w) => w.id === record.id)
        ? s.workspaces.map((w) => (w.id === record.id ? record : w))
        : [...s.workspaces, record],
    }));
  };

  return {
    workspaces: [],
    loaded: false,
    pendingBuffers: {},
    _buffersReadyPromise: null,

    load: async () => {
      try {
        const list = (await workspaceList()) as WorkspaceMeta[];
        set({ workspaces: list, loaded: true });
      } catch {
        set({ loaded: true });
      }
    },

    save: async (name) => {
      if (useTerminalStore.getState().tabs.length === 0) return null;
      const snapshot = await captureSnapshot();
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      await persist({
        id,
        name,
        icon: null,
        layout: JSON.stringify(snapshot),
        isDefault: false,
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: null,
      });
      return id;
    },

    update: async (id) => {
      const ws = find(id);
      if (!ws || useTerminalStore.getState().tabs.length === 0) return;
      let snapshot = await captureSnapshot();
      const previous = parseWorkspaceLayout(ws.layout);
      if (previous) snapshot = mergeStartupCommands(snapshot, previous);
      await persist(newRecord(ws, JSON.stringify(snapshot), new Date().toISOString()));
    },

    rename: async (id, name) => {
      const ws = find(id);
      const trimmed = name.trim();
      if (!ws || !trimmed) return;
      await persist({ ...ws, name: trimmed, updatedAt: new Date().toISOString() });
    },

    duplicate: async (id) => {
      const ws = find(id);
      const snapshot = parseWorkspaceLayout(ws?.layout);
      if (!ws || !snapshot) return null;
      const now = new Date().toISOString();
      const copy: WorkspaceMeta = {
        ...ws,
        id: crypto.randomUUID(),
        name: `${ws.name} copy`,
        layout: JSON.stringify(stripPaneIds(snapshot)),
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: null,
      };
      await persist(copy);
      return copy.id;
    },

    setStartupCommands: async (id, commands) => {
      const ws = find(id);
      const snapshot = parseWorkspaceLayout(ws?.layout);
      if (!ws || !snapshot) return;
      const next = setSnapshotStartupCommands(snapshot, commands);
      await persist(newRecord(ws, JSON.stringify(next), new Date().toISOString()));
    },

    restore: (id, mode = "replace") => {
      const ws = find(id);
      const snapshot = parseWorkspaceLayout(ws?.layout);
      if (!ws || !snapshot) return false;
      const idMap = applySnapshot(snapshot, mode);
      get().loadBuffersForRestore(idMap);
      const openedAt = new Date().toISOString();
      void persist({ ...ws, lastOpenedAt: openedAt }).catch(() => {});
      return true;
    },

    remove: async (id) => {
      await workspaceDelete(id);
      set((s) => ({ workspaces: s.workspaces.filter((w) => w.id !== id) }));
    },

    autoSave: async () => {
      if (useTerminalStore.getState().tabs.length === 0) return;
      const layout = JSON.stringify(buildSnapshot(currentSource()));
      const now = new Date().toISOString();
      const record: WorkspaceMeta = {
        id: SESSION_ID,
        name: SESSION_ID,
        icon: null,
        layout,
        isDefault: false,
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: null,
      };
      await workspaceSave({ ...record, lastOpenedAt: null }).catch(() => {});
      set((s) => ({ workspaces: [...s.workspaces.filter((w) => w.id !== SESSION_ID), record] }));
    },

    restoreSession: () => {
      const snapshot = parseWorkspaceLayout(find(SESSION_ID)?.layout);
      if (!snapshot) return false;
      get().loadBuffersForRestore(applySnapshot(snapshot, "replace"));
      return true;
    },

    consumeBuffer: (paneId) => {
      const buf = get().pendingBuffers[paneId];
      if (buf !== undefined) {
        set((s) => {
          const pendingBuffers = { ...s.pendingBuffers };
          delete pendingBuffers[paneId];
          return { pendingBuffers };
        });
      }
      return buf;
    },

    loadBuffersForRestore: (idMap) => {
      if (idMap.size === 0) return;
      const promise = bufferLoadBatch(Array.from(idMap.keys()))
        .then((entries) => {
          const pending: Record<string, string> = {};
          for (const entry of entries) {
            const newId = idMap.get(entry.paneId);
            if (newId && entry.bufferData) pending[newId] = entry.bufferData;
          }
          set({ pendingBuffers: pending });
        })
        .catch(() => {});
      set({ _buffersReadyPromise: promise });
    },
  };
});
