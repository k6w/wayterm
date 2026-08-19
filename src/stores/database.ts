import { create } from "zustand";
import type { DatabaseState, DatabaseConnection, QueryResult, QueryHistory, DatabaseTable } from "../types/database";
import {
  dbConnect,
  dbDisconnect,
  dbExecuteQuery,
  dbGetTables,
  dbGetTableSchema,
  dbListConnections,
  dbSaveConnection,
  dbDeleteConnection
} from "../lib/ipc";
import { toast } from "./toast";

/** Editor text and last outcome for one connection. Memory only, so it survives panel switches but not a restart. */
export interface QueryWorkspace {
  query: string;
  result: QueryResult | null;
  error: string | null;
}

export const EMPTY_WORKSPACE: QueryWorkspace = { query: "", result: null, error: null };

interface DatabaseStore extends DatabaseState {
  workspaces: Record<string, QueryWorkspace>;
  updateWorkspace: (connectionId: string, patch: Partial<QueryWorkspace>) => void;
  activeConnection: DatabaseConnection | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  connect: (connectionId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  executeQuery: (query: string) => Promise<QueryResult>;
  getTables: () => Promise<DatabaseTable[]>;
  getTableSchema: (table: string) => Promise<DatabaseTable>;
  loadConnections: () => Promise<void>;
  saveConnection: (connection: DatabaseConnection) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  setCurrentQuery: (query: string) => void;
  addToHistory: (query: string, result: QueryResult) => void;
  clearHistory: () => void;
}

export const useDatabaseStore = create<DatabaseStore>((set, get) => ({
  connections: [],
  activeConnectionId: null,
  activeConnection: null,
  isConnected: false,
  isLoading: false,
  error: null,
  queryHistory: [],
  currentQuery: "",
  workspaces: {},

  updateWorkspace: (connectionId, patch) => {
    set((state) => ({
      workspaces: {
        ...state.workspaces,
        [connectionId]: { ...(state.workspaces[connectionId] ?? EMPTY_WORKSPACE), ...patch },
      },
    }));
  },

  connect: async (connectionId: string) => {
    try {
      set({ isLoading: true, error: null });
      await dbConnect(connectionId);
      const connection = get().connections.find(c => c.id === connectionId) || null;
      set({ activeConnectionId: connectionId, activeConnection: connection, isConnected: true, isLoading: false });
    } catch (error) {
      console.error('Failed to connect to database:', error);
      const message = error instanceof Error ? error.message : 'Connection failed';
      set({ error: message, isLoading: false });
      toast.error(message);
    }
  },

  disconnect: async () => {
    try {
      set({ isLoading: true });
      const { activeConnectionId } = get();
      if (activeConnectionId) {
        await dbDisconnect(activeConnectionId);
        set({ activeConnectionId: null, activeConnection: null, isConnected: false, isLoading: false });
      }
    } catch (error) {
      console.error('Failed to disconnect from database:', error);
      const message = error instanceof Error ? error.message : 'Disconnect failed';
      set({ error: message, isLoading: false });
      toast.error(message);
    }
  },

  executeQuery: async (query: string) => {
    const { activeConnectionId } = get();
    if (!activeConnectionId) {
      throw new Error('No active database connection');
    }

    try {
      const startTime = Date.now();
      const result = await dbExecuteQuery(activeConnectionId, query);
      const executionTime = Date.now() - startTime;
      
      const enrichedResult = { ...result, executionTime };
      get().addToHistory(query, enrichedResult);
      
      return enrichedResult;
    } catch (error) {
      const errorResult: QueryResult = {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      get().addToHistory(query, errorResult);
      throw error;
    }
  },

  getTables: async () => {
    const { activeConnectionId } = get();
    if (!activeConnectionId) {
      throw new Error('No active database connection');
    }

    try {
      return await dbGetTables(activeConnectionId);
    } catch (error) {
      console.error('Failed to get tables:', error);
      return [];
    }
  },

  getTableSchema: async (table: string) => {
    const { activeConnectionId } = get();
    if (!activeConnectionId) {
      throw new Error('No active database connection');
    }

    try {
      return await dbGetTableSchema(activeConnectionId, table);
    } catch (error) {
      console.error('Failed to get table schema:', error);
      throw error;
    }
  },

  loadConnections: async () => {
    try {
      const connections = await dbListConnections();
      set({ connections });
    } catch (error) {
      console.error('Failed to load connections:', error);
    }
  },

  saveConnection: async (connection: DatabaseConnection) => {
    try {
      await dbSaveConnection(connection);
      await get().loadConnections();
    } catch (error) {
      console.error('Failed to save connection:', error);
      throw error;
    }
  },

  deleteConnection: async (id: string) => {
    try {
      await dbDeleteConnection(id);
      set((state) => ({
        connections: state.connections.filter(c => c.id !== id),
        activeConnectionId: state.activeConnectionId === id ? null : state.activeConnectionId
      }));
    } catch (error) {
      console.error('Failed to delete connection:', error);
      throw error;
    }
  },

  setCurrentQuery: (query: string) => {
    set({ currentQuery: query });
  },

  addToHistory: (query: string, result: QueryResult) => {
    const { activeConnectionId } = get();
    if (!activeConnectionId) return;

    const historyEntry: QueryHistory = {
      id: crypto.randomUUID(),
      query,
      timestamp: Date.now(),
      executionTime: result.executionTime,
      duration: result.executionTime,
      rowCount: result.rowCount,
      connectionId: activeConnectionId,
      success: !result.error,
      error: result.error
    };

    set((state) => ({
      queryHistory: [historyEntry, ...state.queryHistory].slice(0, 100)
    }));
  },

  clearHistory: () => {
    set({ queryHistory: [] });
  }
}));
