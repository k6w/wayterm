export type CursorStyle = "block" | "underline" | "bar";
export type BellStyle = "none" | "visual" | "audio";
export type RightClickBehavior = "paste" | "context-menu";
export type StartupBehavior = "restore" | "new-tab" | "workspace";

export interface GeneralSettings {
  defaultShell: string;
  startupBehavior: StartupBehavior;
  startupWorkspaceId: string | null;
  checkForUpdates: boolean;
  confirmOnClose: boolean;
}

export interface AppearanceSettings {
  themeId: string;
  terminalFontFamily: string;
  terminalFontSize: number;
  terminalFontWeight: number;
  terminalLineHeight: number;
  uiFontFamily: string;
  uiFontSize: number;
  cursorStyle: CursorStyle;
  cursorBlink: boolean;
  vibrancyEnabled: boolean;
  windowOpacity: number;
  blurIntensity: number;
  accentColorOverride: string | null;
  compactMode: boolean;
}

export interface TerminalSettings {
  scrollbackLines: number;
  copyOnSelect: boolean;
  rightClickBehavior: RightClickBehavior;
  bellStyle: BellStyle;
  wordSeparators: string;
  ligatures: boolean;
  bracketedPaste: boolean;
  scrollToBottomOnInput: boolean;
}

export interface SshSettings {
  defaultPort: number;
  defaultUsername: string;
  keepaliveInterval: number;
  connectionTimeout: number;
}

export interface ShellProfile {
  id: string;
  name: string;
  shellPath: string;
  args: string[];
  env: Record<string, string>;
  workingDirectory: string;
  themeOverride: string | null;
  fontOverride: string | null;
}

export interface AppSettings {
  general: GeneralSettings;
  appearance: AppearanceSettings;
  terminal: TerminalSettings;
  ssh: SshSettings;
  profiles: ShellProfile[];
  keybindings: Record<string, string>;
}
