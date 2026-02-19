import { Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export default function WindowControls() {
  const appWindow = getCurrentWindow();

  const handleMinimize = () => {
    appWindow.minimize();
  };

  const handleMaximize = () => {
    appWindow.toggleMaximize();
  };

  const handleClose = () => {
    appWindow.close();
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
