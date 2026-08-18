export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
  conflicted: number;
  stashes: number;
  /** Index status letter (A/M/D/R/...) per staged path. */
  stagedCodes?: Record<string, string>;
}

export interface GitFileStatus {
  message: string;
}

export interface GitBranch {
  name: string;
  current: boolean;
  remote: boolean;
  upstream?: string;
  lastCommit?: string;
  lastCommitDate?: number;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  date: number;
  message: string;
  files: string[];
}

export interface GitRemote {
  name: string;
  url: string;
  fetch: string;
  push: string;
}

export interface GitDiff {
  file: string;
  additions: number;
  deletions: number;
  changes: string;
}

export interface GitState {
  repositories: Record<string, GitStatus>;
  currentRepo: string | null;
}
