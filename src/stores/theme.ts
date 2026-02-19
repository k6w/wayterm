import { create } from "zustand";
import type { ThemeDefinition } from "../types/theme";
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

interface ThemeState {
  activeThemeId: string;
  themes: Record<string, ThemeDefinition>;
  active: ThemeDefinition;
  setTheme: (id: string) => void;
  registerTheme: (theme: ThemeDefinition) => void;
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
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  activeThemeId: "nexterm-dark",
  themes: builtinThemes,
  active: builtinThemes["nexterm-dark"],
  setTheme: (id: string) => {
    const theme = get().themes[id];
    if (theme) {
      set({ activeThemeId: id, active: theme });
      applyThemeToDom(theme);
    }
  },
  registerTheme: (theme: ThemeDefinition) => {
    set((state) => ({
      themes: { ...state.themes, [theme.id]: theme },
    }));
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
}
