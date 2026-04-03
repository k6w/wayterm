import { create } from "zustand";
import type { SshConnection, SshKey, ConnectionStatus } from "../types/ssh";
import {
  sshListConnections,
  sshSaveConnection,
  sshDeleteConnection,
  sshListKeys,
  sshImportKey,
  sshDeleteKey,
  sshUpdateKey,
  sshListPortForwards,
  sshSavePortForward,
  sshDeletePortForward,
  sshTogglePortForward,
  type PortForward,
} from "../lib/ipc";

interface SshSessionState {
  connectionId: string;
  sessionId: string;
  status: ConnectionStatus;
}

interface SshState {
  connections: SshConnection[];
  keys: SshKey[];
  sessions: SshSessionState[];
  portForwards: PortForward[];
  loaded: boolean;
  load: () => Promise<void>;
  saveConnection: (connection: SshConnection) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  loadKeys: () => Promise<void>;
  importKey: (request: {
    name: string;
    publicKey: string;
    privateKeyPem: string;
    algorithm: string;
  }) => Promise<SshKey>;
  removeKey: (id: string) => Promise<void>;
  updateKey: (id: string, name: string, publicKey: string) => Promise<void>;
  addSession: (session: SshSessionState) => void;
  removeSession: (sessionId: string) => void;
  updateSessionStatus: (sessionId: string, status: ConnectionStatus) => void;
  loadPortForwards: (connectionId: string) => Promise<void>;
  savePortForward: (forward: PortForward) => Promise<void>;
  deletePortForward: (id: string) => Promise<void>;
  togglePortForward: (id: string, isActive: boolean, sessionId?: string) => Promise<void>;
}

export const useSshStore = create<SshState>((set, get) => ({
  connections: [],
  keys: [],
  sessions: [],
  loaded: false,

  load: async () => {
    try {
      const [list, keyList] = await Promise.all([
        sshListConnections() as Promise<SshConnection[]>,
        sshListKeys() as Promise<SshKey[]>,
      ]);
      set({ connections: list, keys: keyList, loaded: true });
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

  loadKeys: async () => {
    try {
      const keyList = (await sshListKeys()) as SshKey[];
      set({ keys: keyList });
    } catch {
    }
  },

  importKey: async (request) => {
    const key = (await sshImportKey(request)) as SshKey;
    set((s) => ({ keys: [key, ...s.keys] }));
    return key;
  },

  removeKey: async (id: string) => {
    await sshDeleteKey(id);
    set((s) => ({
      keys: s.keys.filter((k) => k.id !== id),
    }));
  },

  updateKey: async (id: string, name: string, publicKey: string) => {
    await sshUpdateKey({ id, name, publicKey });
    set((s) => ({
      keys: s.keys.map((k) =>
        k.id === id ? { ...k, name, publicKey } : k
      ),
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

  portForwards: [],

  loadPortForwards: async (connectionId: string) => {
    try {
      const forwards = await sshListPortForwards(connectionId);
      set({ portForwards: forwards });
    } catch {
      set({ portForwards: [] });
    }
  },

  savePortForward: async (forward: PortForward) => {
    await sshSavePortForward(forward);
    const existing = get().portForwards;
    const idx = existing.findIndex((f) => f.id === forward.id);
    if (idx >= 0) {
      const updated = [...existing];
      updated[idx] = forward;
      set({ portForwards: updated });
    } else {
      set({ portForwards: [...existing, forward] });
    }
  },

  deletePortForward: async (id: string) => {
    await sshDeletePortForward(id);
    set((s) => ({
      portForwards: s.portForwards.filter((f) => f.id !== id),
    }));
  },

  togglePortForward: async (id: string, isActive: boolean, sessionId?: string) => {
    try {
      await sshTogglePortForward(id, isActive, sessionId);
      set((s) => ({
        portForwards: s.portForwards.map((f) =>
          f.id === id ? { ...f, isActive } : f
        ),
      }));
    } catch (e) {
      throw e;
    }
  },
}));
