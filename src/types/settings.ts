export type CursorStyle = "block" | "underline" | "bar";
export type BellStyle = "none" | "visual" | "audio";
export type RightClickBehavior = "paste" | "context-menu";
export type StartupBehavior = "restore" | "new-tab" | "workspace";

/** Control and row height: compact 28px (default) or comfortable 32px. */
export type Density = "compact" | "comfortable";

export interface GeneralSettings {
  defaultShell: string;
  startupBehavior: StartupBehavior;
  startupWorkspaceId: string | null;
  checkForUpdates: boolean;
  confirmOnClose: boolean;
  closeToTray: boolean;
  launchOnStartup: boolean;
  notifyOnLongCommands: boolean;
  longCommandThresholdSeconds: number;
}

export interface AppearanceSettings {
  themeId: string;
  terminalFontFamily: string;
  terminalFontSize: number;
  terminalFontWeight: number;
  terminalLineHeight: number;
  uiFontFamily: string;
  uiFontSize: number;
  uiScale: number;
  cursorStyle: CursorStyle;
  cursorBlink: boolean;
  vibrancyEnabled: boolean;
  windowOpacity: number;
  blurIntensity: number;
  accentColorOverride: string | null;
  /** @deprecated Replaced by `density` (Phase 5). Still loaded, no longer shown or applied. */
  compactMode: boolean;
  density: Density;
  /** Fade split panes that do not have focus. */
  dimInactivePanes: boolean;
  /** Scrim strength over unfocused split panes, 0..1. */
  inactivePaneDim: number;
  tabPosition: "top" | "bottom" | "left" | "right";
  windowDecorations: "custom" | "native";
  /** Side panel hidden (only the activity bar shows). */
  sidebarCollapsed: boolean;
  /** Side panel width in CSS px, 200..420. */
  sidebarWidth: number;
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
  bufferPersistence: boolean;
  /** Start local shells with Wayterm's integration script (prompt, command and cwd reports). New sessions only. */
  shellIntegration: boolean;
  /** Command blocks: gutter marks, selection, block actions and keys (needs shell integration). */
  commandBlocks: boolean;
  /** Command blocks: status marks in the left gutter. */
  blockGutter: boolean;
  /** Command blocks: how long each command took, on its prompt row. */
  blockDurations: boolean;
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
  icon: string;
  themeOverride: string | null;
  fontFamilyOverride: string | null;
  fontSizeOverride: number | null;
  fontWeightOverride: number | null;
  cursorStyleOverride: CursorStyle | null;
  scrollbackOverride: number | null;
  ligaturesOverride: boolean | null;
}

export interface Snippet {
  id: string;
  name: string;
  command: string;
  category?: string;
}

export interface SftpBookmark {
  id: string;
  name: string;
  path: string;
  sessionId?: string;
}

export interface AppSettings {
  general: GeneralSettings;
  appearance: AppearanceSettings;
  terminal: TerminalSettings;
  ssh: SshSettings;
  profiles: ShellProfile[];
  keybindings: Record<string, string>;
  snippets: Snippet[];
  sftpBookmarks: SftpBookmark[];
}
