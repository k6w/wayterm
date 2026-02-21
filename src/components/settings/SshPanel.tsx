import { useState, useCallback } from "react";
import { Server, Trash2 } from "lucide-react";
import { useSettingsStore } from "../../stores/settings";
import { useSshStore } from "../../stores/ssh";
import ConfirmDialog from "../ui/ConfirmDialog";

export default function SshPanel() {
  const settings = useSettingsStore((s) => s.settings.ssh);
  const update = useSettingsStore((s) => s.update);
  const connections = useSshStore((s) => s.connections);
  const deleteConnection = useSshStore((s) => s.deleteConnection);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteConnection(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, deleteConnection]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Connection Defaults</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Default Port</label>
            <input
              type="number"
              min={1}
              max={65535}
              value={settings.defaultPort}
              onChange={(e) => update("ssh", { defaultPort: Number(e.target.value) })}
              className="bg-bg-tertiary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-28"
            />
          </div>
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Default Username</label>
            <input
              type="text"
              value={settings.defaultUsername}
              onChange={(e) => update("ssh", { defaultUsername: e.target.value })}
              placeholder="root"
              className="bg-bg-tertiary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-44"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Timeouts</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Keepalive Interval (seconds)</label>
            <input
              type="number"
              min={0}
              max={300}
              value={settings.keepaliveInterval}
              onChange={(e) => update("ssh", { keepaliveInterval: Number(e.target.value) })}
              className="bg-bg-tertiary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-28"
            />
          </div>
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Connection Timeout (seconds)</label>
            <input
              type="number"
              min={1}
              max={120}
              value={settings.connectionTimeout}
              onChange={(e) => update("ssh", { connectionTimeout: Number(e.target.value) })}
              className="bg-bg-tertiary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-28"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">
          Saved Connections ({connections.length})
        </h3>
        {connections.length === 0 ? (
          <div className="py-6 text-center text-sm text-text-muted border border-border border-dashed rounded-lg">
            No saved connections. Use the sidebar to add connections.
          </div>
        ) : (
          <div className="space-y-2">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center gap-3 px-4 py-2.5 border border-border rounded-lg bg-bg-tertiary"
              >
                <Server size={14} className="shrink-0 text-text-muted" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary truncate">{conn.name}</div>
                  <div className="text-xs text-text-muted truncate">
                    {conn.username}@{conn.host}:{conn.port} ({conn.authMethod})
                  </div>
                </div>
                <button
                  onClick={() => setDeleteTarget({ id: conn.id, name: conn.name })}
                  className="p-1 text-text-muted hover:text-error transition-colors shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

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
