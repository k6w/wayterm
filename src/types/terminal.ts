export type ShellType = "powershell" | "cmd" | "gitbash" | "wsl" | "bash" | "zsh" | "fish" | "sh" | "ssh" | "sftp" | "serial";

export type SplitDirection = "horizontal" | "vertical";

export interface TerminalTab {
  id: string;
  title: string;
  icon: string;
  shellType: ShellType;
  panes: SplitNode;
  isActive: boolean;
  hasBell?: boolean;
  colorTag?: string;
}

export interface TerminalPane {
  id: string;
  sessionId: string;
  isActive: boolean;
  cwd: string;
  shellType: ShellType;
  shellPath?: string;
  /** Started from this profile (Settings > Profiles): its shell, arguments, variables and look. */
  profileId?: string;
  sshConnectionId?: string;
  sftpConnectionId?: string;
  serialConfig?: SerialConfig;
  /** Set by a workspace restore: the saved cwd must be checked before the shell starts in it. */
  checkCwd?: boolean;
  /** Set by a workspace restore: typed into the pane once it is ready, then cleared. */
  startupCommands?: string[];
  /** Short note shown in the pane (e.g. a restored folder that no longer exists). */
  notice?: string;
  /** Started with the shell integration, but the shell never reported a prompt. */
  integrationInactive?: boolean;
}

export interface SerialConfig {
  portName: string;
  baudRate: number;
  dataBits: number;
  stopBits: number;
  parity: string;
  flowControl: string;
}

export interface SplitNode {
  type: "pane" | "split";
  paneId?: string;
  direction?: SplitDirection;
  ratio?: number;
  children?: [SplitNode, SplitNode];
}

export interface ContextInfo {
  gitBranch: string | null;
  gitDirty: boolean;
  runtime: string | null;
  cwd: string;
  sshHost: string | null;
}
