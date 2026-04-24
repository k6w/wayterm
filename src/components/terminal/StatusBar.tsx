import { useState, useRef, useEffect } from "react";
import {
  Folder,
  Terminal,
  Columns2,
  Rows2,
  Bell,
  BellOff,
  Eraser,
  Palette,
  Settings,
  Command,
  LayoutGrid,
  Check,
  Sun,
  Moon,
  ArrowRightLeft,
  Search,
  Radio,
} from "lucide-react";
import { useTerminalStore, collectPaneIds } from "../../stores/terminal";
import { useThemeStore } from "../../stores/theme";
import { useSettingsStore } from "../../stores/settings";
import { useSshStore } from "../../stores/ssh";
import { hexToRgba } from "../../lib/color";
import { vibrancyAlpha } from "../../lib/platform";
import { getDefaultShell, getDefaultShells } from "../../lib/shell-detect";
import { shortenPath } from "../../lib/format";
import { splitActivePane } from "../../lib/keybindings";
import { clearBuffer } from "../../lib/terminal-registry";
import QuickPortForwardDialog from "../ssh/QuickPortForwardDialog";
import { GitStatusWidget } from "../git/GitStatusWidget";

const btnClass =
  "flex items-center justify-center h-5 w-5 rounded transition-colors cursor-pointer hover:bg-bg-tertiary";
const sectionBtn =
  "flex items-center gap-1.5 px-1.5 h-5 rounded transition-colors cursor-pointer hover:bg-bg-tertiary";

export default function StatusBar() {
  const activePaneId = useTerminalStore((s) => s.activePaneId);
  const pane = useTerminalStore((s) =>
    s.activePaneId ? s.panes[s.activePaneId] : null
  );
  const tabs = useTerminalStore((s) => s.tabs);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const focusNextPane = useTerminalStore((s) => s.focusNextPane);
  const toggleSettings = useTerminalStore((s) => s.toggleSettings);
  const toggleCommandPalette = useTerminalStore((s) => s.toggleCommandPalette);
  const broadcastMode = useTerminalStore((s) => s.broadcastMode);
  const toggleBroadcastMode = useTerminalStore((s) => s.toggleBroadcastMode);
  const isLogging = useTerminalStore((s) =>
    activePaneId ? s.loggingPanes.has(activePaneId) : false
  );
  const vibrancyEnabled = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const windowOpacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);
  const theme = useThemeStore((s) => s.active);

  const [copiedFlash, setCopiedFlash] = useState(false);
  const [bellEnabled, setBellEnabled] = useState(true);
  const [showQuickPortForward, setShowQuickPortForward] = useState(false);

  const handleSearchClick = () => {
    const event = new CustomEvent('nexterm:open-search');
    window.dispatchEvent(event);
  };

  const sshUsername = useSshStore((s) => {
    if (!pane?.sshConnectionId) return undefined;
    return s.connections.find((c) => c.id === pane.sshConnectionId)?.username;
  });

  const activeTunnelCount = useSshStore((s) =>
    s.portForwards.filter((f) => f.isActive).length
  );

  if (!pane || !activePaneId) return null;

  const displayPath = shortenPath(pane.cwd || "~", sshUsername);

  
  const allShells = getDefaultShells();
  const paneShell = pane.shellPath
    ? allShells.find((s) => s.path === pane.shellPath) ?? { label: pane.shellType, path: pane.shellPath }
    : allShells.find((s) => s.type === pane.shellType) ?? getDefaultShell();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const paneCount = activeTab ? countPanes(activeTab.panes) : 1;

  const allPaneIds = activeTab ? collectPaneIds(activeTab.panes) : [];
  const paneIndex = allPaneIds.indexOf(activePaneId) + 1;

  const handleCopyPath = async () => {
    const pathToCopy = pane.cwd || "~";
    try {
      await navigator.clipboard.writeText(pathToCopy);
      setCopiedFlash(true);
      setTimeout(() => setCopiedFlash(false), 1200);
    } catch {
      
    }
  };

  return (
    <div
      className={`shrink-0 flex items-center h-6 border-t border-border px-2 gap-0.5 text-[11px] text-text-muted select-none ${vibrancyEnabled ? "" : "bg-bg-secondary"}`}
      style={vibrancyEnabled ? { backgroundColor: hexToRgba(theme.ui.bgSecondary, vibrancyAlpha(windowOpacity)) } : undefined}
    >
      {}

      {}
      <button className={sectionBtn} title={`Shell: ${paneShell.path}`}>
        <Terminal size={12} className="shrink-0" />
        <span>{paneShell.label}</span>
      </button>

      <Separator />

      {}
      <button
        className={sectionBtn}
        onClick={handleCopyPath}
        title="Click to copy path"
      >
        <Folder size={12} className="shrink-0" />
        <span className="truncate max-w-[200px]">
          {copiedFlash ? "Copied!" : displayPath}
        </span>
      </button>

      {}
      <GitStatusWidget />

      {}
      {paneCount > 1 && (
        <>
          <Separator />
          <button
            className={sectionBtn}
            onClick={focusNextPane}
            title="Click to cycle panes"
          >
            <LayoutGrid size={12} className="shrink-0" />
            <span>
              Pane {paneIndex}/{paneCount}
            </span>
          </button>
        </>
      )}

      {}
      {pane.sshConnectionId && (
        <>
          <Separator />
          <span className={sectionBtn} title="SSH Connection">
            <span className="size-1.5 rounded-full bg-success shrink-0" />
            <span>SSH</span>
            {activeTunnelCount > 0 && (
              <span
                className="ml-0.5 rounded-full px-1 text-[9px] font-medium leading-none py-0.5 bg-accent text-white"
                title={`${activeTunnelCount} active tunnel${activeTunnelCount !== 1 ? "s" : ""}`}
              >
                {activeTunnelCount}
              </span>
            )}
          </span>
          <button
            className={btnClass}
            onClick={() => setShowQuickPortForward(true)}
            title="Quick Port Forward"
          >
            <ArrowRightLeft size={13} />
          </button>
        </>
      )}

      {}
      <div className="flex-1" />

      {}

      {}
      {isLogging && (
        <span
          className="flex items-center gap-1 px-1.5 h-5 text-[11px] text-error"
          title="Session logging active"
        >
          <span className="size-1.5 rounded-full bg-error animate-pulse shrink-0" />
          REC
        </span>
      )}

      {}
      <button
        className={`${btnClass} ${broadcastMode ? "text-accent bg-accent/15" : ""}`}
        onClick={toggleBroadcastMode}
        title={broadcastMode ? "Broadcast Input: ON (click to disable)" : "Broadcast Input: OFF"}
      >
        <Radio size={13} />
      </button>

      {}
      <button
        className={btnClass}
        onClick={handleSearchClick}
        title="Search in Terminal (Ctrl+F)"
      >
        <Search size={13} />
      </button>

      {}

      {}
      {pane.sshConnectionId && (
        <QuickPortForwardDialog
          isOpen={showQuickPortForward}
          onClose={() => setShowQuickPortForward(false)}
          connectionId={pane.sshConnectionId}
          sessionId={pane.sessionId}
        />
      )}

      {}
      <button
        className={btnClass}
        onClick={() => clearBuffer(activePaneId)}
        title="Clear terminal buffer"
      >
        <Eraser size={13} />
      </button>

      <Separator />

      {}
      <button
        className={btnClass}
        onClick={() => splitActivePane("horizontal")}
        title="Split Right"
      >
        <Columns2 size={13} />
      </button>
      <button
        className={btnClass}
        onClick={() => splitActivePane("vertical")}
        title="Split Down"
      >
        <Rows2 size={13} />
      </button>

      <Separator />

      {}
      <button
        className={btnClass}
        onClick={() => setBellEnabled((b) => !b)}
        title={bellEnabled ? "Mute bell" : "Unmute bell"}
      >
        {bellEnabled ? <Bell size={13} /> : <BellOff size={13} />}
      </button>

      {}
      <ThemePicker />

      {}
      <button
        className={btnClass}
        onClick={toggleCommandPalette}
        title="Command Palette"
      >
        <Command size={13} />
      </button>

      {}
      <button className={btnClass} onClick={toggleSettings} title="Settings">
        <Settings size={13} />
      </button>
    </div>
  );
}



function ThemePicker() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeThemeId = useThemeStore((s) => s.activeThemeId);
  const themes = useThemeStore((s) => s.themes);
  const setTheme = useThemeStore((s) => s.setTheme);
  const previewTheme = useThemeStore((s) => s.previewTheme);
  const tpTheme = useThemeStore((s) => s.active);
  const tpVibrancy = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const tpOpacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);
  const tpMenuBg = tpVibrancy
    ? hexToRgba(tpTheme.ui.bgSecondary, vibrancyAlpha(tpOpacity) * 0.85)
    : tpTheme.ui.bgSecondary;

  const themeList = Object.values(themes);

  
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        className="flex items-center justify-center h-5 w-5 rounded transition-colors cursor-pointer hover:bg-bg-tertiary"
        onClick={() => setOpen((o) => !o)}
        title={`Theme: ${themes[activeThemeId]?.name ?? activeThemeId}`}
      >
        <Palette size={13} />
      </button>

      {open && (
        <div
          className="absolute bottom-full right-0 mb-1.5 z-[200] min-w-[180px] max-h-[300px] overflow-y-auto rounded-lg border border-border py-1 shadow-xl"
          style={{
            backgroundColor: tpMenuBg,
            backdropFilter: tpVibrancy ? "blur(20px) saturate(1.3)" : undefined,
            WebkitBackdropFilter: tpVibrancy ? "blur(20px) saturate(1.3)" : undefined,
          }}
        >
          <div className="px-3 py-1.5 text-[10px] font-medium text-text-muted uppercase tracking-wider">
            Theme
          </div>
          {themeList.map((t) => (
            <button
              key={t.id}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-bg-tertiary ${
                t.id === activeThemeId ? "text-accent" : "text-text-primary"
              }`}
              onMouseEnter={() => previewTheme(t.id)}
              onMouseLeave={() => previewTheme(null)}
              onClick={() => {
                setTheme(t.id);
                setOpen(false);
              }}
            >
              {t.variant === "light" ? (
                <Sun size={12} className="shrink-0 text-text-muted" />
              ) : (
                <Moon size={12} className="shrink-0 text-text-muted" />
              )}
              <span className="flex-1 text-left">{t.name}</span>
              {t.id === activeThemeId && (
                <Check size={12} className="shrink-0 text-accent" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Separator() {
  return <div className="w-px h-3 bg-border mx-0.5" />;
}

function countPanes(node: { type: string; children?: [unknown, unknown] }): number {
  if (node.type === "pane") return 1;
  if (node.children) {
    return countPanes(node.children[0] as typeof node) + countPanes(node.children[1] as typeof node);
  }
  return 0;
}