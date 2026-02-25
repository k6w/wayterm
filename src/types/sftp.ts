export interface SftpEntry {
  name: string;
  path: string;
  size: number;
  modified: string | null;
  permissions: number;
  isDir: boolean;
  isSymlink: boolean;
}

export type TransferDirection = "upload" | "download";
export type TransferStatus = "queued" | "in_progress" | "completed" | "error";

export interface Transfer {
  id: string;
  direction: TransferDirection;
  localPath: string;
  remotePath: string;
  fileName: string;
  totalBytes: number;
  bytesTransferred: number;
  status: TransferStatus;
  error: string | null;
}

export interface SftpSessionInfo {
  id: string;
  connectionId: string;
  connectionName: string;
  remoteCwd: string;
  localCwd: string;
}
