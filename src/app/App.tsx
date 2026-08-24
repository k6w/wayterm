import React, { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { MotionConfig } from "framer-motion";
import { AppProviders } from "./providers";
import NoTabsState from "./NoTabsState";
import Titlebar from "../components/titlebar/Titlebar";
import TabRail from "../components/titlebar/TabRail";
import SplitContainer from "../components/terminal/SplitContainer";
import Sidebar from "../components/sidebar/Sidebar";
import ActivityBar from "../components/sidebar/ActivityBar";
import CommandPalette from "../components/command-palette/CommandPalette";
import SettingsView from "../components/settings/SettingsView";
import ConnectionDialog from "../components/ssh/ConnectionDialog";
import SerialDialog from "../components/serial/SerialDialog";
import Scratchpad from "../components/terminal/Scratchpad";
import StatusBar from "../components/terminal/StatusBar";
import UpdateNotification from "./UpdateNotification";
import { WelcomeWizard } from "../components/welcome/WelcomeWizard";
import { useTerminalStore } from "../stores/terminal";
import { useSettingsStore } from "../stores/settings";
import { useThemeStore } from "../stores/theme";
import { useSshStore } from "../stores/ssh";
import { useSftpStore } from "../stores/sftp";
import { useSidebarStore, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from "../stores/sidebar";
import { useWorkspaceStore } from "../stores/workspace";
import { onSftpTransferProgress, setTrafficLightScale } from "../lib/ipc";
import { getPreferredShell } from "../lib/shell-detect";
import { isMac } from "../lib/platform";
import { applyAppearanceToDom } from "../lib/appearance";
import { startBufferAutoSave, stopBufferAutoSave, saveAllBuffers } from "../lib/buffer-persistence";
import { Button, SplitPane, Toaster, cn } from "../ui";
import type { SshConnection } from "../types/ssh";
import type { SerialConfig } from "../types/terminal";

function AppContent() {
  const tabs = useTerminalStore((s) => s.tabs);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const addTab = useTerminalStore((s) => s.addTab);
  const appearance = useSettingsStore((s) => s.settings.appearance);
  const tabPosition = useSettingsStore((s) => s.settings.appearance.tabPosition);
  const theme = useThemeStore((s) => s.active);
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const sidebarWidth = useSidebarStore((s) => s.width);
  const setSidebarWidth = useSidebarStore((s) => s.setWidth);
  const [sshDialogOpen, setSshDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<SshConnection | null>(null);
  const [serialDialogOpen, setSerialDialogOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem("nexterm-welcomed"));

  // Apply the non-theme appearance settings (UI font, accent override, blur,
  // density, zoom) whenever they or the active theme change, and keep the macOS
  // traffic lights aligned with the zoomed title bar.
  useEffect(() => {
    applyAppearanceToDom(appearance, theme);
    if (isMac) setTrafficLightScale(appearance.uiScale);
  }, [appearance, theme]);

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

  const newTerminal = useCallback(() => {
    const shell = getPreferredShell(useSettingsStore.getState().settings.general.defaultShell);
    addTab(shell.type, shell.path);
  }, [addTab]);

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden bg-canvas-glass text-fg",
        !isMac && "rounded-lg border border-border"
      )}
    >
      <Titlebar />
      <UpdateNotification />
      <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
        {tabPosition === "left" && <TabRail />}
        <ActivityBar />
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <SplitPane
            unit="px"
            ratio={sidebarWidth}
            onRatioChange={setSidebarWidth}
            min={SIDEBAR_MIN_WIDTH}
            max={SIDEBAR_MAX_WIDTH}
            collapsed={sidebarCollapsed}
            separatorLabel="Resize sidebar"
            first={<Sidebar onNewSsh={handleNewSsh} onEditSsh={handleEditSsh} />}
            second={
              <main aria-label="Terminals" className="relative h-full w-full">
                {tabs.map((tab) => (
                  <div key={tab.id} className={cn("absolute inset-0", tab.id !== activeTabId && "hidden")}>
                    <SplitContainer node={tab.panes} />
                  </div>
                ))}
                {tabs.length === 0 && showWelcome && (
                  <WelcomeWizard
                    onDismiss={() => {
                      localStorage.setItem("nexterm-welcomed", "1");
                      setShowWelcome(false);
                      newTerminal();
                    }}
                  />
                )}
                {tabs.length === 0 && !showWelcome && (
                  <NoTabsState onNewTerminal={newTerminal} onNewSsh={handleNewSsh} />
                )}
              </main>
            }
          />
          <SettingsView />
        </div>
        {tabPosition === "right" && <TabRail />}
      </div>
      {tabPosition === "bottom" && <TabRail />}
      <StatusBar />
      <CommandPalette />
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
      <Toaster />
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
        <div role="alert" className="flex h-full w-full flex-col items-center justify-center gap-4 bg-canvas p-8 text-fg">
          <h1 className="text-title font-semibold">Something went wrong</h1>
          <p className="max-w-md text-center font-mono text-label text-fg-muted">{this.state.error.message}</p>
          <Button variant="primary" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      {/* Framer Motion animations follow prefers-reduced-motion. */}
      <MotionConfig reducedMotion="user">
        <AppProviders>
          <AppContent />
        </AppProviders>
      </MotionConfig>
    </ErrorBoundary>
  );
}
