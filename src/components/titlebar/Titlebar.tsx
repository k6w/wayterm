import { Menu } from "lucide-react";
import { useTerminalStore } from "../../stores/terminal";
import TabStrip from "./TabStrip";
import WindowControls from "./WindowControls";

export default function Titlebar() {
  const toggleSidebar = useTerminalStore((s) => s.toggleSidebar);

  return (
    <div
      data-tauri-drag-region
      className="flex h-10 w-full shrink-0 items-center border-b border-border bg-bg-secondary"
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
