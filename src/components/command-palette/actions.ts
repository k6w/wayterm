import {
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Columns2,
  Copy,
  Eraser,
  ExternalLink,
  Focus,
  Hash,
  MonitorDot,
  Palette,
  PanelLeft,
  Plus,
  RotateCcw,
  Rows2,
  Settings,
  SquareTerminal,
  Terminal,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTerminalStore } from "../../stores/terminal";
import { useSettingsStore } from "../../stores/settings";
import { useSshStore } from "../../stores/ssh";
import { getEffectiveKeybindings } from "../../lib/keybindings";
import { getDefaultShells } from "../../lib/shell-detect";
import { clearBuffer, getCachedTerminal, resetTerminal, writeToTerminal } from "../../lib/terminal-registry";
import { resolveSnippetVars } from "../../lib/snippet-utils";
import type { Snippet } from "../../types/settings";

/** Opens a nested list instead of running a handler. */
export type PaletteSubView = "themes";

export interface PaletteAction {
  id: string;
  label: string;
  /** Group heading the action is listed under. */
  category: string;
  icon: LucideIcon;
  /** Keybindings-format shortcut ("Meta+Shift+d"), rendered as a Kbd. */
  keys?: string;
  subView?: PaletteSubView;
  handler: () => void;
}

export interface HistoryEntry {
  id: number;
  command: string;
}

const KEYBINDING_ICONS: Record<string, LucideIcon> = {
  "new-tab": Plus,
  "close-tab": X,
  "close-pane": X,
  "toggle-sidebar": PanelLeft,
  "command-palette": ArrowRightLeft,
  settings: Settings,
  "split-horizontal": Columns2,
  "split-vertical": Rows2,
  "next-tab": ChevronRight,
  "prev-tab": ChevronLeft,
  "detach-pane": ExternalLink,
  "focus-next-pane": Focus,
  "focus-prev-pane": Focus,
  "focus-next-pane-arrow": Focus,
  "focus-prev-pane-arrow": Focus,
  "zoom-pane": Focus,
  "toggle-scratchpad": SquareTerminal,
};

const SHELL_ICONS: Record<string, LucideIcon> = {
  powershell: SquareTerminal,
  cmd: MonitorDot,
  gitbash: Hash,
  wsl: Terminal,
  bash: Terminal,
  zsh: Terminal,
  fish: Terminal,
  sh: Terminal,
};

function activePaneId(): string | null {
  return useTerminalStore.getState().activePaneId;
}

function runSnippet(snippet: Snippet): void {
  const paneId = activePaneId();
  if (!paneId) return;
  const pane = useTerminalStore.getState().panes[paneId];
  const conn = pane?.sshConnectionId
    ? useSshStore.getState().connections.find((c) => c.id === pane.sshConnectionId)
    : undefined;
  const resolved = resolveSnippetVars(snippet.command, {
    hostname: conn?.host ?? "localhost",
    username: conn?.username ?? "",
    cwd: pane?.cwd ?? "",
    paneId,
  });
  const entry = getCachedTerminal(paneId);
  if (!entry) return;
  resolved.split("\n").forEach((line, i) => {
    setTimeout(() => entry.terminal.paste(line + "\r"), i * 50);
  });
}

/**
 * Every command the palette lists, in display order: keybinding actions,
 * terminal actions, new-tab shells, appearance, serial and snippets. Read when
 * the palette opens, so new snippets and rebound keys show up without a reload.
 */
export function buildPaletteActions(): PaletteAction[] {
  const actions: PaletteAction[] = [];

  for (const binding of getEffectiveKeybindings()) {
    if (binding.id === "command-palette") continue;
    actions.push({
      id: binding.id,
      label: binding.label,
      keys: binding.keys,
      icon: KEYBINDING_ICONS[binding.id] ?? Terminal,
      category: "Actions",
      handler: binding.handler,
    });
  }

  actions.push(
    {
      id: "clear-buffer",
      label: "Clear Terminal Buffer",
      icon: Eraser,
      category: "Terminal",
      handler: () => {
        const paneId = activePaneId();
        if (paneId) clearBuffer(paneId);
      },
    },
    {
      id: "reset-terminal",
      label: "Reset Terminal",
      icon: RotateCcw,
      category: "Terminal",
      handler: () => {
        const paneId = activePaneId();
        if (paneId) resetTerminal(paneId);
      },
    },
    {
      id: "copy-cwd",
      label: "Copy Current Path",
      icon: Copy,
      category: "Terminal",
      handler: () => {
        const state = useTerminalStore.getState();
        const pane = state.activePaneId ? state.panes[state.activePaneId] : null;
        if (pane?.cwd) void navigator.clipboard.writeText(pane.cwd);
      },
    }
  );

  for (const shell of getDefaultShells()) {
    actions.push({
      id: `new-tab-${shell.type}-${shell.path}`,
      label: `New ${shell.label} Tab`,
      icon: SHELL_ICONS[shell.type] ?? Terminal,
      category: "New Tab",
      handler: () => {
        useTerminalStore.getState().addTab(shell.type, shell.path);
      },
    });
  }

  actions.push(
    {
      id: "change-theme",
      label: "Change Theme",
      icon: Palette,
      category: "Appearance",
      subView: "themes",
      handler: () => {},
    },
    {
      id: "toggle-scratchpad",
      label: "Toggle Scratchpad Terminal",
      icon: SquareTerminal,
      category: "Terminal",
      handler: () => {
        useTerminalStore.getState().toggleScratchpad();
      },
    },
    {
      id: "new-serial-tab",
      label: "New Serial / COM Port Tab",
      icon: Terminal,
      category: "New Tab",
      handler: () => {
        window.dispatchEvent(new Event("nexterm:open-serial"));
      },
    }
  );

  for (const snippet of useSettingsStore.getState().settings.snippets ?? []) {
    actions.push({
      id: `snippet-${snippet.id}`,
      label: snippet.name,
      icon: SquareTerminal,
      category: "Snippets",
      handler: () => runSnippet(snippet),
    });
  }

  return actions;
}

/** Recent shell commands as palette actions; choosing one types it into the active pane. */
export function historyActions(entries: readonly HistoryEntry[] | null | undefined): PaletteAction[] {
  return (entries ?? [])
    .filter((entry) => entry.command && entry.command.trim())
    .map((entry) => {
      const command = entry.command.trim();
      return {
        id: `history-${entry.id}`,
        label: command,
        icon: Clock,
        category: "History",
        handler: () => {
          const paneId = activePaneId();
          if (paneId) writeToTerminal(paneId, command + "\r");
        },
      };
    });
}
