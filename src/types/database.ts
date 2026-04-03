export interface DatabaseConnection {
  id: string;
  name: string;
  type: 'postgresql' | 'mysql' | 'mongodb' | 'sqlite' | 'redis';
  host: string;
  port: number;
  database: string;
  username: string;
  ssl: boolean;
  connectionString?: string;
  color?: string;
}

export interface DatabaseTable {
  name: string;
  schema?: string;
  rowCount: number;
  columns: DatabaseColumn[];
}

export interface DatabaseColumn {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  foreignKey?: string;
  defaultValue?: string;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTime: number;
  error?: string;
}

export interface QueryHistory {
  id: string;
  query: string;
  timestamp: number;
  executionTime: number;
  rowCount: number;
  connectionId: string;
  success: boolean;
  error?: string;
}

export interface DatabaseState {
  connections: DatabaseConnection[];
  activeConnectionId: string | null;
  queryHistory: QueryHistory[];
  currentQuery: string;
}
