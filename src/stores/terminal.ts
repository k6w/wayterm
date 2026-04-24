import { create } from "zustand";
import type {
  TerminalTab,
  TerminalPane,
  SplitNode,
  Block,
  ShellType,
} from "../types/terminal";
import { getDefaultShell } from "../lib/shell-detect";

export type DropZone = "left" | "right" | "top" | "bottom" | null;

const SHELL_LABELS: Record<ShellType, string> = {
  powershell: "PowerShell",
  cmd: "CMD",
  gitbash: "Git Bash",
  wsl: "WSL",
  bash: "Bash",
  zsh: "Zsh",
  fish: "Fish",
  sh: "Shell",
  ssh: "SSH",
  sftp: "SFTP",
  serial: "Serial",
};

interface TerminalState {
  tabs: TerminalTab[];
  panes: Record<string, TerminalPane>;
  activeTabId: string | null;
  activePaneId: string | null;
  paneFocusHistory: string[];
  sidebarOpen: boolean;
  commandPaletteOpen: boolean;
  settingsOpen: boolean;
  zoomedPaneId: string | null;
  draggingTabId: string | null;
  dropTarget: { paneId: string; zone: DropZone } | null;
  dragOverPaneId: string | null;
  dragOverZone: DropZone;

  addTab: (shellType: ShellType, shellPath?: string, sshConnectionId?: string, initialCwd?: string) => string;
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
  mergeTabIntoPane: (
    sourceTabId: string,
    targetPaneId: string,
    zone: DropZone
  ) => void;

  setDraggingTab: (tabId: string | null) => void;
  setDropTarget: (target: { paneId: string; zone: DropZone } | null) => void;
  setDragOverPane: (paneId: string | null, zone: DropZone) => void;

  closePaneInTab: (paneId: string) => void;
  detachPaneToTab: (paneId: string) => void;
  duplicateTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeTabsToRight: (tabId: string) => void;
  focusNextPane: () => void;
  focusPrevPane: () => void;

  getPaneCount: (tabId?: string | null) => number;

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

  setBellAlert: (tabId: string, hasBell: boolean) => void;
  toggleZoom: () => void;
  toggleSidebar: () => void;
  toggleCommandPalette: () => void;
  toggleSettings: () => void;

  // Feature: Tab Color Labels
  setTabColor: (tabId: string, color: string | null) => void;

  // Feature: Broadcast Input
  broadcastMode: boolean;
  toggleBroadcastMode: () => void;

  // Feature: Terminal Scratchpad
  scratchpadOpen: boolean;
  scratchpadPaneId: string | null;
  toggleScratchpad: () => void;
  setScratchpadPane: (paneId: string | null) => void;

  // Feature: Session Logging
  loggingPanes: Set<string>;
  startLogging: (paneId: string) => void;
  stopLogging: (paneId: string) => void;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  tabs: [],
  panes: {},
  activeTabId: null,
  activePaneId: null,
  paneFocusHistory: [],
  zoomedPaneId: null,
  sidebarOpen: false,
  commandPaletteOpen: false,
  settingsOpen: false,
  draggingTabId: null,
  dropTarget: null,
  dragOverPaneId: null,
  dragOverZone: null,
  broadcastMode: false,
  scratchpadOpen: false,
  scratchpadPaneId: null,
  loggingPanes: new Set<string>(),

  addTab: (shellType: ShellType, shellPath?: string, sshConnectionId?: string, initialCwd?: string) => {
    const tabId = crypto.randomUUID();
    const paneId = crypto.randomUUID();
    const pane: TerminalPane = {
      id: paneId,
      sessionId: "",
      blocks: [],
      isActive: true,
      cwd: initialCwd || "",
      shellType,
      shellPath,
      sshConnectionId,
    };
    const tab: TerminalTab = {
      id: tabId,
      title: SHELL_LABELS[shellType] || shellType,
      icon: "terminal",
      shellType,
      panes: { type: "pane", paneId },
      isActive: true,
    };

    set((state) => {
      const history = state.paneFocusHistory.filter((id) => id !== paneId);
      history.push(paneId);
      return {
        tabs: [...state.tabs.map((t) => ({ ...t, isActive: false })), tab],
        panes: { ...state.panes, [paneId]: pane },
        activeTabId: tabId,
        activePaneId: paneId,
        paneFocusHistory: history,
      };
    });

    return paneId;
  },

  removeTab: (tabId: string) => {
    set((state) => {
      const tab = state.tabs.find((t) => t.id === tabId);
      if (!tab) return state;

      const paneIds = collectPaneIds(tab.panes);
      const removedSet = new Set(paneIds);
      const newPanes = { ...state.panes };
      paneIds.forEach((id) => delete newPanes[id]);

      const newTabs = state.tabs.filter((t) => t.id !== tabId);
      const newHistory = state.paneFocusHistory.filter((id) => !removedSet.has(id));
      let newActiveTabId = state.activeTabId;
      let newActivePaneId = state.activePaneId;

      if (newActiveTabId === tabId && newTabs.length > 0) {
        const closedIndex = state.tabs.findIndex((t) => t.id === tabId);
        const nextIndex = Math.min(closedIndex, newTabs.length - 1);
        const next = newTabs[nextIndex];
        newActiveTabId = next.id;
        newTabs.forEach((t) => (t.isActive = t.id === next.id));
        newActivePaneId = getFirstPaneId(next.panes);
      } else if (newTabs.length === 0) {
        newActiveTabId = null;
        newActivePaneId = null;
      }

      return {
        tabs: newTabs,
        panes: newPanes,
        activeTabId: newActiveTabId,
        activePaneId: newActivePaneId,
        paneFocusHistory: newHistory,
      };
    });
  },

  setActiveTab: (tabId: string) => {
    set((state) => {
      const tab = state.tabs.find((t) => t.id === tabId);
      if (!tab) return state;
      const tabPaneIds = new Set(collectPaneIds(tab.panes));
      const fromHistory = [...state.paneFocusHistory].reverse().find((id) => tabPaneIds.has(id));
      const targetPane = fromHistory ?? getFirstPaneId(tab.panes);
      return {
        tabs: state.tabs.map((t) => ({ ...t, isActive: t.id === tabId, hasBell: t.id === tabId ? false : t.hasBell })),
        activeTabId: tabId,
        activePaneId: targetPane,
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
    set((state) => {
      const history = state.paneFocusHistory.filter((id) => id !== paneId);
      history.push(paneId);
      if (history.length > 50) history.shift();
      return { activePaneId: paneId, paneFocusHistory: history };
    });
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
      const history = state.paneFocusHistory.filter((id) => id !== newPane.id);
      history.push(newPane.id);
      return { tabs: newTabs, panes: newPanes, activePaneId: newPane.id, paneFocusHistory: history };
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

  mergeTabIntoPane: (sourceTabId, targetPaneId, zone) => {
    if (!zone) return;
    set((state) => {
      const sourceTab = state.tabs.find((t) => t.id === sourceTabId);
      if (!sourceTab) return state;

      const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
      if (!activeTab || activeTab.id === sourceTabId) return state;

      const direction: "horizontal" | "vertical" =
        zone === "left" || zone === "right" ? "horizontal" : "vertical";
      const sourceFirst = zone === "left" || zone === "top";

      const sourcePaneTree = sourceTab.panes;
      const newTabs = state.tabs.filter((t) => t.id !== sourceTabId);

      const replacement: SplitNode = {
        type: "split",
        direction,
        ratio: 0.5,
        children: sourceFirst
          ? [sourcePaneTree, { type: "pane", paneId: targetPaneId }]
          : [{ type: "pane", paneId: targetPaneId }, sourcePaneTree],
      };

      const updatedTabs = newTabs.map((tab) =>
        tab.id === state.activeTabId
          ? { ...tab, panes: replacePaneInSplit(tab.panes, targetPaneId, replacement) }
          : tab
      );

      let newActiveTabId = state.activeTabId;
      let newActivePaneId = state.activePaneId;
      if (newActiveTabId === sourceTabId && updatedTabs.length > 0) {
        const last = updatedTabs[updatedTabs.length - 1];
        newActiveTabId = last.id;
        newActivePaneId = getFirstPaneId(last.panes);
      }

      return {
        tabs: updatedTabs.map((t) => ({ ...t, isActive: t.id === newActiveTabId })),
        activeTabId: newActiveTabId,
        activePaneId: newActivePaneId,
        draggingTabId: null,
        dropTarget: null,
      };
    });
  },

  setDraggingTab: (tabId) => set({ draggingTabId: tabId }),
  setDropTarget: (target) => set({ dropTarget: target }),
  setDragOverPane: (paneId, zone) => set({ dragOverPaneId: paneId, dragOverZone: zone }),

  closePaneInTab: (paneId: string) => {
    set((state) => {
      const tab = state.tabs.find((t) => collectPaneIds(t.panes).includes(paneId));
      if (!tab) return state;

      const paneCount = countPaneNodes(tab.panes);
      const newHistory = state.paneFocusHistory.filter((id) => id !== paneId);

      if (paneCount <= 1) {
        const newTabs = state.tabs.filter((t) => t.id !== tab.id);
        const newPanes = { ...state.panes };
        delete newPanes[paneId];

        let newActiveTabId = state.activeTabId;
        let newActivePaneId: string | null = state.activePaneId;

        if (newActiveTabId === tab.id && newTabs.length > 0) {
          const last = newTabs[newTabs.length - 1];
          newActiveTabId = last.id;
          newTabs.forEach((t) => (t.isActive = t.id === last.id));
          newActivePaneId = getFirstPaneId(last.panes);
        } else if (newTabs.length === 0) {
          newActiveTabId = null;
          newActivePaneId = null;
        }

        return { tabs: newTabs, panes: newPanes, activeTabId: newActiveTabId, activePaneId: newActivePaneId, paneFocusHistory: newHistory };
      }

      const newTree = removePaneFromTree(tab.panes, paneId);
      if (!newTree) return state;

      const newPanes = { ...state.panes };
      delete newPanes[paneId];

      const newTabs = state.tabs.map((t) =>
        t.id === tab.id ? { ...t, panes: newTree } : t
      );

      let newActivePaneId = state.activePaneId;
      if (state.activePaneId === paneId) {
        const remainingIds = new Set(collectPaneIds(newTree));
        const fromHistory = [...newHistory].reverse().find((id) => remainingIds.has(id));
        newActivePaneId = fromHistory ?? getFirstPaneId(newTree);
      }

      return { tabs: newTabs, panes: newPanes, activePaneId: newActivePaneId, paneFocusHistory: newHistory };
    });
  },

  detachPaneToTab: (paneId: string) => {
    set((state) => {
      const tab = state.tabs.find((t) => collectPaneIds(t.panes).includes(paneId));
      if (!tab) return state;

      if (countPaneNodes(tab.panes) <= 1) return state;

      const newTree = removePaneFromTree(tab.panes, paneId);
      if (!newTree) return state;

      const pane = state.panes[paneId];
      const shellType = pane?.shellType ?? "powershell";

      const newTabId = crypto.randomUUID();
      const newTab: TerminalTab = {
        id: newTabId,
        title: SHELL_LABELS[shellType] || shellType,
        icon: "terminal",
        shellType,
        panes: { type: "pane", paneId },
        isActive: true,
      };

      const updatedTabs = state.tabs.map((t) =>
        t.id === tab.id ? { ...t, panes: newTree, isActive: false } : { ...t, isActive: false }
      );

      return {
        tabs: [...updatedTabs, newTab],
        activeTabId: newTabId,
        activePaneId: paneId,
      };
    });
  },

  duplicateTab: (tabId: string) => {
    const state = get();
    const tab = state.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    
    const cloneTree = (node: SplitNode): SplitNode => {
      if (node.type === "pane") {
        const originalPane = state.panes[node.paneId!];
        if (!originalPane) {
          const newPaneId = crypto.randomUUID();
          const shell = getDefaultShell();
          const newPane: TerminalPane = {
            id: newPaneId,
            sessionId: "",
            blocks: [],
            isActive: false,
            cwd: "",
            shellType: tab.shellType,
            shellPath: shell.path,
          };
          set((s) => ({ panes: { ...s.panes, [newPaneId]: newPane } }));
          return { type: "pane", paneId: newPaneId };
        }
        
        const newPaneId = crypto.randomUUID();
        const newPane: TerminalPane = {
          id: newPaneId,
          sessionId: "",
          blocks: originalPane.blocks.map(block => ({
            ...block,
            id: crypto.randomUUID(),
            startedAt: new Date().toISOString(),
            finishedAt: block.finishedAt ? new Date().toISOString() : null,
          })),
          isActive: false,
          cwd: originalPane.cwd,
          shellType: originalPane.shellType,
          shellPath: originalPane.shellPath,
          sshConnectionId: originalPane.sshConnectionId,
          sftpConnectionId: originalPane.sftpConnectionId,
        };
        set((s) => ({ panes: { ...s.panes, [newPaneId]: newPane } }));
        return { type: "pane", paneId: newPaneId };
      } else {
        return {
          type: "split",
          direction: node.direction,
          ratio: node.ratio,
          children: [
            cloneTree(node.children![0]),
            cloneTree(node.children![1]),
          ],
        };
      }
    };
    
    const clonedPanesTree = cloneTree(tab.panes);
    
    const newTabId = crypto.randomUUID();
    const newTab: TerminalTab = {
      id: newTabId,
      title: `${tab.title} (Copy)`,
      icon: tab.icon,
      shellType: tab.shellType,
      panes: clonedPanesTree,
      isActive: true,
    };
    
    set((s) => ({
      tabs: [...s.tabs.map(t => ({ ...t, isActive: false })), newTab],
      activeTabId: newTabId,
      activePaneId: getFirstPaneId(clonedPanesTree),
    }));
  },

  closeOtherTabs: (tabId: string) => {
    const state = get();
    const toClose = state.tabs.filter((t) => t.id !== tabId);
    toClose.forEach((t) => get().removeTab(t.id));
    get().setActiveTab(tabId);
  },

  closeTabsToRight: (tabId: string) => {
    const state = get();
    const idx = state.tabs.findIndex((t) => t.id === tabId);
    if (idx < 0) return;
    const toClose = state.tabs.slice(idx + 1);
    toClose.forEach((t) => get().removeTab(t.id));
  },

  focusNextPane: () => {
    const state = get();
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!tab || !state.activePaneId) return;
    const ids = collectPaneIds(tab.panes);
    if (ids.length <= 1) return;
    const idx = ids.indexOf(state.activePaneId);
    set({ activePaneId: ids[(idx + 1) % ids.length] });
  },

  focusPrevPane: () => {
    const state = get();
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!tab || !state.activePaneId) return;
    const ids = collectPaneIds(tab.panes);
    if (ids.length <= 1) return;
    const idx = ids.indexOf(state.activePaneId);
    set({ activePaneId: ids[(idx - 1 + ids.length) % ids.length] });
  },

  getPaneCount: (tabId) => {
    const state = get();
    const id = tabId ?? state.activeTabId;
    const tab = state.tabs.find((t) => t.id === id);
    if (!tab) return 0;
    return countPaneNodes(tab.panes);
  },

  setBellAlert: (tabId, hasBell) => set((s) => ({
    tabs: s.tabs.map((t) => t.id === tabId ? { ...t, hasBell } : t),
  })),
  toggleZoom: () => set((s) => ({
    zoomedPaneId: s.zoomedPaneId === s.activePaneId ? null : s.activePaneId,
  })),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleCommandPalette: () =>
    set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),

  setTabColor: (tabId, color) => set((s) => ({
    tabs: s.tabs.map((t) =>
      t.id === tabId ? { ...t, colorTag: color ?? undefined } : t
    ),
  })),

  toggleBroadcastMode: () => set((s) => ({ broadcastMode: !s.broadcastMode })),

  toggleScratchpad: () => set((s) => ({ scratchpadOpen: !s.scratchpadOpen })),
  setScratchpadPane: (paneId) => set({ scratchpadPaneId: paneId }),

  startLogging: (paneId) => set((s) => {
    const next = new Set(s.loggingPanes);
    next.add(paneId);
    return { loggingPanes: next };
  }),
  stopLogging: (paneId) => set((s) => {
    const next = new Set(s.loggingPanes);
    next.delete(paneId);
    return { loggingPanes: next };
  }),
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

function removePaneFromTree(node: SplitNode, targetPaneId: string): SplitNode | null {
  if (node.type === "pane") {
    return node.paneId === targetPaneId ? null : node;
  }
  if (!node.children) return node;

  const [left, right] = node.children;

  if (left.type === "pane" && left.paneId === targetPaneId) return right;
  if (right.type === "pane" && right.paneId === targetPaneId) return left;

  const newLeft = removePaneFromTree(left, targetPaneId);
  const newRight = removePaneFromTree(right, targetPaneId);

  if (newLeft === null) return newRight;
  if (newRight === null) return newLeft;

  return { ...node, children: [newLeft, newRight] };
}

function countPaneNodes(node: SplitNode): number {
  if (node.type === "pane") return 1;
  if (node.children) {
    return countPaneNodes(node.children[0]) + countPaneNodes(node.children[1]);
  }
  return 0;
}

export { collectPaneIds, countPaneNodes, getFirstPaneId };
