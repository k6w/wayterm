import { Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useSettingsStore } from "../../stores/settings";
import { isMac } from "../../lib/platform";

export default function WindowControls() {
  const appWindow = getCurrentWindow();
  const closeToTray = useSettingsStore((s) => s.settings.general.closeToTray);
  const tabPosition = useSettingsStore((s) => s.settings.appearance.tabPosition);

  if (isMac) return null;

  const handleMinimize = () => {
    appWindow.minimize();
  };

  const handleMaximize = () => {
    appWindow.toggleMaximize();
  };

  const handleClose = () => {
    if (closeToTray) {
      appWindow.hide();
    } else {
      appWindow.close();
    }
  };

  const isVertical = tabPosition === 'left' || tabPosition === 'right';

  return (
    <div className={`flex items-center ${
      isVertical ? 'flex-col w-full border-t border-border' : 'h-full'
    }`}>
      <button
        className={`flex items-center justify-center transition-colors hover:bg-overlay/10 ${
          isVertical ? 'w-full h-[46px] border-b border-border' : 'h-8 w-[46px]'
        }`}
        onClick={handleMinimize}
      >
        <Minus className="size-4" />
      </button>
      <button
        className={`flex items-center justify-center transition-colors hover:bg-overlay/10 ${
          isVertical ? 'w-full h-[46px] border-b border-border' : 'h-8 w-[46px]'
        }`}
        onClick={handleMaximize}
      >
        <Square className="size-3.5" />
      </button>
      <button
        className={`flex items-center justify-center transition-colors hover:bg-red-500/80 ${
          isVertical ? 'w-full h-[46px]' : 'h-8 w-[46px]'
        }`}
        onClick={handleClose}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
