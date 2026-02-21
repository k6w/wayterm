import { Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useSettingsStore } from "../../stores/settings";

export default function WindowControls() {
  const appWindow = getCurrentWindow();
  const closeToTray = useSettingsStore((s) => s.settings.general.closeToTray);

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

  return (
    <div className="flex h-full items-center">
      <button
        className="flex h-8 w-[46px] items-center justify-center transition-colors hover:bg-white/10"
        onClick={handleMinimize}
      >
        <Minus className="size-4" />
      </button>
      <button
        className="flex h-8 w-[46px] items-center justify-center transition-colors hover:bg-white/10"
        onClick={handleMaximize}
      >
        <Square className="size-3.5" />
      </button>
      <button
        className="flex h-8 w-[46px] items-center justify-center transition-colors hover:bg-red-500/80"
        onClick={handleClose}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
