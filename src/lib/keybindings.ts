import { useTerminalStore } from "../stores/terminal";
import type { TerminalPane } from "../types/terminal";
import { getDefaultShell } from "./shell-detect";

interface KeyAction {
  id: string;
  label: string;
  keys: string;
  handler: () => void;
}

const isMac = navigator.platform.toLowerCase().includes("mac");
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
    blocks: [],
    isActive: true,
    cwd: currentPane.cwd,
    shellType: currentPane.shellType || shell.type,
    shellPath: currentPane.shellPath,
  };
  splitPane(activePaneId, direction, newPane);
}

export function getDefaultKeybindings(): KeyAction[] {
  const store = useTerminalStore.getState();
  const shell = getDefaultShell();

  return [
    {
      id: "new-tab",
      label: "New Tab",
      keys: `${mod}+t`,
      handler: () => store.addTab(shell.type, shell.path),
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
      handler: () => store.toggleSidebar(),
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
  ];
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
  // Use CAPTURE phase so our handler fires BEFORE xterm's keydown handler.
  // This ensures app shortcuts (Ctrl+Tab, Ctrl+T, etc.) aren't swallowed
  // by the terminal when it has focus.
  const handler = (e: KeyboardEvent) => {
    const bindings = getDefaultKeybindings();
    const overrides = useTerminalStore.getState();
    if (overrides.settingsOpen || overrides.commandPaletteOpen) {
      if (e.key === "Escape") {
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
