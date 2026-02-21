import { useEffect, useState } from "react";
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
  const [ready, setReady] = useState(false);
  const theme = useThemeStore((s) => s.active);
  const loadSettings = useSettingsStore((s) => s.load);
  const vibrancyEnabled = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const windowOpacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);

  useEffect(() => {
    applyThemeToDom(theme);
    initHomePath().catch(() => {});
    useWorkspaceStore.getState().load();
    useSshStore.getState().load();
    // Load custom themes before settings so the saved themeId can resolve
    useThemeStore.getState().loadCustomThemes().finally(() => {
      loadSettings().then(() => {
        const { vibrancyEnabled: v, windowOpacity: o } =
          useSettingsStore.getState().settings.appearance;
        syncVibrancy(v, o);
        setReady(true);
      });
    });
  }, []);

  useEffect(() => {
    applyThemeToDom(theme);
  }, [theme]);

  // Re-apply native vibrancy when toggle, opacity, or theme changes
  useEffect(() => {
    if (ready) {
      syncVibrancy(vibrancyEnabled, windowOpacity);
    }
  }, [vibrancyEnabled, windowOpacity, theme]);

  useEffect(() => {
    return setupKeybindings();
  }, []);

  if (!ready) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-bg-primary">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
