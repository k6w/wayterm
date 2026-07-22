import { useState } from "react";
import {
  ArrowRightLeft,
  Bell,
  BellOff,
  Columns2,
  Command,
  Eraser,
  Folder,
  LayoutGrid,
  Moon,
  Palette,
  Radio,
  Rows2,
  Search,
  Settings,
  Sun,
  Terminal,
} from "lucide-react";
import { useTerminalStore, collectPaneIds } from "../../stores/terminal";
import { useThemeStore } from "../../stores/theme";
import { useSshStore } from "../../stores/ssh";
import { getDefaultShell, getDefaultShells } from "../../lib/shell-detect";
import { shortenPath } from "../../lib/format";
import { splitActivePane } from "../../lib/keybindings";
import { clearBuffer } from "../../lib/terminal-registry";
import { shortcutFor } from "../../lib/shortcut-hints";
import { selectTheme } from "../../lib/theme-selection";
import QuickPortForwardDialog from "../ssh/QuickPortForwardDialog";
import { GitStatusWidget } from "../git/GitStatusWidget";
import {
  Badge,
  Button,
  ICON_SM,
  IconButton,
  Menu,
  MenuContent,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
  Toolbar,
  ToolbarButton,
  ToolbarSeparator,
  ToolbarSpacer,
  Tooltip,
} from "../../ui";

/**
 * Bottom status bar. One Toolbar: Tab enters it, arrow keys move between its
 * controls, and every icon button has a tooltip with its shortcut.
 */
export default function StatusBar() {
  const activePaneId = useTerminalStore((s) => s.activePaneId);
  const pane = useTerminalStore((s) => (s.activePaneId ? s.panes[s.activePaneId] : null));
  const tabs = useTerminalStore((s) => s.tabs);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const focusNextPane = useTerminalStore((s) => s.focusNextPane);
  const toggleSettings = useTerminalStore((s) => s.toggleSettings);
  const toggleCommandPalette = useTerminalStore((s) => s.toggleCommandPalette);
  const broadcastMode = useTerminalStore((s) => s.broadcastMode);
  const toggleBroadcastMode = useTerminalStore((s) => s.toggleBroadcastMode);
  const isLogging = useTerminalStore((s) => (activePaneId ? s.loggingPanes.has(activePaneId) : false));

  const [copiedFlash, setCopiedFlash] = useState(false);
  const [bellEnabled, setBellEnabled] = useState(true);
  const [showQuickPortForward, setShowQuickPortForward] = useState(false);

  const sshUsername = useSshStore((s) => {
    if (!pane?.sshConnectionId) return undefined;
    return s.connections.find((c) => c.id === pane.sshConnectionId)?.username;
  });
  const activeTunnelCount = useSshStore((s) => s.portForwards.filter((f) => f.isActive).length);

  if (!pane || !activePaneId) return null;

  const displayPath = shortenPath(pane.cwd || "~", sshUsername);

  const allShells = getDefaultShells();
  const paneShell = pane.shellPath
    ? allShells.find((s) => s.path === pane.shellPath) ?? { label: pane.shellType, path: pane.shellPath }
    : allShells.find((s) => s.type === pane.shellType) ?? getDefaultShell();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const allPaneIds = activeTab ? collectPaneIds(activeTab.panes) : [];
  const paneCount = Math.max(allPaneIds.length, 1);
  const paneIndex = allPaneIds.indexOf(activePaneId) + 1;

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(pane.cwd || "~");
      setCopiedFlash(true);
      setTimeout(() => setCopiedFlash(false), 1200);
    } catch {
      // Clipboard permission denied: nothing to copy to.
    }
  };

  return (
    <Toolbar
      aria-label="Status bar"
      className="nx-blur h-6 shrink-0 select-none gap-0.5 border-t border-border bg-statusbar-glass px-2 text-caption text-fg-muted"
    >
      <Tooltip content={`Shell: ${paneShell.path}`}>
        <ToolbarButton>
          <Button variant="ghost" size="xs" leadingIcon={<Terminal {...ICON_SM} />}>
            {paneShell.label}
          </Button>
        </ToolbarButton>
      </Tooltip>

      <ToolbarSeparator />

      <Tooltip content="Copy path">
        <ToolbarButton>
          <Button
            variant="ghost"
            size="xs"
            leadingIcon={<Folder {...ICON_SM} />}
            className="max-w-[240px]"
            onClick={handleCopyPath}
          >
            <span className="truncate">{copiedFlash ? "Copied!" : displayPath}</span>
          </Button>
        </ToolbarButton>
      </Tooltip>

      <GitStatusWidget />

      {paneCount > 1 && (
        <>
          <ToolbarSeparator />
          <Tooltip content="Focus next pane">
            <ToolbarButton>
              <Button variant="ghost" size="xs" leadingIcon={<LayoutGrid {...ICON_SM} />} onClick={focusNextPane}>
                Pane {paneIndex}/{paneCount}
              </Button>
            </ToolbarButton>
          </Tooltip>
        </>
      )}

      {pane.sshConnectionId && (
        <>
          <ToolbarSeparator />
          <span className="flex items-center gap-1.5 px-1.5">
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-success" />
            SSH
            {activeTunnelCount > 0 && (
              <Badge tone="solid" aria-label={`${activeTunnelCount} active tunnel${activeTunnelCount === 1 ? "" : "s"}`}>
                {activeTunnelCount}
              </Badge>
            )}
          </span>
          <ToolbarButton>
            <IconButton
              size="xs"
              label="Quick port forward"
              icon={<ArrowRightLeft {...ICON_SM} />}
              onClick={() => setShowQuickPortForward(true)}
            />
          </ToolbarButton>
          <QuickPortForwardDialog
            isOpen={showQuickPortForward}
            onClose={() => setShowQuickPortForward(false)}
            connectionId={pane.sshConnectionId}
            sessionId={pane.sessionId}
          />
        </>
      )}

      <ToolbarSpacer />

      {isLogging && (
        <Badge tone="danger" className="mr-1" aria-label="Session logging active">
          <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-danger motion-reduce:animate-none" />
          REC
        </Badge>
      )}

      <ToolbarButton>
        <IconButton
          size="xs"
          label="Broadcast input to all panes"
          icon={<Radio {...ICON_SM} />}
          pressed={broadcastMode}
          onClick={toggleBroadcastMode}
        />
      </ToolbarButton>
      <ToolbarButton>
        <IconButton
          size="xs"
          label="Search in terminal"
          icon={<Search {...ICON_SM} />}
          shortcut={shortcutFor("search-terminal")}
          onClick={() => window.dispatchEvent(new CustomEvent("nexterm:open-search"))}
        />
      </ToolbarButton>
      <ToolbarButton>
        <IconButton
          size="xs"
          label="Clear terminal"
          icon={<Eraser {...ICON_SM} />}
          onClick={() => clearBuffer(activePaneId)}
        />
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton>
        <IconButton
          size="xs"
          label="Split right"
          icon={<Columns2 {...ICON_SM} />}
          shortcut={shortcutFor("split-horizontal")}
          onClick={() => splitActivePane("horizontal")}
        />
      </ToolbarButton>
      <ToolbarButton>
        <IconButton
          size="xs"
          label="Split down"
          icon={<Rows2 {...ICON_SM} />}
          shortcut={shortcutFor("split-vertical")}
          onClick={() => splitActivePane("vertical")}
        />
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton>
        <IconButton
          size="xs"
          label={bellEnabled ? "Mute bell" : "Unmute bell"}
          icon={bellEnabled ? <Bell {...ICON_SM} /> : <BellOff {...ICON_SM} />}
          onClick={() => setBellEnabled((b) => !b)}
        />
      </ToolbarButton>
      <ThemePicker />
      <ToolbarButton>
        <IconButton
          size="xs"
          label="Command palette"
          icon={<Command {...ICON_SM} />}
          shortcut={shortcutFor("command-palette")}
          onClick={toggleCommandPalette}
        />
      </ToolbarButton>
      <ToolbarButton>
        <IconButton
          size="xs"
          label="Settings"
          icon={<Settings {...ICON_SM} />}
          shortcut={shortcutFor("settings")}
          onClick={toggleSettings}
        />
      </ToolbarButton>
    </Toolbar>
  );
}

/**
 * Theme menu. Moving through the list (mouse or arrow keys) previews each
 * theme; choosing one applies and saves it; closing without a choice reverts.
 */
function ThemePicker() {
  const activeThemeId = useThemeStore((s) => s.activeThemeId);
  const themes = useThemeStore((s) => s.themes);
  const previewTheme = useThemeStore((s) => s.previewTheme);
  const activeName = themes[activeThemeId]?.name ?? activeThemeId;

  return (
    <Menu
      onOpenChange={(open) => {
        if (!open) previewTheme(null);
      }}
    >
      <ToolbarButton>
        <MenuTrigger asChild>
          <IconButton size="xs" label={`Theme: ${activeName}`} icon={<Palette {...ICON_SM} />} />
        </MenuTrigger>
      </ToolbarButton>
      <MenuContent side="top" align="end" className="max-h-80 overflow-y-auto">
        <MenuLabel>Theme</MenuLabel>
        <MenuRadioGroup value={activeThemeId} onValueChange={(id) => void selectTheme(id)}>
          {Object.values(themes).map((theme) => (
            <MenuRadioItem key={theme.id} value={theme.id} onFocus={() => previewTheme(theme.id)}>
              {theme.variant === "light" ? (
                <Sun {...ICON_SM} aria-hidden className="text-fg-muted" />
              ) : (
                <Moon {...ICON_SM} aria-hidden className="text-fg-muted" />
              )}
              {theme.name}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
