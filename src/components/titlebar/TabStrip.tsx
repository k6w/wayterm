import { Plus } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useTerminalStore } from "../../stores/terminal";
import { getDefaultShell } from "../../lib/shell-detect";
import Tab from "./Tab";

export default function TabStrip() {
  const tabs = useTerminalStore((s) => s.tabs);
  const addTab = useTerminalStore((s) => s.addTab);
  const removeTab = useTerminalStore((s) => s.removeTab);
  const setActiveTab = useTerminalStore((s) => s.setActiveTab);

  return (
    <div className="flex h-full min-w-0 flex-1 items-center">
      <div className="flex h-full items-center overflow-x-auto">
        <AnimatePresence initial={false}>
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              tab={tab}
              onClick={setActiveTab}
              onClose={removeTab}
            />
          ))}
        </AnimatePresence>
      </div>
      <button
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
        onClick={() => addTab(getDefaultShell().type)}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
