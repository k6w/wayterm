import { create } from "zustand";
import type { ThemeDefinition } from "../types/theme";
import { customThemeList, customThemeSave, customThemeDelete } from "../lib/ipc";
import nextermDark from "../themes/nexterm-dark.json";
import nextermLight from "../themes/nexterm-light.json";
import monokaiPro from "../themes/monokai-pro.json";
import dracula from "../themes/dracula.json";
import nord from "../themes/nord.json";
import solarizedDark from "../themes/solarized-dark.json";
import solarizedLight from "../themes/solarized-light.json";
import oneDark from "../themes/one-dark.json";
import catppuccinMocha from "../themes/catppuccin-mocha.json";
import tokyoNight from "../themes/tokyo-night.json";
import gruvboxDark from "../themes/gruvbox-dark.json";
import gruvboxLight from "../themes/gruvbox-light.json";
import rosePine from "../themes/rose-pine.json";
import everforestDark from "../themes/everforest-dark.json";
import kanagawa from "../themes/kanagawa.json";
import githubDark from "../themes/github-dark.json";
import vibrantDark from "../themes/vibrant-dark.json";
import vibrantLight from "../themes/vibrant-light.json";

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

const builtinThemes: Record<string, ThemeDefinition> = {
  "nexterm-dark": nextermDark as unknown as ThemeDefinition,
  "nexterm-light": nextermLight as unknown as ThemeDefinition,
  "monokai-pro": monokaiPro as unknown as ThemeDefinition,
  "dracula": dracula as unknown as ThemeDefinition,
  "nord": nord as unknown as ThemeDefinition,
  "solarized-dark": solarizedDark as unknown as ThemeDefinition,
  "solarized-light": solarizedLight as unknown as ThemeDefinition,
  "one-dark": oneDark as unknown as ThemeDefinition,
  "catppuccin-mocha": catppuccinMocha as unknown as ThemeDefinition,
  "tokyo-night": tokyoNight as unknown as ThemeDefinition,
  "gruvbox-dark": gruvboxDark as unknown as ThemeDefinition,
  "gruvbox-light": gruvboxLight as unknown as ThemeDefinition,
  "rose-pine": rosePine as unknown as ThemeDefinition,
  "everforest-dark": everforestDark as unknown as ThemeDefinition,
  "kanagawa": kanagawa as unknown as ThemeDefinition,
  "github-dark": githubDark as unknown as ThemeDefinition,
  "vibrant-dark": vibrantDark as unknown as ThemeDefinition,
  "vibrant-light": vibrantLight as unknown as ThemeDefinition,
};

function validateTheme(obj: unknown): obj is ThemeDefinition {
  if (!obj || typeof obj !== "object") return false;
  const t = obj as Record<string, unknown>;
  if (typeof t.id !== "string" || !t.id) return false;
  if (typeof t.name !== "string" || !t.name) return false;
  if (t.variant !== "dark" && t.variant !== "light") return false;

  const term = t.terminal as Record<string, unknown> | undefined;
  if (!term) return false;
  if (typeof term.foreground !== "string") return false;
  if (typeof term.background !== "string") return false;
  if (!Array.isArray(term.ansi) || term.ansi.length !== 16) return false;

  const ui = t.ui as Record<string, unknown> | undefined;
  if (!ui) return false;
  const requiredUi = [
    "bgPrimary", "bgSecondary", "bgTertiary",
    "textPrimary", "textSecondary", "textMuted",
    "accent", "accentHover", "border", "borderFocus",
    "success", "warning", "error",
  ];
  for (const key of requiredUi) {
    if (typeof ui[key] !== "string") return false;
  }

  return true;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  activeThemeId: "nexterm-dark",
  themes: builtinThemes,
  customThemeIds: new Set<string>(),
  active: builtinThemes["nexterm-dark"],
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
    try {
      const rows = await customThemeList();
      const newThemes: Record<string, ThemeDefinition> = {};
      const ids = new Set<string>();
      for (const row of rows) {
        try {
          const parsed = JSON.parse(row.themeJson);
          if (validateTheme(parsed)) {
            newThemes[parsed.id] = parsed;
            ids.add(parsed.id);
          }
        } catch {
        }
      }
      set((state) => ({
        themes: { ...state.themes, ...newThemes },
        customThemeIds: ids,
      }));
    } catch {
    }
  },

  importTheme: async (json: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error("Invalid JSON");
    }

    if (!validateTheme(parsed)) {
      throw new Error(
        "Invalid theme format. Ensure id, name, variant, terminal, and ui fields are present."
      );
    }

    if (builtinThemes[parsed.id]) {
      throw new Error(
        `Theme ID "${parsed.id}" conflicts with a built-in theme. Change the "id" field.`
      );
    }

    const theme: ThemeDefinition = {
      ...parsed,
      blur: parsed.blur ?? { sidebar: 20, blocks: 4, inputBar: 12, overlay: 30 },
      opacity: parsed.opacity ?? { sidebar: 0.4, blocks: 0.05, inputBar: 0.08 },
    };

    await customThemeSave(theme.id, JSON.stringify(theme));

    set((state) => ({
      themes: { ...state.themes, [theme.id]: theme },
      customThemeIds: new Set([...state.customThemeIds, theme.id]),
    }));

    return theme;
  },

  removeCustomTheme: async (id: string) => {
    if (builtinThemes[id]) return;

    await customThemeDelete(id);

    set((state) => {
      const themes = { ...state.themes };
      delete themes[id];
      const ids = new Set(state.customThemeIds);
      ids.delete(id);

      const needsFallback = state.activeThemeId === id;
      return {
        themes,
        customThemeIds: ids,
        ...(needsFallback
          ? {
              activeThemeId: "nexterm-dark",
              active: builtinThemes["nexterm-dark"],
            }
          : {}),
      };
    });

    if (get().activeThemeId === "nexterm-dark") {
      applyThemeToDom(builtinThemes["nexterm-dark"]);
    }
  },
}));

export function applyThemeToDom(theme: ThemeDefinition) {
  const root = document.documentElement;
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
  const isLight = theme.variant === "light";
  root.style.setProperty("--overlay", isLight ? "0 0 0" : "255 255 255");
}
