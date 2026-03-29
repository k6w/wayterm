import { create } from "zustand";
import type { AppSettings } from "../types/settings";
import { settingsGetAll, settingsSet } from "../lib/ipc";

const defaultSettings: AppSettings = {
  general: {
    defaultShell: "",
    startupBehavior: "restore",
    startupWorkspaceId: null,
    checkForUpdates: true,
    confirmOnClose: true,
    closeToTray: false,
    launchOnStartup: false,
  },
  appearance: {
    themeId: "nexterm-dark",
    terminalFontFamily: "JetBrains Mono, monospace",
    terminalFontSize: 14,
    terminalFontWeight: 400,
    terminalLineHeight: 1.4,
    uiFontFamily: "Inter, system-ui, sans-serif",
    uiFontSize: 13,
    uiScale: 1.0,
    cursorStyle: "bar",
    cursorBlink: true,
    vibrancyEnabled: false,
    windowOpacity: 1.0,
    blurIntensity: 1.0,
    accentColorOverride: null,
    compactMode: false,
    tabPosition: "top",
    windowDecorations: "custom",
  },
  terminal: {
    scrollbackLines: 10000,
    copyOnSelect: false,
    rightClickBehavior: "context-menu",
    bellStyle: "none",
    wordSeparators: " ()[]{}',\"`",
    ligatures: true,
    bracketedPaste: true,
    scrollToBottomOnInput: true,
    bufferPersistence: false,
  },
  ssh: {
    defaultPort: 22,
    defaultUsername: "",
    keepaliveInterval: 30,
    connectionTimeout: 10,
  },
  profiles: [],
  keybindings: {},
};

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  load: () => Promise<void>;
  update: <K extends keyof AppSettings>(
    section: K,
    values: Partial<AppSettings[K]>
  ) => Promise<void>;
  updateKeybinding: (action: string, keys: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loaded: false,

  load: async () => {
    try {
      const raw = await settingsGetAll();
      const merged = structuredClone(defaultSettings);
      for (const [key, value] of Object.entries(raw)) {
        const parts = key.split(".");
        if (parts.length === 2) {
          const [section, field] = parts;
          const sec = merged[section as keyof AppSettings];
          if (sec && typeof sec === "object" && !Array.isArray(sec)) {
            (sec as Record<string, unknown>)[field] = value;
          }
        }
      }
      set({ settings: merged, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  update: async (section, values) => {
    const current = get().settings;
    const sectionValue = current[section];
    const updated = {
      ...current,
      [section]:
        typeof sectionValue === "object" && !Array.isArray(sectionValue)
          ? { ...sectionValue, ...values }
          : values,
    };
    set({ settings: updated });
    for (const [field, value] of Object.entries(
      values as Record<string, unknown>
    )) {
      await settingsSet(`${String(section)}.${field}`, value);
    }
  },

  updateKeybinding: async (action: string, keys: string) => {
    const current = get().settings;
    const updated = {
      ...current,
      keybindings: { ...current.keybindings, [action]: keys },
    };
    set({ settings: updated });
    await settingsSet(`keybindings.${action}`, keys);
  },
}));
