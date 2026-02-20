import { create } from "zustand";
import type { WorkspaceMeta } from "../types/workspace";
import type { TerminalTab, TerminalPane, SplitNode } from "../types/terminal";
import { workspaceList, workspaceSave, workspaceDelete } from "../lib/ipc";
import { useTerminalStore, getFirstPaneId } from "./terminal";
import {
  getCachedTerminal,
  removeCachedTerminal,
} from "../lib/terminal-registry";
import { terminalKill } from "../lib/ipc";

interface WorkspaceState {
  workspaces: WorkspaceMeta[];
  loaded: boolean;
  load: () => Promise<void>;
  save: (name: string) => Promise<void>;
  restore: (id: string) => void;
  remove: (id: string) => Promise<void>;
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
  },

  remove: async (id: string) => {
    await workspaceDelete(id);
    set((s) => ({
      workspaces: s.workspaces.filter((w) => w.id !== id),
    }));
  },
}));
