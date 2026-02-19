import { create } from "zustand";
import type {
  TerminalTab,
  TerminalPane,
  SplitNode,
  Block,
  ShellType,
} from "../types/terminal";

interface TerminalState {
  tabs: TerminalTab[];
  panes: Record<string, TerminalPane>;
  activeTabId: string | null;
  activePaneId: string | null;
  sidebarOpen: boolean;
  commandPaletteOpen: boolean;
  settingsOpen: boolean;

  addTab: (shellType: ShellType) => string;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  renameTab: (tabId: string, title: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;

  addPane: (pane: TerminalPane) => void;
  removePane: (paneId: string) => void;
  setActivePane: (paneId: string) => void;
  updatePaneSession: (paneId: string, sessionId: string) => void;
  updatePaneCwd: (paneId: string, cwd: string) => void;

  splitPane: (
    paneId: string,
    direction: "horizontal" | "vertical",
    newPane: TerminalPane
  ) => void;

  addBlock: (paneId: string, block: Block) => void;
  updateBlock: (
    paneId: string,
    blockId: string,
    updates: Partial<Block>
  ) => void;
  appendBlockOutput: (
    paneId: string,
    blockId: string,
    output: string
  ) => void;

  toggleSidebar: () => void;
  toggleCommandPalette: () => void;
  toggleSettings: () => void;
}

export const useTerminalStore = create<TerminalState>((set, _get) => ({
  tabs: [],
  panes: {},
  activeTabId: null,
  activePaneId: null,
  sidebarOpen: false,
  commandPaletteOpen: false,
  settingsOpen: false,

  addTab: (shellType: ShellType) => {
    const tabId = crypto.randomUUID();
    const paneId = crypto.randomUUID();
    const pane: TerminalPane = {
      id: paneId,
      sessionId: "",
      blocks: [],
      isActive: true,
      cwd: "",
      shellType,
    };
    const tab: TerminalTab = {
      id: tabId,
      title: shellType,
      icon: "terminal",
      shellType,
      panes: { type: "pane", paneId },
      isActive: true,
    };

    set((state) => ({
      tabs: [...state.tabs.map((t) => ({ ...t, isActive: false })), tab],
      panes: { ...state.panes, [paneId]: pane },
      activeTabId: tabId,
      activePaneId: paneId,
    }));

    return paneId;
  },

  removeTab: (tabId: string) => {
    set((state) => {
      const tab = state.tabs.find((t) => t.id === tabId);
      if (!tab) return state;

      const paneIds = collectPaneIds(tab.panes);
      const newPanes = { ...state.panes };
      paneIds.forEach((id) => delete newPanes[id]);

      const newTabs = state.tabs.filter((t) => t.id !== tabId);
      let newActiveTabId = state.activeTabId;
      let newActivePaneId = state.activePaneId;

      if (newActiveTabId === tabId && newTabs.length > 0) {
        const last = newTabs[newTabs.length - 1];
        newActiveTabId = last.id;
        newTabs.forEach((t) => (t.isActive = t.id === last.id));
        newActivePaneId = getFirstPaneId(last.panes);
      } else if (newTabs.length === 0) {
        newActiveTabId = null;
        newActivePaneId = null;
      }

      return {
        tabs: newTabs,
        panes: newPanes,
        activeTabId: newActiveTabId,
        activePaneId: newActivePaneId,
      };
    });
  },

  setActiveTab: (tabId: string) => {
    set((state) => {
      const tab = state.tabs.find((t) => t.id === tabId);
      if (!tab) return state;
      const firstPane = getFirstPaneId(tab.panes);
      return {
        tabs: state.tabs.map((t) => ({ ...t, isActive: t.id === tabId })),
        activeTabId: tabId,
        activePaneId: firstPane,
      };
    });
  },

  renameTab: (tabId: string, title: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, title } : t)),
    }));
  },

  reorderTabs: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const newTabs = [...state.tabs];
      const [moved] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, moved);
      return { tabs: newTabs };
    });
  },

  addPane: (pane: TerminalPane) => {
    set((state) => ({
      panes: { ...state.panes, [pane.id]: pane },
    }));
  },

  removePane: (paneId: string) => {
    set((state) => {
      const newPanes = { ...state.panes };
      delete newPanes[paneId];
      return { panes: newPanes };
    });
  },

  setActivePane: (paneId: string) => {
    set({ activePaneId: paneId });
  },

  updatePaneSession: (paneId: string, sessionId: string) => {
    set((state) => ({
      panes: {
        ...state.panes,
        [paneId]: state.panes[paneId]
          ? { ...state.panes[paneId], sessionId }
          : state.panes[paneId],
      },
    }));
  },

  updatePaneCwd: (paneId: string, cwd: string) => {
    set((state) => ({
      panes: {
        ...state.panes,
        [paneId]: state.panes[paneId]
          ? { ...state.panes[paneId], cwd }
          : state.panes[paneId],
      },
    }));
  },

  splitPane: (paneId, direction, newPane) => {
    set((state) => {
      const newPanes = { ...state.panes, [newPane.id]: newPane };
      const newTabs = state.tabs.map((tab) => ({
        ...tab,
        panes: replacePaneInSplit(tab.panes, paneId, {
          type: "split" as const,
          direction,
          ratio: 0.5,
          children: [
            { type: "pane" as const, paneId },
            { type: "pane" as const, paneId: newPane.id },
          ],
        }),
      }));
      return { tabs: newTabs, panes: newPanes, activePaneId: newPane.id };
    });
  },

  addBlock: (paneId: string, block: Block) => {
    set((state) => {
      const pane = state.panes[paneId];
      if (!pane) return state;
      return {
        panes: {
          ...state.panes,
          [paneId]: { ...pane, blocks: [...pane.blocks, block] },
        },
      };
    });
  },

  updateBlock: (paneId, blockId, updates) => {
    set((state) => {
      const pane = state.panes[paneId];
      if (!pane) return state;
      return {
        panes: {
          ...state.panes,
          [paneId]: {
            ...pane,
            blocks: pane.blocks.map((b) =>
              b.id === blockId ? { ...b, ...updates } : b
            ),
          },
        },
      };
    });
  },

  appendBlockOutput: (paneId, blockId, output) => {
    set((state) => {
      const pane = state.panes[paneId];
      if (!pane) return state;
      return {
        panes: {
          ...state.panes,
          [paneId]: {
            ...pane,
            blocks: pane.blocks.map((b) =>
              b.id === blockId ? { ...b, output: b.output + output } : b
            ),
          },
        },
      };
    });
  },

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleCommandPalette: () =>
    set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
}));

function collectPaneIds(node: SplitNode): string[] {
  if (node.type === "pane" && node.paneId) return [node.paneId];
  if (node.children) return node.children.flatMap(collectPaneIds);
  return [];
}

function getFirstPaneId(node: SplitNode): string | null {
  if (node.type === "pane") return node.paneId || null;
  if (node.children) return getFirstPaneId(node.children[0]);
  return null;
}

function replacePaneInSplit(
  node: SplitNode,
  targetPaneId: string,
  replacement: SplitNode
): SplitNode {
  if (node.type === "pane" && node.paneId === targetPaneId) return replacement;
  if (node.children) {
    return {
      ...node,
      children: [
        replacePaneInSplit(node.children[0], targetPaneId, replacement),
        replacePaneInSplit(node.children[1], targetPaneId, replacement),
      ],
    };
  }
  return node;
}
