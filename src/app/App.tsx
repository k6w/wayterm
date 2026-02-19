import { useEffect } from "react";
import { AppProviders } from "./providers";
import Titlebar from "../components/titlebar/Titlebar";
import SplitContainer from "../components/terminal/SplitContainer";
import { useTerminalStore } from "../stores/terminal";
import { getDefaultShell } from "../lib/shell-detect";

function AppContent() {
  const tabs = useTerminalStore((s) => s.tabs);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const addTab = useTerminalStore((s) => s.addTab);

  useEffect(() => {
    if (tabs.length === 0) {
      const shell = getDefaultShell();
      addTab(shell.type);
    }
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="h-full w-full flex flex-col bg-bg-primary text-text-primary overflow-hidden rounded-lg border border-border">
      <Titlebar />
      <div className="flex-1 min-h-0">
        {activeTab ? (
          <SplitContainer node={activeTab.panes} />
        ) : (
          <div className="h-full flex items-center justify-center text-text-muted">
            <p className="text-sm">No active session</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
}
