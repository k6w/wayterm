import React, { Suspense, useEffect, useState, useCallback } from "react";
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
import { BehindSettings } from "../components/settings/BehindSettings";
import { OPEN_SSH_CONFIG_IMPORT } from "../components/ssh/ssh-config-import";
import Scratchpad from "../components/terminal/Scratchpad";
import StatusBar from "../components/terminal/StatusBar";
import UpdateNotification from "./UpdateNotification";
import { PanelFallback } from "../components/PanelFallback";
import { lazyWithPreload, useEverTrue } from "../lib/lazy";
import { useTerminalStore } from "../stores/terminal";
import { useSettingsStore } from "../stores/settings";
import { useThemeStore } from "../stores/theme";
import { useSshStore } from "../stores/ssh";
import { useSftpStore } from "../stores/sftp";
import { useSidebarStore, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from "../stores/sidebar";
import { useWorkspaceStore } from "../stores/workspace";
import SaveWorkspaceDialog from "../components/sidebar/SaveWorkspaceDialog";
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
  const settingsOpen = useTerminalStore((s) => s.settingsOpen);
  const settingsMounted = useEverTrue(settingsOpen);
  const sshDialogMounted = useEverTrue(sshDialogOpen);
  const serialDialogMounted = useEverTrue(serialDialogOpen);
  const [sshConfigImportOpen, setSshConfigImportOpen] = useState(false);
  const sshConfigImportMounted = useEverTrue(sshConfigImportOpen);
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem("wayterm-welcomed"));

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
      void useSettingsStore.getState().flushPending();
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
    window.addEventListener("wayterm:open-serial", handler);
    return () => window.removeEventListener("wayterm:open-serial", handler);
  }, []);

  // The Connections toolbar, the palette and Settings open the ~/.ssh/config import this way.
  useEffect(() => {
    const handler = () => setSshConfigImportOpen(true);
    window.addEventListener(OPEN_SSH_CONFIG_IMPORT, handler);
    return () => window.removeEventListener(OPEN_SSH_CONFIG_IMPORT, handler);
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
          <BehindSettings>
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
                    <Suspense fallback={<PanelFallback />}>
                      <WelcomeWizard
                        onDismiss={() => {
                          localStorage.setItem("wayterm-welcomed", "1");
                          setShowWelcome(false);
                          newTerminal();
                        }}
                      />
                    </Suspense>
                  )}
                  {tabs.length === 0 && !showWelcome && (
                    <NoTabsState onNewTerminal={newTerminal} onNewSsh={handleNewSsh} />
                  )}
                </main>
              }
            />
          </BehindSettings>
          {settingsMounted && (
            <Suspense fallback={<PanelFallback />}>
              <SettingsView />
            </Suspense>
          )}
        </div>
        {tabPosition === "right" && <TabRail />}
      </div>
      {tabPosition === "bottom" && <TabRail />}
      <StatusBar />
      <CommandPalette />
      {sshDialogMounted && (
        <Suspense fallback={null}>
          <ConnectionDialog
            isOpen={sshDialogOpen}
            onClose={handleSshClose}
            onSave={handleSshSave}
            editConnection={editingConnection}
          />
        </Suspense>
      )}
      {serialDialogMounted && (
        <Suspense fallback={null}>
          <SerialDialog
            open={serialDialogOpen}
            onClose={() => setSerialDialogOpen(false)}
            onConnect={handleSerialConnect}
          />
        </Suspense>
      )}
      {sshConfigImportMounted && (
        <Suspense fallback={null}>
          <SshConfigImportDialog isOpen={sshConfigImportOpen} onClose={() => setSshConfigImportOpen(false)} />
        </Suspense>
      )}
      <Scratchpad />
      <SaveWorkspaceDialog />
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

const SettingsView = lazyWithPreload(() => import("../components/settings/SettingsView"));
const ConnectionDialog = lazyWithPreload(() => import("../components/ssh/ConnectionDialog"));
const SerialDialog = lazyWithPreload(() => import("../components/serial/SerialDialog"));
const SshConfigImportDialog = lazyWithPreload(() => import("../components/ssh/SshConfigImportDialog"));
const WelcomeWizard = lazyWithPreload(async () => ({ default: (await import("../components/welcome/WelcomeWizard")).WelcomeWizard }));

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
