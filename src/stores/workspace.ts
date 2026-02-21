import { create } from "zustand";
import type { WorkspaceMeta } from "../types/workspace";
import type { TerminalTab, TerminalPane, SplitNode } from "../types/terminal";
import { workspaceList, workspaceSave, workspaceDelete, bufferLoadBatch } from "../lib/ipc";
import { useTerminalStore, getFirstPaneId } from "./terminal";
import {
  getCachedTerminal,
  removeCachedTerminal,
} from "../lib/terminal-registry";
import { terminalKill } from "../lib/ipc";

/** Reserved ID for the auto-saved session state */
const SESSION_ID = "__session__";

interface WorkspaceState {
  workspaces: WorkspaceMeta[];
  loaded: boolean;
  /** Pending buffer data keyed by new pane ID, consumed once by TerminalPane */
  pendingBuffers: Record<string, string>;
  /** Promise that resolves when buffer data has been loaded from DB */
  _buffersReadyPromise: Promise<void> | null;
  load: () => Promise<void>;
  save: (name: string) => Promise<void>;
  restore: (id: string) => void;
  remove: (id: string) => Promise<void>;
  /** Overwrite an existing workspace with the current session state */
  update: (id: string) => Promise<void>;
  /** Auto-save current session (debounced externally) */
  autoSave: () => Promise<void>;
  /** Restore the auto-saved session. Returns true if a session was restored. */
  restoreSession: () => boolean;
  /** Consume (pop) a pending buffer for a pane, returns undefined if none */
  consumeBuffer: (paneId: string) => string | undefined;
  /** Load buffers from DB after a restore, remapping old→new pane IDs */
  loadBuffersForRestore: (idMap: Map<string, string>) => void;
}

/** Remap every paneId in a split tree using the provided id map */
function remapNode(
  node: SplitNode,
  idMap: Map<string, string>
): SplitNode {
  if (node.type === "pane" && node.paneId) {
    return { ...node, paneId: idMap.get(node.paneId) || node.paneId };
  }
  if (node.children) {
    return {
      ...node,
      children: [
        remapNode(node.children[0], idMap),
        remapNode(node.children[1], idMap),
      ],
    };
  }
  return node;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
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

  save: async (name: string) => {
    const { tabs, panes } = useTerminalStore.getState();
    const layout = JSON.stringify({ tabs, panes });
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await workspaceSave({
      id,
      name,
      icon: null,
      layout,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    });

    const current = get().workspaces;
    set({
      workspaces: [
        ...current,
        { id, name, icon: null, layout, isDefault: false, updatedAt: now },
      ],
    });
  },

  update: async (id: string) => {
    const ws = get().workspaces.find((w) => w.id === id);
    if (!ws) return;

    const { tabs, panes } = useTerminalStore.getState();
    const layout = JSON.stringify({ tabs, panes });
    const now = new Date().toISOString();

    await workspaceSave({
      id: ws.id,
      name: ws.name,
      icon: ws.icon ?? null,
      layout,
      isDefault: ws.isDefault,
      createdAt: ws.updatedAt, // preserve original timestamp
      updatedAt: now,
    });

    set((s) => ({
      workspaces: s.workspaces.map((w) =>
        w.id === id ? { ...w, layout, updatedAt: now } : w
      ),
    }));
  },

  restore: (id: string) => {
    const ws = get().workspaces.find((w) => w.id === id);
    if (!ws?.layout) return;

    let saved: { tabs: TerminalTab[]; panes: Record<string, TerminalPane> };
    try {
      saved = JSON.parse(ws.layout);
    } catch {
      return;
    }

    if (!saved.tabs?.length) return;

    // ── Kill all existing PTY sessions & caches ──
    const termState = useTerminalStore.getState();
    for (const paneId of Object.keys(termState.panes)) {
      const c = getCachedTerminal(paneId);
      if (c) {
        if (c.unlistenOutput) c.unlistenOutput();
        if (c.unlistenExit) c.unlistenExit();
        if (c.sessionId) terminalKill(c.sessionId).catch(() => {});
        c.terminal.dispose();
        removeCachedTerminal(paneId);
      }
    }

    // ── Build ID mapping: old pane ID → new pane ID ──
    const idMap = new Map<string, string>();
    for (const oldId of Object.keys(saved.panes)) {
      idMap.set(oldId, crypto.randomUUID());
    }

    // ── Recreate tabs with fresh IDs and remapped split trees ──
    const newTabs: TerminalTab[] = saved.tabs.map((tab, i) => ({
      ...tab,
      id: crypto.randomUUID(),
      panes: remapNode(tab.panes, idMap),
      isActive: i === saved.tabs.length - 1,
    }));

    // ── Recreate panes with new IDs (sessions will spawn on mount) ──
    const newPanes: Record<string, TerminalPane> = {};
    for (const [oldId, pane] of Object.entries(saved.panes)) {
      const newId = idMap.get(oldId)!;
      newPanes[newId] = {
        ...pane,
        id: newId,
        sessionId: "", // TerminalPane will spawn a new PTY
        blocks: [],
      };
    }

    const lastTab = newTabs[newTabs.length - 1];

    // ── Apply to terminal store ──
    useTerminalStore.setState({
      tabs: newTabs,
      panes: newPanes,
      activeTabId: lastTab.id,
      activePaneId: getFirstPaneId(lastTab.panes),
    });

    // Kick off buffer loading for named workspace restore
    get().loadBuffersForRestore(idMap);
  },

  remove: async (id: string) => {
    await workspaceDelete(id);
    set((s) => ({
      workspaces: s.workspaces.filter((w) => w.id !== id),
    }));
  },

  autoSave: async () => {
    const { tabs, panes } = useTerminalStore.getState();
    if (tabs.length === 0) return;

    const layout = JSON.stringify({ tabs, panes });
    const now = new Date().toISOString();

    await workspaceSave({
      id: SESSION_ID,
      name: "__session__",
      icon: null,
      layout,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    }).catch(() => {});

    // Update local list (replace existing __session__ entry or add it)
    set((s) => {
      const filtered = s.workspaces.filter((w) => w.id !== SESSION_ID);
      return {
        workspaces: [
          ...filtered,
          { id: SESSION_ID, name: "__session__", icon: null, layout, isDefault: false, updatedAt: now },
        ],
      };
    });
  },

  restoreSession: () => {
    const ws = get().workspaces.find((w) => w.id === SESSION_ID);
    if (!ws?.layout) return false;

    let saved: { tabs: TerminalTab[]; panes: Record<string, TerminalPane> };
    try {
      saved = JSON.parse(ws.layout);
    } catch {
      return false;
    }

    if (!saved.tabs?.length) return false;

    // ── Build ID mapping: old pane ID → new pane ID ──
    const idMap = new Map<string, string>();
    for (const oldId of Object.keys(saved.panes)) {
      idMap.set(oldId, crypto.randomUUID());
    }

    // ── Recreate tabs with fresh IDs and remapped split trees ──
    const newTabs: TerminalTab[] = saved.tabs.map((tab, i) => ({
      ...tab,
      id: crypto.randomUUID(),
      panes: remapNode(tab.panes, idMap),
      isActive: i === saved.tabs.length - 1,
    }));

    // ── Recreate panes with new IDs ──
    const newPanes: Record<string, TerminalPane> = {};
    for (const [oldId, pane] of Object.entries(saved.panes)) {
      const newId = idMap.get(oldId)!;
      newPanes[newId] = {
        ...pane,
        id: newId,
        sessionId: "",
        blocks: [],
      };
    }

    const lastTab = newTabs[newTabs.length - 1];

    useTerminalStore.setState({
      tabs: newTabs,
      panes: newPanes,
      activeTabId: lastTab.id,
      activePaneId: getFirstPaneId(lastTab.panes),
    });

    // Kick off buffer loading (async, TerminalPane will await the promise)
    get().loadBuffersForRestore(idMap);

    return true;
  },

  consumeBuffer: (paneId: string) => {
    const buf = get().pendingBuffers[paneId];
    if (buf !== undefined) {
      set((s) => {
        const { [paneId]: _, ...rest } = s.pendingBuffers;
        return { pendingBuffers: rest };
      });
    }
    return buf;
  },

  loadBuffersForRestore: (idMap: Map<string, string>) => {
    // old pane IDs are the keys of the map
    const oldIds = Array.from(idMap.keys());

    const promise = bufferLoadBatch(oldIds)
      .then((entries) => {
        const pending: Record<string, string> = {};
        for (const entry of entries) {
          const newId = idMap.get(entry.paneId);
          if (newId && entry.bufferData) {
            pending[newId] = entry.bufferData;
          }
        }
        set({ pendingBuffers: pending });
      })
      .catch(() => {
        // If loading fails, just proceed without buffers
      });

    set({ _buffersReadyPromise: promise });
  },
}));
