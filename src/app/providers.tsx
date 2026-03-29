import { useEffect } from "react";
import { useThemeStore, applyThemeToDom } from "../stores/theme";
import { useSettingsStore } from "../stores/settings";
import { useWorkspaceStore } from "../stores/workspace";
import { useSshStore } from "../stores/ssh";
import { useTerminalStore } from "../stores/terminal";
import { setupKeybindings } from "../lib/keybindings";
import { setVibrancy, getLaunchCwd } from "../lib/ipc";
import { hexToRgb } from "../lib/color";
import { initHomePath } from "../lib/format";
import { getPreferredShell } from "../lib/shell-detect";

/** Call the native set_vibrancy command with the current theme color. */
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

  // Fire ALL loads + startup in one parallel batch — nothing blocks rendering
  useEffect(() => {
    if (startupDone) return;
    startupDone = true;
    applyThemeToDom(theme);

    Promise.all([
      initHomePath().catch(() => null),
      useWorkspaceStore.getState().load(),
      useSshStore.getState().load(),
      useThemeStore.getState().loadCustomThemes(),
      useSettingsStore.getState().load(),
      getLaunchCwd().catch(() => null),
    ]).then(([, , , , , launchCwd]) => {
      // Apply saved theme
      const themeId = useSettingsStore.getState().settings.appearance.themeId;
      useThemeStore.getState().setTheme(themeId);
      const { vibrancyEnabled: v, windowOpacity: o } =
        useSettingsStore.getState().settings.appearance;
      syncVibrancy(v, o);

      // ── Startup: restore session or create new tab (runs immediately, no extra render) ──
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

      // Fallback: open a new tab
      if (useTerminalStore.getState().tabs.length === 0) {
        const shell = getPreferredShell(defaultShellPath);
        useTerminalStore.getState().addTab(shell.type, shell.path);
      }
    });
  }, []);

  useEffect(() => {
    applyThemeToDom(theme);
  }, [theme]);

  // Re-apply native vibrancy when toggle, opacity, or theme changes
  const settingsLoaded = useSettingsStore((s) => s.loaded);
  useEffect(() => {
    if (settingsLoaded) {
      syncVibrancy(vibrancyEnabled, windowOpacity);
    }
  }, [settingsLoaded, vibrancyEnabled, windowOpacity, theme]);

  useEffect(() => {
    return setupKeybindings();
  }, []);

  return <>{children}</>;
}
