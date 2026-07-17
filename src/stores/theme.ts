import { create } from "zustand";
import { CHROME_KEYS, type ThemeDefinition } from "../types/theme";
import { customThemeList, customThemeSave, customThemeDelete } from "../lib/ipc";
import { chromeCssVar, toThemeFile } from "../lib/theme-schema";
import { BUILTIN_THEME_MAP, DEFAULT_THEME_ID, isBuiltinThemeId } from "../themes";
import { normalizeTheme } from "../themes/legacy";

interface ThemeState {
  activeThemeId: string;
  themes: Record<string, ThemeDefinition>;
  customThemeIds: Set<string>;
  active: ThemeDefinition;
  previewThemeId: string | null;
  setTheme: (id: string) => void;
  previewTheme: (id: string | null) => void;
  registerTheme: (theme: ThemeDefinition) => void;
  loadCustomThemes: () => Promise<void>;
  importTheme: (json: string) => Promise<ThemeDefinition>;
  removeCustomTheme: (id: string) => Promise<void>;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  activeThemeId: DEFAULT_THEME_ID,
  themes: { ...BUILTIN_THEME_MAP },
  customThemeIds: new Set<string>(),
  active: BUILTIN_THEME_MAP[DEFAULT_THEME_ID],
  previewThemeId: null,

  setTheme: (id: string) => {
    const theme = get().themes[id];
    if (theme) {
      set({ activeThemeId: id, active: theme, previewThemeId: null });
      applyThemeToDom(theme);
    }
  },

  previewTheme: (id: string | null) => {
    if (id === null) {
      const current = get().themes[get().activeThemeId];
      if (current) {
        set({ previewThemeId: null, active: current });
        applyThemeToDom(current);
      }
    } else {
      const theme = get().themes[id];
      if (theme) {
        set({ previewThemeId: id, active: theme });
        applyThemeToDom(theme);
      }
    }
  },

  registerTheme: (theme: ThemeDefinition) => {
    set((state) => ({
      themes: { ...state.themes, [theme.id]: theme },
    }));
  },

  loadCustomThemes: async () => {
    let rows: { id: string; themeJson: string }[] | null;
    try {
      rows = await customThemeList();
    } catch (err) {
      console.warn("[theme] failed to list custom themes:", err);
      return;
    }
    const loaded: Record<string, ThemeDefinition> = {};
    const ids = new Set<string>();
    for (const row of rows ?? []) {
      try {
        const theme = normalizeTheme(JSON.parse(row.themeJson));
        if (isBuiltinThemeId(theme.id)) continue;
        loaded[theme.id] = theme;
        ids.add(theme.id);
      } catch (err) {
        console.warn(`[theme] skipping custom theme "${row.id}": ${errorMessage(err)}`);
      }
    }
    set((state) => ({
      themes: { ...state.themes, ...loaded },
      customThemeIds: ids,
    }));
  },

  importTheme: async (json: string) => {
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      throw new Error("Invalid JSON");
    }

    let theme: ThemeDefinition;
    try {
      theme = normalizeTheme(raw);
    } catch (err) {
      throw new Error(`Invalid theme: ${errorMessage(err)}`);
    }

    if (isBuiltinThemeId(theme.id)) {
      throw new Error(
        `Theme ID "${theme.id}" conflicts with a built-in theme. Change the "id" field.`
      );
    }

    await customThemeSave(theme.id, JSON.stringify(toThemeFile(theme)));

    set((state) => ({
      themes: { ...state.themes, [theme.id]: theme },
      customThemeIds: new Set([...state.customThemeIds, theme.id]),
    }));

    return theme;
  },

  removeCustomTheme: async (id: string) => {
    if (isBuiltinThemeId(id)) return;

    await customThemeDelete(id);

    const wasActive = get().activeThemeId === id;
    set((state) => {
      const themes = { ...state.themes };
      delete themes[id];
      const ids = new Set(state.customThemeIds);
      ids.delete(id);
      return { themes, customThemeIds: ids };
    });

    if (wasActive) get().setTheme(DEFAULT_THEME_ID);
  },
}));

/**
 * Writes a theme to the document: every chrome token as its --nx-* custom
 * property, plus the legacy variables that un-migrated screens read.
 * applyAppearanceToDom (src/lib/appearance.ts) must run afterwards to re-apply
 * the accent override and glass surfaces.
 */
export function applyThemeToDom(theme: ThemeDefinition) {
  const root = document.documentElement;
  for (const key of CHROME_KEYS) {
    root.style.setProperty(chromeCssVar(key), theme.chrome[key]);
  }

  // Legacy variables (removed after Phase 5).
  const { ui } = theme;
  root.style.setProperty("--bg-primary", ui.bgPrimary);
  root.style.setProperty("--bg-secondary", ui.bgSecondary);
  root.style.setProperty("--bg-tertiary", ui.bgTertiary);
  root.style.setProperty("--text-primary", ui.textPrimary);
  root.style.setProperty("--text-secondary", ui.textSecondary);
  root.style.setProperty("--text-muted", ui.textMuted);
  root.style.setProperty("--accent", ui.accent);
  root.style.setProperty("--accent-hover", ui.accentHover);
  root.style.setProperty("--border", ui.border);
  root.style.setProperty("--border-focus", ui.borderFocus);
  root.style.setProperty("--success", ui.success);
  root.style.setProperty("--warning", ui.warning);
  root.style.setProperty("--error", ui.error);
  root.style.setProperty("--blur-sidebar", `${theme.blur.sidebar}px`);
  root.style.setProperty("--blur-blocks", `${theme.blur.blocks}px`);
  root.style.setProperty("--blur-input-bar", `${theme.blur.inputBar}px`);
  root.style.setProperty("--blur-overlay", `${theme.blur.overlay}px`);
  root.style.setProperty("--opacity-sidebar", `${theme.opacity.sidebar}`);
  root.style.setProperty("--opacity-blocks", `${theme.opacity.blocks}`);
  root.style.setProperty("--opacity-input-bar", `${theme.opacity.inputBar}`);

  root.setAttribute("data-theme", theme.variant);
  root.style.setProperty("--overlay", theme.variant === "light" ? "0 0 0" : "255 255 255");
}
