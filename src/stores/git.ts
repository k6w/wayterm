import { create } from "zustand";
import type { GitStatus, GitBranch, GitCommit, GitRemote, GitDiff } from "../types/git";
import { toast } from "./toast";
import {
  gitGetStatus,
  gitGetBranches,
  gitGetCommits,
  gitGetRemotes,
  gitGetDiff,
  gitInit,
  gitCheckout,
  gitPull,
  gitPush,
  gitCommit,
  gitStage,
  gitUnstage,
  gitStash,
  gitStashPop
} from "../lib/ipc";

interface GitStore {
  status: GitStatus | null;
  branches: GitBranch[];
  commits: GitCommit[];
  remotes: GitRemote[];
  currentBranch: string | null;
  isLoading: boolean;
  error: string | null;
  fetchStatus: (path: string, connectionId?: string) => Promise<boolean>;
  fetchBranches: (path: string, connectionId?: string) => Promise<void>;
  fetchCommits: (path: string, limit?: number, connectionId?: string) => Promise<void>;
  fetchRemotes: (path: string) => Promise<void>;
  fetchDiff: (path: string, file?: string, staged?: boolean) => Promise<GitDiff[]>;
  initRepo: (path: string, connectionId?: string) => Promise<void>;
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
      const status = await gitGetStatus(path, connectionId);
      set({ status, currentBranch: status.branch, isLoading: false });
      return true;
    } catch (error) {
      set({ status: null, error: String(error), isLoading: false });
      return false;
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

  fetchDiff: async (path: string, file?: string, staged?: boolean) => {
    try {
      return await gitGetDiff(path, file, staged);
    } catch (error) {
      set({ error: String(error) });
      return [];
    }
  },

  initRepo: async (path: string, connectionId?: string) => {
    set({ isLoading: true, error: null });
    try {
      await gitInit(path);
      const ok = await get().fetchStatus(path, connectionId);
      if (ok) {
        await get().fetchBranches(path, connectionId);
        await get().fetchCommits(path, 50, connectionId);
      }
      set({ isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  checkout: async (path: string, branch: string) => {
    set({ isLoading: true, error: null });
    try {
      await gitCheckout(path, branch);
      await get().fetchStatus(path);
      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      toast.error(String(error));
    }
  },

  pull: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      await gitPull(path);
      await get().fetchStatus(path);
      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      toast.error(String(error));
    }
  },

  push: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      await gitPush(path);
      await get().fetchStatus(path);
      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      toast.error(String(error));
    }
  },

  commit: async (path: string, message: string) => {
    set({ isLoading: true, error: null });
    try {
      await gitCommit(path, message);
      await get().fetchStatus(path);
      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      toast.error(String(error));
    }
  },

  stage: async (path: string, files: string[]) => {
    set({ isLoading: true, error: null });
    try {
      await gitStage(path, files);
      await get().fetchStatus(path);
      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      toast.error(String(error));
    }
  },

  unstage: async (path: string, files: string[]) => {
    set({ isLoading: true, error: null });
    try {
      await gitUnstage(path, files);
      await get().fetchStatus(path);
      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      toast.error(String(error));
    }
  },

  stash: async (path: string, message?: string) => {
    set({ isLoading: true, error: null });
    try {
      await gitStash(path, message);
      await get().fetchStatus(path);
      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      toast.error(String(error));
    }
  },

  applyStash: async (path: string, _index: number) => {
    set({ isLoading: true, error: null });
    try {
      await gitStashPop(path);
      await get().fetchStatus(path);
      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      toast.error(String(error));
    }
  },

  dropStash: async (_path: string, _index: number) => {
    set({ isLoading: true, error: null });
    try {
      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      toast.error(String(error));
    }
  }
}));
