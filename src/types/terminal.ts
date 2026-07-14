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
  sshConnectionId?: string;
  sftpConnectionId?: string;
  serialConfig?: SerialConfig;
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
