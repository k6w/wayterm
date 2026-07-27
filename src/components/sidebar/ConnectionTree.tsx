import { useCallback, useState, useMemo, useRef } from "react";
import { Server, Plus, Plug, Trash2, Pencil, FolderOpen, ChevronRight, Folder, PlayCircle } from "lucide-react";
import { useSshStore } from "../../stores/ssh";
import { useTerminalStore, getFirstPaneId } from "../../stores/terminal";
import ConfirmDialog from "../ui/ConfirmDialog";
import { EmptyState } from "../ui/EmptyState";
import type { SshConnection } from "../../types/ssh";

interface ConnectionTreeProps {
  onAddConnection?: () => void;
  onEditConnection?: (conn: SshConnection) => void;
}

const COLOR_MAP: Record<string, string> = {
  red: "#ef4444",
  green: "#22c55e",
  blue: "#3b82f6",
  yellow: "#eab308",
  purple: "#a855f7",
  cyan: "#06b6d4",
  orange: "#f97316",
  pink: "#ec4899",
};

function ConnectionItem({ conn, indent, onConnect, onSftp, onEdit, onDelete, onDragStart, onDragOver, onDrop, onDragEnd, isDragOver }: {
  conn: SshConnection;
  indent?: boolean;
  onConnect: (c: SshConnection) => void;
  onSftp: (c: SshConnection) => void;
  onEdit: (e: React.MouseEvent, c: SshConnection) => void;
  onDelete: (e: React.MouseEvent, c: SshConnection) => void;
  onDragStart: (e: React.DragEvent, c: SshConnection) => void;
  onDragOver: (e: React.DragEvent, c: SshConnection) => void;
  onDrop: (e: React.DragEvent, c: SshConnection) => void;
  onDragEnd: () => void;
  isDragOver: boolean;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, conn)}
      onDragOver={(e) => onDragOver(e, conn)}
      onDrop={(e) => onDrop(e, conn)}
      onDragEnd={onDragEnd}
      className={`group flex items-center gap-2 rounded-md py-1.5 transition-colors hover:bg-overlay/[0.06] cursor-pointer ${indent ? "pl-6 pr-2" : "px-2"} ${isDragOver ? "border border-dashed border-accent/50 bg-accent/5" : "border border-transparent"}`}
      onClick={() => onConnect(conn)}
    >
      {conn.colorTag && (
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: COLOR_MAP[conn.colorTag] || conn.colorTag }}
        />
      )}
      <Server size={14} className="shrink-0 text-text-muted" />
      <div className="flex min-w-0 flex-1 flex-col items-start">
        <span className="truncate text-xs text-text-primary">{conn.name}</span>
        <span className="truncate text-[10px] text-text-muted">{conn.username}@{conn.host}:{conn.port}</span>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button onClick={() => onConnect(conn)} className="flex size-5 items-center justify-center rounded text-text-muted transition-colors hover:bg-overlay/[0.1] hover:text-accent" title="Connect"><Plug size={11} /></button>
        <button onClick={(e) => { e.stopPropagation(); onSftp(conn); }} className="flex size-5 items-center justify-center rounded text-text-muted transition-colors hover:bg-overlay/[0.1] hover:text-accent" title="SFTP"><FolderOpen size={11} /></button>
        <button onClick={(e) => onEdit(e, conn)} className="flex size-5 items-center justify-center rounded text-text-muted transition-colors hover:bg-overlay/[0.1] hover:text-text-primary" title="Edit"><Pencil size={11} /></button>
        <button onClick={(e) => onDelete(e, conn)} className="flex size-5 items-center justify-center rounded text-text-muted transition-colors hover:bg-overlay/[0.1] hover:text-error" title="Delete"><Trash2 size={11} /></button>
      </div>
    </div>
  );
}

export default function ConnectionTree({ onAddConnection, onEditConnection }: ConnectionTreeProps) {
  const connections = useSshStore((s) => s.connections);
  const saveConnection = useSshStore((s) => s.saveConnection);
  const deleteConnection = useSshStore((s) => s.deleteConnection);
  const addTab = useTerminalStore((s) => s.addTab);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragSourceRef = useRef<SshConnection | null>(null);

  const grouped = useMemo(() => {
    const folders = new Map<string, SshConnection[]>();
    const ungrouped: SshConnection[] = [];
    for (const conn of [...connections].sort((a, b) => a.sortOrder - b.sortOrder)) {
      if (conn.folderPath && conn.folderPath.trim() && conn.folderPath.trim() !== "/") {
        const folder = conn.folderPath.trim();
        if (!folders.has(folder)) folders.set(folder, []);
        folders.get(folder)!.push(conn);
      } else {
        ungrouped.push(conn);
      }
    }
    return { folders, ungrouped };
  }, [connections]);

  const toggleFolder = useCallback((folder: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  }, []);

  const handleConnect = useCallback(
    (conn: SshConnection) => {
      addTab("ssh", undefined, conn.id);
      const { tabs, renameTab } = useTerminalStore.getState();
      const newTab = tabs[tabs.length - 1];
      if (newTab) {
        renameTab(newTab.id, conn.name);
      }
    },
    [addTab]
  );

  const handleConnectAll = useCallback(
    (conns: SshConnection[]) => {
      for (const conn of conns) {
        addTab("ssh", undefined, conn.id);
        const { tabs, renameTab } = useTerminalStore.getState();
        const newTab = tabs[tabs.length - 1];
        if (newTab) {
          renameTab(newTab.id, conn.name);
        }
      }
    },
    [addTab]
  );

  const handleSftp = useCallback(
    (conn: SshConnection) => {
      addTab("sftp");
      const { tabs, renameTab } = useTerminalStore.getState();
      const newTab = tabs[tabs.length - 1];
      if (newTab) {
        renameTab(newTab.id, `SFTP: ${conn.name}`);
        const paneId = getFirstPaneId(newTab.panes);
        if (paneId) {
          useTerminalStore.setState((s) => ({
            panes: {
              ...s.panes,
              [paneId]: { ...s.panes[paneId], sftpConnectionId: conn.id },
            },
          }));
        }
      }
    },
    [addTab]
  );

  const handleRequestDelete = useCallback(
    (e: React.MouseEvent, conn: SshConnection) => {
      e.stopPropagation();
      setDeleteTarget({ id: conn.id, name: conn.name });
    },
    []
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteConnection(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, deleteConnection]);

  const handleEdit = useCallback(
    (e: React.MouseEvent, conn: SshConnection) => {
      e.stopPropagation();
      onEditConnection?.(conn);
    },
    [onEditConnection]
  );

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, conn: SshConnection) => {
    dragSourceRef.current = conn;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", conn.id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, conn: SshConnection) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(conn.id);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetConn: SshConnection) => {
      e.preventDefault();
      setDragOverId(null);
      const source = dragSourceRef.current;
      if (!source || source.id === targetConn.id) return;

      // Reorder: swap sort orders within same folder
      if (source.folderPath !== targetConn.folderPath) return;

      const now = new Date().toISOString();
      const sourceSortOrder = source.sortOrder;
      const targetSortOrder = targetConn.sortOrder;

      await saveConnection({ ...source, sortOrder: targetSortOrder, updatedAt: now });
      await saveConnection({ ...targetConn, sortOrder: sourceSortOrder, updatedAt: now });
      dragSourceRef.current = null;
    },
    [saveConnection]
  );

  const handleDragEnd = useCallback(() => {
    setDragOverId(null);
    dragSourceRef.current = null;
  }, []);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
          Connections
        </span>
        <button
          onClick={onAddConnection}
          className="flex size-5 items-center justify-center rounded text-text-muted transition-colors hover:bg-overlay/[0.08] hover:text-text-secondary"
        >
          <Plus size={14} />
        </button>
      </div>

      {connections.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No connections"
          action={onAddConnection ? { label: "Add Connection", onClick: onAddConnection } : undefined}
        />
      ) : (
        <div className="flex flex-col px-1">
          {Array.from(grouped.folders.entries()).map(([folder, conns]) => (
            <div key={folder}>
              <div
                className="group flex items-center gap-1.5 px-2 py-1.5 cursor-pointer rounded-md hover:bg-overlay/[0.04] select-none"
                onClick={() => toggleFolder(folder)}
              >
                <ChevronRight
                  size={12}
                  className={`text-text-muted transition-transform ${collapsedFolders.has(folder) ? "" : "rotate-90"}`}
                />
                <Folder size={13} className="text-text-muted" />
                <span className="text-[11px] text-text-secondary font-medium truncate flex-1">{folder}</span>
                <span className="text-[10px] text-text-muted">{conns.length}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleConnectAll(conns); }}
                  className="opacity-0 group-hover:opacity-100 flex size-5 items-center justify-center rounded text-text-muted transition-colors hover:bg-overlay/[0.1] hover:text-accent"
                  title="Connect All"
                >
                  <PlayCircle size={12} />
                </button>
              </div>
              {!collapsedFolders.has(folder) && conns.map((conn) => (
                <ConnectionItem
                  key={conn.id}
                  conn={conn}
                  indent
                  onConnect={handleConnect}
                  onSftp={handleSftp}
                  onEdit={handleEdit}
                  onDelete={handleRequestDelete}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  isDragOver={dragOverId === conn.id}
                />
              ))}
            </div>
          ))}
          {grouped.ungrouped.map((conn) => (
            <ConnectionItem
              key={conn.id}
              conn={conn}
              onConnect={handleConnect}
              onSftp={handleSftp}
              onEdit={handleEdit}
              onDelete={handleRequestDelete}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              isDragOver={dragOverId === conn.id}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Connection"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
