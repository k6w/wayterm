import React, { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { AppProviders } from "./providers";
import Titlebar from "../components/titlebar/Titlebar";
import SplitContainer from "../components/terminal/SplitContainer";
import Sidebar from "../components/sidebar/Sidebar";
import ActivityBar from "../components/sidebar/ActivityBar";
import CommandPalette from "../components/command-palette/CommandPalette";
import SettingsModal from "../components/settings/SettingsModal";
import ConnectionDialog from "../components/ssh/ConnectionDialog";
import SerialDialog from "../components/serial/SerialDialog";
import Scratchpad from "../components/terminal/Scratchpad";
import StatusBar from "../components/terminal/StatusBar";
import UpdateNotification from "../components/ui/UpdateNotification";
import { WelcomeScreen } from "../components/ui/WelcomeScreen";
import { useTerminalStore } from "../stores/terminal";
import { useSettingsStore } from "../stores/settings";
import { useThemeStore } from "../stores/theme";
import { useSshStore } from "../stores/ssh";
import { useSftpStore } from "../stores/sftp";
import { onSftpTransferProgress } from "../lib/ipc";
import { useWorkspaceStore } from "../stores/workspace";
import { getPreferredShell } from "../lib/shell-detect";
import { hexToRgba } from "../lib/color";
import { isMac, vibrancyAlpha } from "../lib/platform";
import {
  startBufferAutoSave,
  stopBufferAutoSave,
  saveAllBuffers,
} from "../lib/buffer-persistence";
import type { SshConnection, } from "../types/ssh";
import type { SerialConfig } from "../types/terminal";

function AppContent() {
  const tabs = useTerminalStore((s) => s.tabs);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const addTab = useTerminalStore((s) => s.addTab);
  const vibrancyEnabled = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const windowOpacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);
  const uiScale = useSettingsStore((s) => s.settings.appearance.uiScale);
  const tabPosition = useSettingsStore((s) => s.settings.appearance.tabPosition);
  const theme = useThemeStore((s) => s.active);
  const [sshDialogOpen, setSshDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<SshConnection | null>(null);
  const [serialDialogOpen, setSerialDialogOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem("nexterm-welcomed"));

  
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * uiScale}px`;
  }, [uiScale]);

  
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useTerminalStore.subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        useWorkspaceStore.getState().autoSave();
      }, 2000);
    });

    
    const handleUnload = () => {
      useWorkspaceStore.getState().autoSave();
      if (useSettingsStore.getState().settings.terminal.bufferPersistence) {
        saveAllBuffers();
      }
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      unsub();
      if (timer) clearTimeout(timer);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);

  
  const bufferPersistence = useSettingsStore((s) => s.settings.terminal.bufferPersistence);
  useEffect(() => {
    if (bufferPersistence) {
      startBufferAutoSave();
      return () => stopBufferAutoSave();
    }
    stopBufferAutoSave();
  }, [bufferPersistence]);

  
  useEffect(() => {
    const unlisten = listen<string>("cli-open-tab", (event) => {
      const defaultShellPath = useSettingsStore.getState().settings.general.defaultShell;
      const shell = getPreferredShell(defaultShellPath);
      addTab(shell.type, shell.path, undefined, event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [addTab]);

  
  useEffect(() => {
    const unlisten = onSftpTransferProgress((data) => {
      useSftpStore.getState().updateTransferProgress(
        data.transferId, data.bytesTransferred, data.totalBytes, data.status, data.error
      );
    });
    return () => { unlisten.then((fn) => fn()); };
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

  const handleSerialConnect = useCallback((config: SerialConfig) => {
    const paneId = addTab("serial");
    useTerminalStore.setState((s) => ({
      panes: { ...s.panes, [paneId]: { ...s.panes[paneId], serialConfig: config } },
    }));
  }, [addTab]);

  // Allow command palette and other components to trigger the serial dialog
  useEffect(() => {
    const handler = () => setSerialDialogOpen(true);
    window.addEventListener("nexterm:open-serial", handler);
    return () => window.removeEventListener("nexterm:open-serial", handler);
  }, []);

  return (
    <div
      className={`h-full w-full flex flex-col text-text-primary overflow-hidden ${
        isMac ? "" : "rounded-lg border border-border"
      } ${vibrancyEnabled ? "" : "bg-bg-primary"}`}
      style={
        vibrancyEnabled
          ? { backgroundColor: hexToRgba(theme.ui.bgPrimary, vibrancyAlpha(windowOpacity)) }
          : undefined
      }
    >
      {tabPosition === 'top' && <Titlebar />}
      <UpdateNotification />
      <div className="flex-1 min-h-0 flex flex-row overflow-hidden">
        {tabPosition === 'left' && <Titlebar />}
        <ActivityBar />
        <div className="flex-1 min-h-0 min-w-0 relative overflow-hidden">
          <Sidebar onNewSsh={handleNewSsh} onEditSsh={handleEditSsh} />
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className="absolute inset-0 p-[3px]"
              style={{ display: tab.id === activeTabId ? "block" : "none" }}
            >
              <SplitContainer node={tab.panes} />
            </div>
          ))}
          {tabs.length === 0 && showWelcome && (
            <WelcomeScreen onDismiss={() => {
              localStorage.setItem("nexterm-welcomed", "1");
              setShowWelcome(false);
              const shellPath = useSettingsStore.getState().settings.general.defaultShell;
              const shell = getPreferredShell(shellPath);
              addTab(shell.type, shell.path);
            }} />
          )}
          {tabs.length === 0 && !showWelcome && (
            <div className="h-full flex items-center justify-center text-text-muted">
              <p className="text-sm">No active session. Press {isMac ? "Cmd" : "Ctrl"}+T to open a new tab.</p>
            </div>
          )}
        </div>
        {tabPosition === 'right' && <Titlebar />}
      </div>
      {tabPosition === 'bottom' && <Titlebar />}
      <StatusBar />
      <CommandPalette />
      <SettingsModal />
      <ConnectionDialog
        isOpen={sshDialogOpen}
        onClose={handleSshClose}
        onSave={handleSshSave}
        editConnection={editingConnection}
      />
      <SerialDialog
        open={serialDialogOpen}
        onClose={() => setSerialDialogOpen(false)}
        onConnect={handleSerialConnect}
      />
      <Scratchpad />
    </div>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-[#1a1a2e] text-white p-8">
          <h1 className="text-xl font-semibold mb-4">Something went wrong</h1>
          <p className="text-sm text-gray-400 mb-6 max-w-md text-center font-mono">
            {this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded text-sm transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <AppContent />
      </AppProviders>
    </ErrorBoundary>
  );
}
