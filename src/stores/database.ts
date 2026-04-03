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

interface DatabaseStore extends DatabaseState {
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
  queryHistory: [],
  currentQuery: "",

  connect: async (connectionId: string) => {
    try {
      await dbConnect(connectionId);
      set({ activeConnectionId: connectionId });
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
  },

  disconnect: async () => {
    try {
      const { activeConnectionId } = get();
      if (activeConnectionId) {
        await dbDisconnect(activeConnectionId);
        set({ activeConnectionId: null });
      }
    } catch (error) {
      console.error('Failed to disconnect from database:', error);
      throw error;
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
