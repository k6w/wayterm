import { create } from "zustand";
import type { SftpEntry, Transfer, SftpSessionInfo } from "../types/sftp";
import {
  sftpConnect,
  sftpDisconnect,
  sftpListDir,
  sftpMkdir,
  sftpRemove,
  sftpRename,
  sftpDownload,
  sftpUpload,
  localListDir,
  getHomeDir,
} from "../lib/ipc";

interface SftpState {
  sessions: Record<string, SftpSessionInfo>;
  remoteEntries: Record<string, SftpEntry[]>;
  localEntries: Record<string, SftpEntry[]>;
  transfers: Transfer[];
  localCollapsed: Record<string, boolean>;

  connect: (connectionId: string, connectionName: string) => Promise<string>;
  disconnect: (sessionId: string) => Promise<void>;
  loadRemoteDir: (sessionId: string, path: string) => Promise<void>;
  loadLocalDir: (sessionId: string, path: string) => Promise<void>;
  remoteMkdir: (sessionId: string, path: string) => Promise<void>;
  remoteRemove: (sessionId: string, path: string, isDir: boolean) => Promise<void>;
  remoteRename: (sessionId: string, oldPath: string, newPath: string) => Promise<void>;
  download: (sessionId: string, remotePath: string, localPath: string) => Promise<void>;
  upload: (sessionId: string, localPath: string, remotePath: string) => Promise<void>;
  updateTransferProgress: (transferId: string, bytesTransferred: number, totalBytes: number, status: string, error: string | null) => void;
  clearCompletedTransfers: () => void;
  setLocalCollapsed: (sessionId: string, collapsed: boolean) => void;
  setRemoteCwd: (sessionId: string, cwd: string) => void;
  setLocalCwd: (sessionId: string, cwd: string) => void;
}

export const useSftpStore = create<SftpState>((set, get) => ({
  sessions: {},
  remoteEntries: {},
  localEntries: {},
  transfers: [],
  localCollapsed: {},

  connect: async (connectionId, connectionName) => {
    const sessionId = await sftpConnect(connectionId);
    const home = await getHomeDir();
    set((s) => ({
      sessions: {
        ...s.sessions,
        [sessionId]: {
          id: sessionId,
          connectionId,
          connectionName,
          remoteCwd: "/",
          localCwd: home || "",
        },
      },
    }));
    get().loadRemoteDir(sessionId, "/");
    if (home) get().loadLocalDir(sessionId, home);
    return sessionId;
  },

  disconnect: async (sessionId) => {
    await sftpDisconnect(sessionId);
    set((s) => {
      const sessions = { ...s.sessions };
      delete sessions[sessionId];
      const remoteEntries = { ...s.remoteEntries };
      delete remoteEntries[sessionId];
      const localEntries = { ...s.localEntries };
      delete localEntries[sessionId];
      return { sessions, remoteEntries, localEntries };
    });
  },

  loadRemoteDir: async (sessionId, path) => {
    try {
      const entries = await sftpListDir(sessionId, path);
      set((s) => ({
        remoteEntries: { ...s.remoteEntries, [sessionId]: entries },
        sessions: s.sessions[sessionId]
          ? { ...s.sessions, [sessionId]: { ...s.sessions[sessionId], remoteCwd: path } }
          : s.sessions,
      }));
    } catch {
    }
  },

  loadLocalDir: async (sessionId, path) => {
    try {
      const entries = await localListDir(path);
      set((s) => ({
        localEntries: { ...s.localEntries, [sessionId]: entries },
        sessions: s.sessions[sessionId]
          ? { ...s.sessions, [sessionId]: { ...s.sessions[sessionId], localCwd: path } }
          : s.sessions,
      }));
    } catch {
    }
  },

  remoteMkdir: async (sessionId, path) => {
    await sftpMkdir(sessionId, path);
    const session = get().sessions[sessionId];
    if (session) get().loadRemoteDir(sessionId, session.remoteCwd);
  },

  remoteRemove: async (sessionId, path, isDir) => {
    await sftpRemove(sessionId, path, isDir);
    const session = get().sessions[sessionId];
    if (session) get().loadRemoteDir(sessionId, session.remoteCwd);
  },

  remoteRename: async (sessionId, oldPath, newPath) => {
    await sftpRename(sessionId, oldPath, newPath);
    const session = get().sessions[sessionId];
    if (session) get().loadRemoteDir(sessionId, session.remoteCwd);
  },

  download: async (sessionId, remotePath, localPath) => {
    const transferId = crypto.randomUUID();
    const fileName = remotePath.split("/").pop() || remotePath;
    set((s) => ({
      transfers: [...s.transfers, {
        id: transferId, direction: "download" as const, localPath, remotePath, fileName,
        totalBytes: 0, bytesTransferred: 0, status: "queued" as const, error: null,
      }],
    }));
    await sftpDownload(sessionId, remotePath, localPath, transferId);
  },

  upload: async (sessionId, localPath, remotePath) => {
    const transferId = crypto.randomUUID();
    const fileName = localPath.split(/[/\\]/).pop() || localPath;
    set((s) => ({
      transfers: [...s.transfers, {
        id: transferId, direction: "upload" as const, localPath, remotePath, fileName,
        totalBytes: 0, bytesTransferred: 0, status: "queued" as const, error: null,
      }],
    }));
    await sftpUpload(sessionId, localPath, remotePath, transferId);
  },

  updateTransferProgress: (transferId, bytesTransferred, totalBytes, status, error) => {
    set((s) => ({
      transfers: s.transfers.map((t) =>
        t.id === transferId
          ? { ...t, bytesTransferred, totalBytes, status: status as Transfer["status"], error }
          : t
      ),
    }));
  },

  clearCompletedTransfers: () => {
    set((s) => ({
      transfers: s.transfers.filter((t) => t.status !== "completed" && t.status !== "error"),
    }));
  },

  setLocalCollapsed: (sessionId, collapsed) => {
    set((s) => ({ localCollapsed: { ...s.localCollapsed, [sessionId]: collapsed } }));
  },

  setRemoteCwd: (sessionId, cwd) => {
    set((s) => ({
      sessions: s.sessions[sessionId]
        ? { ...s.sessions, [sessionId]: { ...s.sessions[sessionId], remoteCwd: cwd } }
        : s.sessions,
    }));
  },

  setLocalCwd: (sessionId, cwd) => {
    set((s) => ({
      sessions: s.sessions[sessionId]
        ? { ...s.sessions, [sessionId]: { ...s.sessions[sessionId], localCwd: cwd } }
        : s.sessions,
    }));
  },
}));
