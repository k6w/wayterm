export type ShellType = "powershell" | "cmd" | "gitbash" | "wsl" | "bash" | "zsh" | "fish" | "sh" | "ssh";

export type SplitDirection = "horizontal" | "vertical";

export interface TerminalTab {
  id: string;
  title: string;
  icon: string;
  shellType: ShellType;
  panes: SplitNode;
  isActive: boolean;
}

export interface TerminalPane {
  id: string;
  sessionId: string;
  blocks: Block[];
  isActive: boolean;
  cwd: string;
  shellType: ShellType;
  sshConnectionId?: string;
}

export interface Block {
  id: string;
  command: string;
  output: string;
  exitCode: number | null;
  startedAt: string;
  finishedAt: string | null;
  isRunning: boolean;
  cwd: string;
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
