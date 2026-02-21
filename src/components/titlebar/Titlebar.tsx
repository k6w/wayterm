import { useCallback } from "react";
import { Menu } from "lucide-react";

import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTerminalStore } from "../../stores/terminal";
import { useSettingsStore } from "../../stores/settings";
import { useThemeStore } from "../../stores/theme";
import { hexToRgba } from "../../lib/color";
import { isMac } from "../../lib/platform";
import TabStrip from "./TabStrip";
import WindowControls from "./WindowControls";

export default function Titlebar() {
  const toggleSidebar = useTerminalStore((s) => s.toggleSidebar);
  const vibrancyEnabled = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const windowOpacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);
  const theme = useThemeStore((s) => s.active);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-drag], button, input, a')) return;
    getCurrentWindow().toggleMaximize();
  }, []);

  return (
    <div
      data-tauri-drag-region
      className={`flex w-full shrink-0 flex-col border-b border-border ${vibrancyEnabled ? "" : "bg-bg-secondary"}`}
      style={vibrancyEnabled ? { backgroundColor: hexToRgba(theme.ui.bgSecondary, windowOpacity) } : undefined}
      onDoubleClick={handleDoubleClick}
    >
      {/* Thin top strip — always part of the titlebar div, always draggable */}
      <div data-tauri-drag-region className="h-[3px] w-full shrink-0" />

      <div data-tauri-drag-region className="flex h-[37px] w-full items-center">
        {/* macOS: space for native traffic lights */}
        {isMac && <div className="w-[70px] shrink-0" />}
        <button
          className="flex h-full w-10 items-center justify-center text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
          onClick={toggleSidebar}
        >
          <Menu size={18} />
        </button>

        <TabStrip />
        <WindowControls />
      </div>
    </div>
  );
}
