import { useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useSettingsStore } from "../../stores/settings";
import { useThemeStore } from "../../stores/theme";
import { hexToRgba } from "../../lib/color";
import { isMac, vibrancyAlpha } from "../../lib/platform";
import TabStrip from "./TabStrip";
import WindowControls from "./WindowControls";

export default function Titlebar() {
  const vibrancyEnabled = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const windowOpacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);
  const tabPosition = useSettingsStore((s) => s.settings.appearance.tabPosition);
  const theme = useThemeStore((s) => s.active);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (isMac) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-drag], button, input, a')) return;
    getCurrentWindow().toggleMaximize();
  }, []);

  const isVertical = tabPosition === 'left' || tabPosition === 'right';
  const borderClass = tabPosition === 'top' ? 'border-b' : 
                      tabPosition === 'bottom' ? 'border-t' : 
                      tabPosition === 'left' ? 'border-r' : 'border-l';

  return (
    <div
      data-tauri-drag-region
      className={`flex shrink-0 border-border ${vibrancyEnabled ? "" : "bg-bg-secondary"} ${
        isVertical 
          ? `flex-col w-[200px] h-full ${borderClass}` 
          : `flex-col w-full ${borderClass}`
      }`}
      style={vibrancyEnabled ? { backgroundColor: hexToRgba(theme.ui.bgSecondary, vibrancyAlpha(windowOpacity)) } : undefined}
      onDoubleClick={handleDoubleClick}
    >
      {!isVertical && <div data-tauri-drag-region className="h-[3px] w-full shrink-0" />}
      {isVertical && <div data-tauri-drag-region className="w-full h-[3px] shrink-0" />}

      <div data-tauri-drag-region className={`flex items-center ${
        isVertical ? 'flex-col w-full' : 'h-[37px] w-full'
      }`}>
        {isMac && !isVertical && <div className="w-[80px] shrink-0" />}

        <TabStrip />
        
        {!isVertical && <WindowControls />}
      </div>
      
      {isVertical && (
        <div className="mt-auto">
          <WindowControls />
        </div>
      )}
    </div>
  );
}
