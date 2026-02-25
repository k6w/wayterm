import { useCallback, useState } from "react";
import { Server, Plus, Plug, Trash2, Pencil, FolderOpen } from "lucide-react";
import { useSshStore } from "../../stores/ssh";
import { useTerminalStore, getFirstPaneId } from "../../stores/terminal";
import ConfirmDialog from "../ui/ConfirmDialog";
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

export default function ConnectionTree({ onAddConnection, onEditConnection }: ConnectionTreeProps) {
  const connections = useSshStore((s) => s.connections);
  const deleteConnection = useSshStore((s) => s.deleteConnection);
  const addTab = useTerminalStore((s) => s.addTab);
  const toggleSidebar = useTerminalStore((s) => s.toggleSidebar);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const handleConnect = useCallback(
    (conn: SshConnection) => {
      addTab("ssh", undefined, conn.id);
      const { tabs, renameTab } = useTerminalStore.getState();
      const newTab = tabs[tabs.length - 1];
      if (newTab) {
        renameTab(newTab.id, conn.name);
      }
      toggleSidebar();
    },
    [addTab, toggleSidebar]
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
      toggleSidebar();
    },
    [addTab, toggleSidebar]
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

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
          Connections
        </span>
        <button
          onClick={onAddConnection}
          className="flex size-5 items-center justify-center rounded text-text-muted transition-colors hover:bg-white/[0.08] hover:text-text-secondary"
        >
          <Plus size={14} />
        </button>
      </div>

      {connections.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-3 py-6">
          <Server size={18} className="text-text-muted" />
          <span className="text-xs text-text-muted">No connections</span>
          <button
            onClick={onAddConnection}
            className="rounded-md bg-white/[0.08] px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-white/[0.14] hover:text-text-primary"
          >
            Add Connection
          </button>
        </div>
      ) : (
        <div className="flex flex-col px-1">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.06] cursor-pointer"
              onClick={() => handleConnect(conn)}
            >
              {conn.colorTag && (
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      COLOR_MAP[conn.colorTag] || conn.colorTag,
                  }}
                />
              )}
              <Server size={14} className="shrink-0 text-text-muted" />
              <div className="flex min-w-0 flex-1 flex-col items-start">
                <span className="truncate text-xs text-text-secondary">
                  {conn.name}
                </span>
                <span className="truncate text-[10px] text-text-muted">
                  {conn.username}@{conn.host}:{conn.port}
                </span>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => handleConnect(conn)}
                  className="flex size-5 items-center justify-center rounded text-text-muted transition-colors hover:bg-white/[0.1] hover:text-accent"
                  title="Connect"
                >
                  <Plug size={11} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSftp(conn);
                  }}
                  className="flex size-5 items-center justify-center rounded text-text-muted transition-colors hover:bg-white/[0.1] hover:text-accent"
                  title="SFTP"
                >
                  <FolderOpen size={11} />
                </button>
                <button
                  onClick={(e) => handleEdit(e, conn)}
                  className="flex size-5 items-center justify-center rounded text-text-muted transition-colors hover:bg-white/[0.1] hover:text-text-primary"
                  title="Edit"
                >
                  <Pencil size={11} />
                </button>
                <button
                  onClick={(e) => handleRequestDelete(e, conn)}
                  className="flex size-5 items-center justify-center rounded text-text-muted transition-colors hover:bg-white/[0.1] hover:text-error"
                  title="Delete"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
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
