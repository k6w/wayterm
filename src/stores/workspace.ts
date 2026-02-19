import { create } from "zustand";
import type { WorkspaceMeta } from "../types/workspace";
import { workspaceList, workspaceSave, workspaceDelete } from "../lib/ipc";
import { useTerminalStore } from "./terminal";

interface WorkspaceState {
  workspaces: WorkspaceMeta[];
  loaded: boolean;
  load: () => Promise<void>;
  save: (name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  loaded: false,

  load: async () => {
    try {
      const list = (await workspaceList()) as WorkspaceMeta[];
      set({ workspaces: list, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  save: async (name: string) => {
    const { tabs, panes } = useTerminalStore.getState();
    const layout = JSON.stringify({ tabs, panes });
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await workspaceSave({
      id,
      name,
      icon: null,
      layout,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    });

    const current = get().workspaces;
    set({
      workspaces: [
        ...current,
        { id, name, icon: null, isDefault: false, updatedAt: now },
      ],
    });
  },

  remove: async (id: string) => {
    await workspaceDelete(id);
    set((s) => ({
      workspaces: s.workspaces.filter((w) => w.id !== id),
    }));
  },
}));
