import type { MouseEvent } from "react";
import { Columns2, Search, Settings } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useSettingsStore } from "../../stores/settings";
import { useTerminalStore } from "../../stores/terminal";
import { isMac, MAC_TRAFFIC_LIGHT_INSET } from "../../lib/platform";
import { splitActivePane } from "../../lib/keybindings";
import { shortcutFor } from "../../lib/shortcut-hints";
import { Button, ICON_SM, IconButton, Toolbar, ToolbarButton } from "../../ui";
import TabStrip from "./TabStrip";
import WindowControls from "./WindowControls";

/**
 * The unified 36px title bar: macOS traffic-light inset, the tab strip (when
 * tabs sit along the top), the command palette trigger, split and settings,
 * and on Windows/Linux the window controls. It is always the top row of the
 * window; tabs placed left/right/bottom render in TabRail instead.
 */
export default function Titlebar() {
  const tabPosition = useSettingsStore((s) => s.settings.appearance.tabPosition);
  const uiScale = useSettingsStore((s) => s.settings.appearance.uiScale);
  const hasActivePane = useTerminalStore((s) => s.tabs.length > 0 && s.activePaneId !== null);
  const toggleCommandPalette = useTerminalStore((s) => s.toggleCommandPalette);
  const toggleSettings = useTerminalStore((s) => s.toggleSettings);

  const handleDoubleClick = (e: MouseEvent) => {
    if (isMac) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-drag], button, input, a")) return;
    void getCurrentWindow().toggleMaximize();
  };

  return (
    <header
      data-tauri-drag-region
      onDoubleClick={handleDoubleClick}
      className="nx-blur flex h-9 w-full shrink-0 items-center border-b border-border bg-tabbar-glass"
    >
      {/* Divide by the zoom so the gap stays the native width of the
          (unscaled) traffic lights. */}
      {isMac && (
        <div
          data-tauri-drag-region
          aria-hidden
          className="h-full shrink-0"
          style={{ width: MAC_TRAFFIC_LIGHT_INSET / uiScale }}
        />
      )}
      {tabPosition === "top" ? <TabStrip /> : <div data-tauri-drag-region className="h-full min-w-0 flex-1" />}
      <Toolbar aria-label="Window actions" className="h-full shrink-0 gap-1 px-2">
        <ToolbarButton>
          <Button
            variant="secondary"
            size="sm"
            className="w-48"
            leadingIcon={<Search {...ICON_SM} />}
            shortcut={shortcutFor("command-palette")}
            onClick={toggleCommandPalette}
          >
            <span className="flex-1 truncate text-left font-normal text-fg-muted">Search or run…</span>
          </Button>
        </ToolbarButton>
        <ToolbarButton>
          <IconButton
            label="Split pane right"
            icon={<Columns2 {...ICON_SM} />}
            shortcut={shortcutFor("split-horizontal")}
            tooltipSide="bottom"
            disabled={!hasActivePane}
            onClick={() => splitActivePane("horizontal")}
          />
        </ToolbarButton>
        <ToolbarButton>
          <IconButton
            label="Settings"
            icon={<Settings {...ICON_SM} />}
            shortcut={shortcutFor("settings")}
            tooltipSide="bottom"
            onClick={toggleSettings}
          />
        </ToolbarButton>
      </Toolbar>
      <WindowControls />
    </header>
  );
}
