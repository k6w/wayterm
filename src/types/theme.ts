export type ThemeVariant = "dark" | "light";

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

export interface ThemeDefinition {
  id: string;
  name: string;
  variant: ThemeVariant;
  terminal: ThemeTerminalColors;
  ui: ThemeUiColors;
  blur: ThemeBlur;
  opacity: ThemeOpacity;
}
