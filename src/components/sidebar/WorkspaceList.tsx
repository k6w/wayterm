import { useState, useCallback, useMemo } from "react";
import { Layout, Save, Trash2, RotateCcw, RefreshCw } from "lucide-react";
import { useWorkspaceStore } from "../../stores/workspace";
import ConfirmDialog from "../ui/ConfirmDialog";
import { EmptyState } from "../ui/EmptyState";

export default function WorkspaceList() {
  const allWorkspaces = useWorkspaceStore((s) => s.workspaces);
  const workspaces = useMemo(() => allWorkspaces.filter((w) => w.id !== "__session__"), [allWorkspaces]);
  const save = useWorkspaceStore((s) => s.save);
  const restore = useWorkspaceStore((s) => s.restore);
  const update = useWorkspaceStore((s) => s.update);
  const remove = useWorkspaceStore((s) => s.remove);

  const [saving, setSaving] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const handleSave = useCallback(async () => {
    const name = nameInput.trim() || `Workspace ${workspaces.length + 1}`;
    setSaving(true);
    try {
      await save(name);
      setNameInput("");
    } finally {
      setSaving(false);
    }
  }, [nameInput, workspaces.length, save]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, remove]);

  const formatDate = (iso: string): string => {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
          Workspaces
        </span>
      </div>

      <div className="px-3 pb-2">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="Workspace name..."
            className="min-w-0 flex-1 rounded-md bg-overlay/[0.06] px-2 py-1 text-xs text-text-primary outline-none placeholder:text-text-muted focus:bg-overlay/[0.1]"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 rounded-md bg-overlay/[0.08] px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-overlay/[0.14] hover:text-text-primary disabled:opacity-50"
          >
            <Save size={12} />
            <span>Save</span>
          </button>
        </div>
      </div>

      {workspaces.length === 0 ? (
        <EmptyState icon={Layout} title="No saved workspaces" />
      ) : (
        <div className="flex flex-col px-1">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className="group flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-overlay/[0.06]"
            >
              <Layout size={14} className="shrink-0 text-text-muted" />
              <div className="flex min-w-0 flex-1 flex-col items-start">
                <span className="truncate text-xs text-text-secondary">
                  {ws.name}
                </span>
                <span className="text-[10px] text-text-muted">
                  {formatDate(ws.updatedAt)}
                </span>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => restore(ws.id)}
                  className="flex size-5 items-center justify-center rounded text-text-muted transition-colors hover:bg-overlay/[0.1] hover:text-text-primary"
                  title="Restore workspace"
                >
                  <RotateCcw size={11} />
                </button>
                <button
                  onClick={() => update(ws.id)}
                  className="flex size-5 items-center justify-center rounded text-text-muted transition-colors hover:bg-overlay/[0.1] hover:text-accent"
                  title="Update workspace with current session"
                >
                  <RefreshCw size={11} />
                </button>
                <button
                  onClick={() => setDeleteTarget({ id: ws.id, name: ws.name })}
                  className="flex size-5 items-center justify-center rounded text-text-muted transition-colors hover:bg-overlay/[0.1] hover:text-error"
                  title="Delete workspace"
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
        title="Delete Workspace"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
