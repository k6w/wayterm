import { create } from "zustand";
import type { GitStatus, GitBranch, GitCommit, GitRemote, GitDiff } from "../types/git";
import {
  gitGetStatus,
  gitGetBranches,
  gitGetCommits,
  gitGetRemotes,
  gitGetDiff,
  gitCheckout,
  gitPull,
  gitPush,
  gitCommit,
  gitStage,
  gitUnstage,
  gitStash,
  gitStashPop
} from "../lib/ipc";

interface GitStatusExtended extends GitStatus {
  modified: string[];
  added: string[];
  deleted: string[];
}

interface GitStore {
  status: GitStatusExtended | null;
  branches: GitBranch[];
  commits: GitCommit[];
  remotes: GitRemote[];
  currentBranch: string | null;
  isLoading: boolean;
  error: string | null;
  fetchStatus: (path: string, connectionId?: string) => Promise<void>;
  fetchBranches: (path: string, connectionId?: string) => Promise<void>;
  fetchCommits: (path: string, limit?: number, connectionId?: string) => Promise<void>;
  fetchRemotes: (path: string) => Promise<void>;
  fetchDiff: (path: string, file?: string) => Promise<GitDiff[]>;
  checkout: (path: string, branch: string) => Promise<void>;
  pull: (path: string) => Promise<void>;
  push: (path: string) => Promise<void>;
  commit: (path: string, message: string) => Promise<void>;
  stage: (path: string, files: string[]) => Promise<void>;
  unstage: (path: string, files: string[]) => Promise<void>;
  stash: (path: string, message?: string) => Promise<void>;
  applyStash: (path: string, index: number) => Promise<void>;
  dropStash: (path: string, index: number) => Promise<void>;
}

export const useGitStore = create<GitStore>((set, get) => ({
  status: null,
  branches: [],
  commits: [],
  remotes: [],
  currentBranch: null,
  isLoading: false,
  error: null,

  fetchStatus: async (path: string, connectionId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const rawStatus = await gitGetStatus(path, connectionId);
      const status: GitStatusExtended = {
        ...rawStatus,
        modified: [],
        added: [],
        deleted: [],
      };
      set({ status, currentBranch: rawStatus.branch, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  fetchBranches: async (path: string, connectionId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const branches = await gitGetBranches(path, connectionId);
      set({ branches, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  fetchCommits: async (path: string, limit = 50, connectionId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const commits = await gitGetCommits(path, limit, connectionId);
      set({ commits, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  fetchRemotes: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      const remotes = await gitGetRemotes(path);
      set({ remotes, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  fetchDiff: async (path: string, file?: string) => {
    try {
      return await gitGetDiff(path, file);
    } catch (error) {
      set({ error: String(error) });
      return [];
    }
  },

  checkout: async (path: string, branch: string) => {
    set({ isLoading: true, error: null });
    try {
      await gitCheckout(path, branch);
      await get().fetchStatus(path);
      set({ isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  pull: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      await gitPull(path);
      await get().fetchStatus(path);
      set({ isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  push: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      await gitPush(path);
      await get().fetchStatus(path);
      set({ isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  commit: async (path: string, message: string) => {
    set({ isLoading: true, error: null });
    try {
      await gitCommit(path, message);
      await get().fetchStatus(path);
      set({ isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  stage: async (path: string, files: string[]) => {
    set({ isLoading: true, error: null });
    try {
      await gitStage(path, files);
      await get().fetchStatus(path);
      set({ isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  unstage: async (path: string, files: string[]) => {
    set({ isLoading: true, error: null });
    try {
      await gitUnstage(path, files);
      await get().fetchStatus(path);
      set({ isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  stash: async (path: string, message?: string) => {
    set({ isLoading: true, error: null });
    try {
      await gitStash(path, message);
      await get().fetchStatus(path);
      set({ isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  applyStash: async (path: string, _index: number) => {
    set({ isLoading: true, error: null });
    try {
      await gitStashPop(path);
      await get().fetchStatus(path);
      set({ isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  dropStash: async (_path: string, _index: number) => {
    set({ isLoading: true, error: null });
    try {
      set({ isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  }
}));
