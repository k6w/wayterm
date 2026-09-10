export type AuthMethod = "password" | "key" | "agent";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface SshConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: AuthMethod;
  privateKeyId: string | null;
  jumpHostId: string | null;
  startupCommands: string | null;
  colorTag: string | null;
  folderPath: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  themeOverride?: string | null;
  agentForwarding?: boolean;
  envVars?: Record<string, string>;
  /** In-memory only (a quick connect): never saved, hidden from connection lists. */
  transient?: boolean;
}

export interface SshKey {
  id: string;
  name: string;
  algorithm: "rsa" | "ed25519";
  publicKey: string;
  fingerprint: string;
  createdAt: string;
}

export interface SshSession {
  connectionId: string;
  sessionId: string;
  status: ConnectionStatus;
  latencyMs: number | null;
  error: string | null;
}

export interface PortForward {
  id: string;
  connectionId: string;
  type: "local" | "remote" | "dynamic";
  localPort: number;
  remoteHost: string;
  remotePort: number;
  isActive: boolean;
}
