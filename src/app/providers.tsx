import { useEffect } from "react";
import { useThemeStore, applyThemeToDom } from "../stores/theme";
import { useSettingsStore } from "../stores/settings";
import { useWorkspaceStore } from "../stores/workspace";
import { useSshStore } from "../stores/ssh";
import { useTerminalStore } from "../stores/terminal";
import { useSidebarStore } from "../stores/sidebar";
import { setupKeybindings } from "../lib/keybindings";
import { setVibrancy, getLaunchCwd } from "../lib/ipc";
import { hexToRgb } from "../lib/color";
import { initHomePath } from "../lib/format";
import { getPreferredShell } from "../lib/shell-detect";
import { applyStartupTheme } from "../lib/theme-migration";


function syncVibrancy(enabled: boolean, opacity: number) {
  const theme = useThemeStore.getState().active;
  const [r, g, b] = hexToRgb(theme.ui.bgPrimary);
  const a = Math.round(opacity * 255);
  setVibrancy(enabled, r, g, b, a).catch(() => {});
}

let startupDone = false;

export function AppProviders({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.active);
  const vibrancyEnabled = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const windowOpacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);

  
  useEffect(() => {
    if (startupDone) return;
    startupDone = true;
    applyThemeToDom(useThemeStore.getState().active);

    Promise.all([
      initHomePath().catch(() => null),
      useWorkspaceStore.getState().load(),
      useSshStore.getState().load(),
      useThemeStore.getState().loadCustomThemes(),
      useSettingsStore.getState().load(),
      getLaunchCwd().catch(() => null),
    ]).then(async ([, , , , , launchCwd]) => {
      // Settings and custom themes are loaded: activate the saved theme,
      // migrating users on a removed built-in to Graphite (one-time notice).
      await applyStartupTheme();
      useSidebarStore.getState().hydrate(useSettingsStore.getState().settings.appearance);
      const { vibrancyEnabled: v, windowOpacity: o } =
        useSettingsStore.getState().settings.appearance;
      syncVibrancy(v, o);

      
      const startupBehavior = useSettingsStore.getState().settings.general.startupBehavior;

      const defaultShellPath = useSettingsStore.getState().settings.general.defaultShell;
      if (launchCwd) {
        const shell = getPreferredShell(defaultShellPath);
        useTerminalStore.getState().addTab(shell.type, shell.path, undefined, launchCwd);
        return;
      }

      if (startupBehavior === "restore") {
        const restored = useWorkspaceStore.getState().restoreSession();
        if (restored) return;
      }

      if (startupBehavior === "workspace") {
        const wsId = useSettingsStore.getState().settings.general.startupWorkspaceId;
        if (wsId) {
          const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === wsId);
          if (ws) {
            useWorkspaceStore.getState().restore(wsId);
            return;
          }
        }
      }


      if (useTerminalStore.getState().tabs.length === 0 && localStorage.getItem("nexterm-welcomed")) {
        const shell = getPreferredShell(defaultShellPath);
        useTerminalStore.getState().addTab(shell.type, shell.path);
      }
    });
  }, []);

  // No "apply theme on change" effect here: setTheme/previewTheme already write
  // the theme synchronously, and a parent effect would run after AppContent's
  // applyAppearanceToDom effect and wipe the accent override.

  
  const settingsLoaded = useSettingsStore((s) => s.loaded);
  useEffect(() => {
    if (settingsLoaded) {
      syncVibrancy(vibrancyEnabled, windowOpacity);
    }
  }, [settingsLoaded, vibrancyEnabled, windowOpacity, theme]);

  useEffect(() => {
    return setupKeybindings();
  }, []);

  // Window title sync
  useEffect(() => {
    const unsub = useTerminalStore.subscribe((state) => {
      const tab = state.tabs.find((t) => t.id === state.activeTabId);
      const title = tab ? `${tab.title} — NexTerm` : "NexTerm";
      import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
        getCurrentWindow().setTitle(title).catch(() => {});
      });
    });
    return unsub;
  }, []);

  // Workspace auto-save safety net (60s interval)
  useEffect(() => {
    const interval = setInterval(() => {
      const { tabs } = useTerminalStore.getState();
      if (tabs.length === 0) return;
      useWorkspaceStore.getState().autoSave().catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  return <>{children}</>;
}
