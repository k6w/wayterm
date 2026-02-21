import { useEffect } from "react";
import { useThemeStore, applyThemeToDom } from "../stores/theme";
import { useSettingsStore } from "../stores/settings";
import { useWorkspaceStore } from "../stores/workspace";
import { useSshStore } from "../stores/ssh";
import { setupKeybindings } from "../lib/keybindings";
import { setVibrancy } from "../lib/ipc";
import { hexToRgb } from "../lib/color";
import { initHomePath } from "../lib/format";

/** Call the native set_vibrancy command with the current theme color. */
function syncVibrancy(enabled: boolean, opacity: number) {
  const theme = useThemeStore.getState().active;
  const [r, g, b] = hexToRgb(theme.ui.bgPrimary);
  const a = Math.round(opacity * 255);
  setVibrancy(enabled, r, g, b, a).catch(() => {});
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.active);
  const vibrancyEnabled = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const windowOpacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);

  // Fire ALL loads in parallel — nothing blocks rendering
  useEffect(() => {
    applyThemeToDom(theme);

    Promise.all([
      initHomePath().catch(() => {}),
      useWorkspaceStore.getState().load(),
      useSshStore.getState().load(),
      useThemeStore.getState().loadCustomThemes(),
      useSettingsStore.getState().load(),
    ]).then(() => {
      // Apply saved theme now that custom themes + settings are both loaded
      const themeId = useSettingsStore.getState().settings.appearance.themeId;
      useThemeStore.getState().setTheme(themeId);
      const { vibrancyEnabled: v, windowOpacity: o } =
        useSettingsStore.getState().settings.appearance;
      syncVibrancy(v, o);
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

  // No spinner gate — render children immediately
  return <>{children}</>;
}
