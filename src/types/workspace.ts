import type { SplitNode, ShellType } from "./terminal";

export interface WorkspacePaneState {
  shellType: ShellType;
  cwd: string;
  sshConnectionId: string | null;
}

export interface WorkspaceTabState {
  title: string;
  layout: SplitNode;
  panes: Record<string, WorkspacePaneState>;
}

export interface Workspace {
  id: string;
  name: string;
  icon: string | null;
  tabs: WorkspaceTabState[];
  activeTabIndex: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMeta {
  id: string;
  name: string;
  icon: string | null;
  isDefault: boolean;
  updatedAt: string;
}
