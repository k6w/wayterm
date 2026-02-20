import { useEffect, useState, useCallback } from "react";
import { AppProviders } from "./providers";
import Titlebar from "../components/titlebar/Titlebar";
import SplitContainer from "../components/terminal/SplitContainer";
import Sidebar from "../components/sidebar/Sidebar";
import CommandPalette from "../components/command-palette/CommandPalette";
import SettingsModal from "../components/settings/SettingsModal";
import ConnectionDialog from "../components/ssh/ConnectionDialog";
import StatusBar from "../components/terminal/StatusBar";
import { useTerminalStore } from "../stores/terminal";
import { useSettingsStore } from "../stores/settings";
import { useThemeStore } from "../stores/theme";
import { useSshStore } from "../stores/ssh";
import { getDefaultShell } from "../lib/shell-detect";
import { hexToRgba } from "../lib/color";
import type { SshConnection } from "../types/ssh";

function AppContent() {
  const tabs = useTerminalStore((s) => s.tabs);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const addTab = useTerminalStore((s) => s.addTab);
  const vibrancyEnabled = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const windowOpacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);
  const theme = useThemeStore((s) => s.active);
  const [sshDialogOpen, setSshDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<SshConnection | null>(null);

  useEffect(() => {
    if (tabs.length === 0) {
      const shell = getDefaultShell();
      addTab(shell.type, shell.path);
    }
  }, []);

  const handleNewSsh = useCallback(() => {
    setEditingConnection(null);
    setSshDialogOpen(true);
  }, []);

  const handleEditSsh = useCallback((conn: SshConnection) => {
    setEditingConnection(conn);
    setSshDialogOpen(true);
  }, []);

  const handleSshSave = useCallback(
    async (connection: SshConnection) => {
      await useSshStore.getState().saveConnection(connection);
      setSshDialogOpen(false);
      setEditingConnection(null);
    },
    []
  );

  const handleSshClose = useCallback(() => {
    setSshDialogOpen(false);
    setEditingConnection(null);
  }, []);

  return (
    <div
      className={`h-full w-full flex flex-col text-text-primary overflow-hidden rounded-lg border border-border ${
        vibrancyEnabled ? "" : "bg-bg-primary"
      }`}
      style={
        vibrancyEnabled
          ? { backgroundColor: hexToRgba(theme.ui.bgPrimary, windowOpacity) }
          : undefined
      }
    >
      <Titlebar />
      <div className="flex-1 min-h-0 relative">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className="absolute inset-0 p-[3px]"
            style={{ display: tab.id === activeTabId ? "block" : "none" }}
          >
            <SplitContainer node={tab.panes} />
          </div>
        ))}
        {tabs.length === 0 && (
          <div className="h-full flex items-center justify-center text-text-muted">
            <p className="text-sm">No active session</p>
          </div>
        )}
      </div>
      <StatusBar />
      <Sidebar onNewSsh={handleNewSsh} onEditSsh={handleEditSsh} />
      <CommandPalette />
      <SettingsModal />
      <ConnectionDialog
        isOpen={sshDialogOpen}
        onClose={handleSshClose}
        onSave={handleSshSave}
        editConnection={editingConnection}
      />
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
