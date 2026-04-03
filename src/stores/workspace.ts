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

const SESSION_ID = "__session__";

interface WorkspaceState {
  workspaces: WorkspaceMeta[];
  loaded: boolean;
  pendingBuffers: Record<string, string>;
  _buffersReadyPromise: Promise<void> | null;
  load: () => Promise<void>;
  save: (name: string) => Promise<void>;
  restore: (id: string) => void;
  remove: (id: string) => Promise<void>;
  update: (id: string) => Promise<void>;
  autoSave: () => Promise<void>;
  restoreSession: () => boolean;
  consumeBuffer: (paneId: string) => string | undefined;
  loadBuffersForRestore: (idMap: Map<string, string>) => void;
}

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

    const idMap = new Map<string, string>();
    for (const oldId of Object.keys(saved.panes)) {
      idMap.set(oldId, crypto.randomUUID());
    }

    const newTabs: TerminalTab[] = saved.tabs.map((tab) => ({
      ...tab,
      id: crypto.randomUUID(),
      panes: remapNode(tab.panes, idMap),
      isActive: tab.isActive,
    }));

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

    const activeTab = newTabs.find(tab => tab.isActive);
    const activeTabId = activeTab?.id ?? newTabs[newTabs.length - 1]?.id;
    const activePaneId = activeTab ? getFirstPaneId(activeTab.panes) : null;

    useTerminalStore.setState({
      tabs: newTabs,
      panes: newPanes,
      activeTabId,
      activePaneId,
    });

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

    const idMap = new Map<string, string>();
    for (const oldId of Object.keys(saved.panes)) {
      idMap.set(oldId, crypto.randomUUID());
    }

    const newTabs: TerminalTab[] = saved.tabs.map((tab) => ({
      ...tab,
      id: crypto.randomUUID(),
      panes: remapNode(tab.panes, idMap),
      isActive: tab.isActive,
    }));

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

    const activeTab = newTabs.find(tab => tab.isActive);
    const activeTabId = activeTab?.id ?? newTabs[newTabs.length - 1]?.id;
    const activePaneId = activeTab ? getFirstPaneId(activeTab.panes) : null;

    useTerminalStore.setState({
      tabs: newTabs,
      panes: newPanes,
      activeTabId,
      activePaneId,
    });

    get().loadBuffersForRestore(idMap);

    return true;
  },

  consumeBuffer: (paneId: string) => {
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

  loadBuffersForRestore: (idMap: Map<string, string>) => {
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
      });

    set({ _buffersReadyPromise: promise });
  },
}));
