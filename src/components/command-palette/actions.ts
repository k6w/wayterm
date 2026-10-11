import { Icons, type IconComponent } from "../../ui/icons";
import { useTerminalStore } from "../../stores/terminal";
import { useSettingsStore } from "../../stores/settings";
import { useSshStore } from "../../stores/ssh";
import { useWorkspaceStore } from "../../stores/workspace";
import { openSaveWorkspace } from "../sidebar/save-workspace";
import { getEffectiveKeybindings } from "../../lib/keybindings";
import { activeBlocks } from "../../lib/blocks/block-keys";
import { getDefaultShells } from "../../lib/shell-detect";
import { openProfileTab } from "../../lib/profiles";
import { clearBuffer, getCachedTerminal, resetTerminal, writeToTerminal } from "../../lib/terminal-registry";
import { resolveSnippetVars } from "../../lib/snippet-utils";
import { toast } from "../../stores/toast";
import { openSshConfigImport } from "../ssh/ssh-config-import";
import type { Snippet } from "../../types/settings";

/** Opens a nested list instead of running a handler. */
export type PaletteSubView = "themes";

export interface PaletteAction {
  id: string;
  label: string;
  /** Group heading the action is listed under. */
  category: string;
  icon: IconComponent;
  /** Muted text after the label, e.g. the user@host of a connection. */
  detail?: string;
  /** Keybindings-format shortcut ("Meta+Shift+d"), rendered as a Kbd. */
  keys?: string;
  subView?: PaletteSubView;
  handler: () => void;
}

export interface HistoryEntry {
  id: number;
  command: string;
}

const KEYBINDING_ICONS: Record<string, IconComponent> = {
  "new-tab": Icons.add,
  "close-tab": Icons.close,
  "close-pane": Icons.close,
  "toggle-sidebar": Icons.sidebar,
  "command-palette": Icons.commandPalette,
  settings: Icons.settings,
  "split-horizontal": Icons.splitHorizontal,
  "split-vertical": Icons.splitVertical,
  "next-tab": Icons.nextTab,
  "prev-tab": Icons.prevTab,
  "detach-pane": Icons.detach,
  "focus-next-pane": Icons.focusPane,
  "focus-prev-pane": Icons.focusPane,
  "focus-next-pane-arrow": Icons.focusPane,
  "focus-prev-pane-arrow": Icons.focusPane,
  "zoom-pane": Icons.focusPane,
  "toggle-scratchpad": Icons.scratchpad,
  "block-prev": Icons.blockPrevious,
  "block-next": Icons.blockNext,
  "block-select-extend-up": Icons.blockExtendUp,
  "block-select-extend-down": Icons.blockExtendDown,
  "block-copy-output": Icons.copyOutput,
  "block-clear-selection": Icons.blockDeselect,
};

const SHELL_ICONS: Record<string, IconComponent> = {
  powershell: Icons.shellPowerShell,
  cmd: Icons.shellCmd,
  gitbash: Icons.shellGitBash,
  wsl: Icons.terminal,
  bash: Icons.terminal,
  zsh: Icons.terminal,
  fish: Icons.terminal,
  sh: Icons.terminal,
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
    // Command block actions only where the focused pane has blocks.
    if (binding.id.startsWith("block-") && !activeBlocks()) continue;
    actions.push({
      id: binding.id,
      label: binding.label,
      keys: binding.keys,
      icon: KEYBINDING_ICONS[binding.id] ?? Icons.terminal,
      category: "Actions",
      handler: binding.handler,
    });
  }

  actions.push(
    {
      id: "clear-buffer",
      label: "Clear Terminal Buffer",
      icon: Icons.clear,
      category: "Terminal",
      handler: () => {
        const paneId = activePaneId();
        if (paneId) clearBuffer(paneId);
      },
    },
    {
      id: "reset-terminal",
      label: "Reset Terminal",
      icon: Icons.reset,
      category: "Terminal",
      handler: () => {
        const paneId = activePaneId();
        if (paneId) resetTerminal(paneId);
      },
    },
    {
      id: "copy-cwd",
      label: "Copy Current Path",
      icon: Icons.copy,
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
      icon: SHELL_ICONS[shell.type] ?? Icons.terminal,
      category: "New Tab",
      handler: () => {
        useTerminalStore.getState().addTab(shell.type, shell.path);
      },
    });
  }

  for (const profile of useSettingsStore.getState().settings.profiles) {
    actions.push({
      id: `new-tab-profile-${profile.id}`,
      label: `New ${profile.name} Tab`,
      icon: Icons.terminal,
      category: "New Tab",
      handler: () => {
        openProfileTab(profile, useSettingsStore.getState().settings);
      },
    });
  }

  actions.push(
    {
      id: "change-theme",
      label: "Change Theme",
      icon: Icons.theme,
      category: "Appearance",
      subView: "themes",
      handler: () => {},
    },
    {
      id: "toggle-pane-dimming",
      label: "Toggle inactive pane dimming",
      icon: Icons.focusPane,
      category: "Appearance",
      handler: () => {
        const { settings, update } = useSettingsStore.getState();
        void update("appearance", { dimInactivePanes: !settings.appearance.dimInactivePanes });
      },
    },
    {
      id: "toggle-scratchpad",
      label: "Toggle Scratchpad Terminal",
      icon: Icons.scratchpad,
      category: "Terminal",
      handler: () => {
        useTerminalStore.getState().toggleScratchpad();
      },
    },
    {
      id: "import-ssh-config",
      label: "Import from ~/.ssh/config",
      icon: Icons.importSshConfig,
      category: "SSH",
      handler: openSshConfigImport,
    },
    {
      id: "new-serial-tab",
      label: "New Serial / COM Port Tab",
      icon: Icons.terminal,
      category: "New Tab",
      handler: () => {
        window.dispatchEvent(new Event("wayterm:open-serial"));
      },
    }
  );

  const hasTabs = useTerminalStore.getState().tabs.length > 0;
  for (const ws of useWorkspaceStore.getState().workspaces) {
    if (ws.id === "__session__") continue;
    actions.push({
      id: `open-workspace-${ws.id}`,
      label: `Open workspace: ${ws.name}`,
      // Nothing to choose between in a palette: never close tabs that are open.
      detail: hasTabs ? "Adds to current tabs" : undefined,
      icon: Icons.workspace,
      category: "Workspaces",
      handler: () => {
        if (!useWorkspaceStore.getState().restore(ws.id, hasTabs ? "add" : "replace")) {
          toast.error(`Could not open "${ws.name}": its saved layout is unreadable.`);
        }
      },
    });
  }
  actions.push({
    id: "save-workspace",
    label: "Save current layout as workspace…",
    icon: Icons.save,
    category: "Workspaces",
    handler: openSaveWorkspace,
  });

  for (const snippet of useSettingsStore.getState().settings.snippets ?? []) {
    actions.push({
      id: `snippet-${snippet.id}`,
      label: snippet.name,
      icon: Icons.newTerminal,
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
        icon: Icons.recent,
        category: "History",
        handler: () => {
          const paneId = activePaneId();
          if (paneId) writeToTerminal(paneId, command + "\r");
        },
      };
    });
}
