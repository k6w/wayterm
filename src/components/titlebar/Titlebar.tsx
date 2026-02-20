import { useCallback } from "react";
import { Menu } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTerminalStore } from "../../stores/terminal";
import { useSettingsStore } from "../../stores/settings";
import { useThemeStore } from "../../stores/theme";
import { hexToRgba } from "../../lib/color";
import TabStrip from "./TabStrip";
import WindowControls from "./WindowControls";

export default function Titlebar() {
  const toggleSidebar = useTerminalStore((s) => s.toggleSidebar);
  const vibrancyEnabled = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const windowOpacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);
  const theme = useThemeStore((s) => s.active);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start window drag from empty titlebar space
    const target = e.target as HTMLElement;
    if (target.closest('button, [draggable="true"], input, a, [role="button"]')) return;
    if (e.button !== 0) return;
    getCurrentWindow().startDragging();
  }, []);

  return (
    <div
      className={`flex h-10 w-full shrink-0 items-center border-b border-border ${vibrancyEnabled ? "" : "bg-bg-secondary"}`}
      style={vibrancyEnabled ? { backgroundColor: hexToRgba(theme.ui.bgSecondary, windowOpacity) } : undefined}
      onMouseDown={handleMouseDown}
    >
      <button
        className="flex size-10 items-center justify-center text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
        onClick={toggleSidebar}
      >
        <Menu className="size-4" />
      </button>

      <TabStrip />
      <WindowControls />
    </div>
  );
}
