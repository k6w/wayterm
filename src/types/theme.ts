export type ThemeVariant = "dark" | "light";

/**
 * Every chrome (UI) token a theme defines, in the order THEMES.md documents
 * them. Each token reaches CSS as a --wt-* custom property (see chromeCssVar in
 * src/lib/theme-schema.ts) and Tailwind as a color utility (src/styles.css).
 */
export const CHROME_KEYS = [
  "canvas",
  "panel",
  "raised",
  "hover",
  "active",
  "scrim",
  "border",
  "borderStrong",
  "borderSubtle",
  "text",
  "textSecondary",
  "textMuted",
  "textDisabled",
  "textOnAccent",
  "accent",
  "accentHover",
  "accentActive",
  "accentSubtle",
  "accentText",
  "focusRing",
  "selection",
  "success",
  "successSubtle",
  "warning",
  "warningSubtle",
  "danger",
  "dangerSubtle",
  "info",
  "infoSubtle",
  "inputBg",
  "inputBorder",
  "tabBar",
  "tabActive",
  "statusBar",
  "tooltipBg",
  "tooltipText",
  "kbdBg",
  "kbdText",
  "scrollbarThumb",
  "scrollbarThumbHover",
  "shadow",
] as const;

export type ChromeKey = (typeof CHROME_KEYS)[number];

/** UI colors of a theme: one hex value per chrome token. */
export type ThemeChrome = Record<ChromeKey, string>;

export interface ThemeTerminalColors {
  foreground: string;
  background: string;
  cursor: string;
  cursorAccent: string;
  selection: string;
  ansi: [
    string, string, string, string, string, string, string, string,
    string, string, string, string, string, string, string, string
  ];
}

/**
 * @deprecated Pre-redesign UI colors. Derived from `chrome` (see
 * chromeToLegacyUi) for screens not yet migrated to src/ui; removed after
 * Phase 5. New code reads `chrome` or, better, uses Tailwind token classes.
 */
export interface ThemeUiColors {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  border: string;
  borderFocus: string;
  success: string;
  warning: string;
  error: string;
}

export interface ThemeBlur {
  sidebar: number;
  blocks: number;
  inputBar: number;
  overlay: number;
}

export interface ThemeOpacity {
  sidebar: number;
  blocks: number;
  inputBar: number;
}

/** The on-disk theme JSON schema, shared by built-in files and custom imports. */
export interface ThemeFile {
  id: string;
  name: string;
  variant: ThemeVariant;
  chrome: ThemeChrome;
  terminal: ThemeTerminalColors;
  blur?: ThemeBlur;
  opacity?: ThemeOpacity;
}

/** A theme loaded into the app. */
export interface ThemeDefinition {
  id: string;
  name: string;
  variant: ThemeVariant;
  chrome: ThemeChrome;
  terminal: ThemeTerminalColors;
  /** @deprecated Derived from `chrome`; see ThemeUiColors. */
  ui: ThemeUiColors;
  blur: ThemeBlur;
  opacity: ThemeOpacity;
}
