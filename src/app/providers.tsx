import { useEffect, useState } from "react";
import { useThemeStore, applyThemeToDom } from "../stores/theme";
import { useSettingsStore } from "../stores/settings";
import { setupKeybindings } from "../lib/keybindings";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const theme = useThemeStore((s) => s.active);
  const loadSettings = useSettingsStore((s) => s.load);

  useEffect(() => {
    applyThemeToDom(theme);
    loadSettings().then(() => setReady(true));
  }, []);

  useEffect(() => {
    applyThemeToDom(theme);
  }, [theme]);

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
