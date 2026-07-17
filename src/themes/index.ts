import { parseThemeFile, toThemeDefinition } from "../lib/theme-schema";
import type { ThemeDefinition } from "../types/theme";
import graphite from "./graphite.json";
import frost from "./frost.json";
import ember from "./ember.json";
import paper from "./paper.json";

export const DEFAULT_THEME_ID = "graphite";

/**
 * Built-in themes in display order. Validated at module load, so an invalid
 * file fails the test suite and app startup instead of rendering garbage.
 */
export const BUILTIN_THEMES: readonly ThemeDefinition[] = [graphite, frost, ember, paper].map(
  (file) => toThemeDefinition(parseThemeFile(file))
);

export const BUILTIN_THEME_MAP: Readonly<Record<string, ThemeDefinition>> = Object.fromEntries(
  BUILTIN_THEMES.map((theme) => [theme.id, theme])
);

export function isBuiltinThemeId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(BUILTIN_THEME_MAP, id);
}

/**
 * Built-in themes removed by the redesign (id -> display name). Users whose
 * saved theme is one of these are moved to Graphite once, with a notice
 * (see src/lib/theme-migration.ts).
 */
export const REMOVED_BUILTIN_THEMES: Readonly<Record<string, string>> = {
  "catppuccin-mocha": "Catppuccin Mocha",
  dracula: "Dracula",
  "everforest-dark": "Everforest Dark",
  "github-dark": "GitHub Dark",
  "gruvbox-dark": "Gruvbox Dark",
  "gruvbox-light": "Gruvbox Light",
  kanagawa: "Kanagawa",
  "monokai-pro": "Monokai Pro",
  "nexterm-dark": "Nexterm Dark",
  "nexterm-light": "Nexterm Light",
  nord: "Nord",
  "one-dark": "One Dark Pro",
  "rose-pine": "Rose Pine",
  "solarized-dark": "Solarized Dark",
  "solarized-light": "Solarized Light",
  "tokyo-night": "Tokyo Night",
  "vibrant-dark": "Vibrant Dark",
  "vibrant-light": "Vibrant Light",
};
