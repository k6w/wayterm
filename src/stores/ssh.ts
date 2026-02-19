import { create } from "zustand";
import type { SshConnection, ConnectionStatus } from "../types/ssh";
import { sshListConnections, sshSaveConnection, sshDeleteConnection } from "../lib/ipc";

interface SshSessionState {
  connectionId: string;
  sessionId: string;
  status: ConnectionStatus;
}

interface SshState {
  connections: SshConnection[];
  sessions: SshSessionState[];
  loaded: boolean;
  load: () => Promise<void>;
  saveConnection: (connection: SshConnection) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  addSession: (session: SshSessionState) => void;
  removeSession: (sessionId: string) => void;
  updateSessionStatus: (sessionId: string, status: ConnectionStatus) => void;
}

export const useSshStore = create<SshState>((set, get) => ({
  connections: [],
  sessions: [],
  loaded: false,

  load: async () => {
    try {
      const list = (await sshListConnections()) as SshConnection[];
      set({ connections: list, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  saveConnection: async (connection: SshConnection) => {
    await sshSaveConnection(connection);
    const existing = get().connections;
    const idx = existing.findIndex((c) => c.id === connection.id);
    if (idx >= 0) {
      const updated = [...existing];
      updated[idx] = connection;
      set({ connections: updated });
    } else {
      set({ connections: [...existing, connection] });
    }
  },

  deleteConnection: async (id: string) => {
    await sshDeleteConnection(id);
    set((s) => ({
      connections: s.connections.filter((c) => c.id !== id),
    }));
  },

  addSession: (session) => {
    set((s) => ({ sessions: [...s.sessions, session] }));
  },

  removeSession: (sessionId) => {
    set((s) => ({
      sessions: s.sessions.filter((ses) => ses.sessionId !== sessionId),
    }));
  },

  updateSessionStatus: (sessionId, status) => {
    set((s) => ({
      sessions: s.sessions.map((ses) =>
        ses.sessionId === sessionId ? { ...ses, status } : ses
      ),
    }));
  },
}));
