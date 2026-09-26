import { useTerminalStore } from "../stores/terminal";
import { useSidebarStore } from "../stores/sidebar";
import { useSettingsStore } from "../stores/settings";
import type { TerminalPane } from "../types/terminal";
import { getDefaultShell, getPreferredShell } from "./shell-detect";
import { isMac } from "./platform";
import { isOverlayOpen } from "./overlays";
import { copySelection, pasteToTerminal } from "./terminal-registry";
import {
  blocksWhen,
  clearBlockSelection,
  copySelectedBlockOutput,
  hasBlockSelection,
  jumpToBlock,
  activeBlocks,
} from "./blocks/block-keys";

export interface KeyAction {
  id: string;
  label: string;
  keys: string;
  handler: () => void;
  /** When present and false, the key is not taken: it goes to the next binding or the terminal. */
  when?: () => boolean;
  /** Shares its keys on purpose with this binding, which gets them whenever `when` is false. */
  fallsThroughTo?: string;
}

const mod = isMac ? "Meta" : "Control";

export function splitActivePane(direction: "horizontal" | "vertical") {
  const { activePaneId, panes, splitPane } = useTerminalStore.getState();
  if (!activePaneId) return;
  const currentPane = panes[activePaneId];
  if (!currentPane) return;
  const shell = getDefaultShell();
  const newPane: TerminalPane = {
    id: crypto.randomUUID(),
    sessionId: "",
    isActive: true,
    cwd: currentPane.cwd,
    shellType: currentPane.shellType || shell.type,
    shellPath: currentPane.shellPath,
  };
  splitPane(activePaneId, direction, newPane);
}

export function getDefaultKeybindings(): KeyAction[] {
  const store = useTerminalStore.getState();

  return [
    {
      id: "new-tab",
      label: "New Tab",
      keys: `${mod}+t`,
      handler: () => {
        const shell = getPreferredShell(useSettingsStore.getState().settings.general.defaultShell);
        store.addTab(shell.type, shell.path);
      },
    },
    {
      id: "close-tab",
      label: "Close Tab",
      keys: `${mod}+w`,
      handler: () => {
        const { activeTabId, removeTab } = useTerminalStore.getState();
        if (activeTabId) removeTab(activeTabId);
      },
    },
    {
      id: "toggle-sidebar",
      label: "Toggle Sidebar",
      keys: `${mod}+b`,
      handler: () => useSidebarStore.getState().toggle(),
    },
    {
      id: "command-palette",
      label: "Command Palette",
      keys: `${mod}+Shift+p`,
      handler: () => store.toggleCommandPalette(),
    },
    {
      id: "settings",
      label: "Settings",
      keys: `${mod}+,`,
      handler: () => store.toggleSettings(),
    },
    {
      id: "split-horizontal",
      label: "Split Horizontal",
      keys: `${mod}+Shift+d`,
      handler: () => splitActivePane("horizontal"),
    },
    {
      id: "split-vertical",
      label: "Split Vertical",
      keys: `${mod}+Shift+e`,
      handler: () => splitActivePane("vertical"),
    },
    {
      id: "next-tab",
      label: "Next Tab",
      keys: `${mod}+Tab`,
      handler: () => {
        const { tabs, activeTabId, setActiveTab } =
          useTerminalStore.getState();
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        if (idx >= 0 && tabs.length > 1) {
          setActiveTab(tabs[(idx + 1) % tabs.length].id);
        }
      },
    },
    {
      id: "prev-tab",
      label: "Previous Tab",
      keys: `${mod}+Shift+Tab`,
      handler: () => {
        const { tabs, activeTabId, setActiveTab } =
          useTerminalStore.getState();
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        if (idx >= 0 && tabs.length > 1) {
          setActiveTab(tabs[(idx - 1 + tabs.length) % tabs.length].id);
        }
      },
    },
    {
      id: "zoom-pane",
      label: "Toggle Zoom Pane",
      keys: `${mod}+Shift+Enter`,
      handler: () => useTerminalStore.getState().toggleZoom(),
    },
    {
      id: "close-pane",
      label: "Close Pane",
      keys: `${mod}+Shift+w`,
      handler: () => {
        const { activePaneId, closePaneInTab } = useTerminalStore.getState();
        if (activePaneId) closePaneInTab(activePaneId);
      },
    },
    {
      id: "detach-pane",
      label: "Detach Pane to Tab",
      keys: `${mod}+Shift+t`,
      handler: () => {
        const { activePaneId, detachPaneToTab } = useTerminalStore.getState();
        if (activePaneId) detachPaneToTab(activePaneId);
      },
    },
    {
      id: "focus-next-pane",
      label: "Focus Next Pane",
      keys: `Alt+]`,
      handler: () => useTerminalStore.getState().focusNextPane(),
    },
    {
      id: "focus-prev-pane",
      label: "Focus Previous Pane",
      keys: `Alt+[`,
      handler: () => useTerminalStore.getState().focusPrevPane(),
    },
    {
      id: "focus-next-pane-arrow",
      label: "Focus Next Pane (Arrow)",
      keys: `Alt+ArrowRight`,
      handler: () => useTerminalStore.getState().focusNextPane(),
    },
    {
      id: "focus-prev-pane-arrow",
      label: "Focus Previous Pane (Arrow)",
      keys: `Alt+ArrowLeft`,
      handler: () => useTerminalStore.getState().focusPrevPane(),
    },
    {
      id: "toggle-scratchpad",
      label: "Toggle Scratchpad",
      keys: "Alt+`",
      handler: () => useTerminalStore.getState().toggleScratchpad(),
    },
    ...blockBindings(),
    {
      id: "copy",
      label: "Copy",
      keys: `Control+Shift+c`,
      handler: () => {
        const { activePaneId } = useTerminalStore.getState();
        if (activePaneId) copySelection(activePaneId);
      },
    },
    {
      id: "paste",
      label: "Paste",
      keys: `Control+Shift+v`,
      handler: () => {
        const { activePaneId } = useTerminalStore.getState();
        if (activePaneId) pasteToTerminal(activePaneId);
      },
    },
    {
      id: "search-terminal",
      label: "Search in Terminal",
      keys: `${mod}+f`,
      handler: () => {},
    },
    {
      id: "clipboard-manager",
      label: "Clipboard Manager",
      keys: `${mod}+Shift+v`,
      handler: () => useSidebarStore.getState().activate("clipboard"),
    },
    ...selectTabBindings(),
  ];
}

/**
 * Command block navigation. Off macOS, Ctrl+Up/Down belong to vim and tmux, so these use
 * Ctrl+Shift; every one applies only at the shell (see blocksWhen), never in full-screen apps.
 */
function blockBindings(): KeyAction[] {
  const keys = isMac
    ? { prev: "Meta+ArrowUp", next: "Meta+ArrowDown", extendUp: "Meta+Shift+ArrowUp", extendDown: "Meta+Shift+ArrowDown", copy: "Meta+c" }
    : {
        prev: "Control+Shift+ArrowUp",
        next: "Control+Shift+ArrowDown",
        extendUp: "Control+Alt+Shift+ArrowUp",
        extendDown: "Control+Alt+Shift+ArrowDown",
        copy: "Control+Shift+c",
      };
  return [
    { id: "block-prev", label: "Previous Command Block", keys: keys.prev, when: blocksWhen, handler: () => jumpToBlock(-1) },
    { id: "block-next", label: "Next Command Block", keys: keys.next, when: blocksWhen, handler: () => jumpToBlock(1) },
    {
      id: "block-select-extend-up",
      label: "Extend Block Selection Up",
      keys: keys.extendUp,
      when: blocksWhen,
      handler: () => jumpToBlock(-1, true),
    },
    {
      id: "block-select-extend-down",
      label: "Extend Block Selection Down",
      keys: keys.extendDown,
      when: blocksWhen,
      handler: () => jumpToBlock(1, true),
    },
    {
      id: "block-copy-output",
      label: "Copy Block Output",
      keys: keys.copy,
      // Only with blocks selected and no text selected; otherwise the key copies text as usual.
      when: () => blocksWhen() && hasBlockSelection() && !activeBlocks()?.term.hasSelection(),
      fallsThroughTo: isMac ? undefined : "copy",
      handler: copySelectedBlockOutput,
    },
    {
      id: "block-clear-selection",
      label: "Clear Block Selection",
      keys: "Escape",
      when: () => blocksWhen() && hasBlockSelection(),
      handler: clearBlockSelection,
    },
  ];
}

/** Mod+1 .. Mod+9 select tab 1..9; a number past the last tab does nothing. */
function selectTabBindings(): KeyAction[] {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({
    id: `select-tab-${n}`,
    label: `Select Tab ${n}`,
    keys: `${mod}+${n}`,
    handler: () => {
      const { tabs, setActiveTab } = useTerminalStore.getState();
      const tab = tabs[n - 1];
      if (tab) setActiveTab(tab.id);
    },
  }));
}


export function getEffectiveKeybindings(): KeyAction[] {
  const defaultBindings = getDefaultKeybindings();
  const userKeybindings = useSettingsStore.getState().settings.keybindings;
  
  if (!userKeybindings || Object.keys(userKeybindings).length === 0) {
    return defaultBindings;
  }
  
  return defaultBindings.map(binding => {
    const userKeys = userKeybindings[binding.id];
    if (userKeys) {
      return {
        ...binding,
        keys: userKeys
      };
    }
    return binding;
  });
}

function matchesKeybinding(e: KeyboardEvent, keys: string): boolean {
  const parts = keys.split("+");
  const key = parts[parts.length - 1].toLowerCase();
  const needCtrl = parts.includes("Control");
  const needMeta = parts.includes("Meta");
  const needShift = parts.includes("Shift");
  const needAlt = parts.includes("Alt");

  return (
    e.key.toLowerCase() === key &&
    e.ctrlKey === needCtrl &&
    e.metaKey === needMeta &&
    e.shiftKey === needShift &&
    e.altKey === needAlt
  );
}

export function setupKeybindings(): () => void {
  
  
  
  const handler = (e: KeyboardEvent) => {
    const bindings = getEffectiveKeybindings();
    const overrides = useTerminalStore.getState();
    if (overrides.settingsOpen || overrides.commandPaletteOpen) {
      if (e.key === "Escape") {
        // An open select/menu/popover/dialog closes first; Radix handles that Escape.
        if (isOverlayOpen()) return;
        if (overrides.settingsOpen) useTerminalStore.getState().toggleSettings();
        if (overrides.commandPaletteOpen)
          useTerminalStore.getState().toggleCommandPalette();
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
    for (const binding of bindings) {
      if (matchesKeybinding(e, binding.keys)) {
        if (binding.when && !binding.when()) continue;
        e.preventDefault();
        e.stopPropagation();
        binding.handler();
        return;
      }
    }
  };

  window.addEventListener("keydown", handler, true);
  return () => window.removeEventListener("keydown", handler, true);
}
