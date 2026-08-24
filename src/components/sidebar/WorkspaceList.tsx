import { useCallback, useMemo, useState, type FormEvent } from "react";
import { Layout, RefreshCw, Save, Trash2 } from "lucide-react";
import { useWorkspaceStore } from "../../stores/workspace";
import { Button, EmptyState, ICON_MD, ICON_SM, IconButton, Input, ListRow, ConfirmDialog } from "../../ui";
import { PanelGroup } from "./PanelChrome";

/** "Today", "Yesterday", "3d ago", then a short date. */
export function formatWorkspaceDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Saved workspaces: save the current session under a name, restore one by selecting it. */
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

  const handleSave = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const name = nameInput.trim() || `Workspace ${workspaces.length + 1}`;
      setSaving(true);
      try {
        await save(name);
        setNameInput("");
      } finally {
        setSaving(false);
      }
    },
    [nameInput, workspaces.length, save]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, remove]);

  return (
    <PanelGroup title="Workspaces" count={workspaces.length}>
      <form className="flex items-center gap-1.5 px-2 pb-1" onSubmit={handleSave}>
        <Input
          size="sm"
          aria-label="Workspace name"
          placeholder="Workspace name"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
        />
        <Button type="submit" size="sm" loading={saving} leadingIcon={<Save {...ICON_SM} />}>
          Save
        </Button>
      </form>

      {workspaces.length === 0 ? (
        <EmptyState
          icon={<Layout {...ICON_MD} />}
          title="No saved workspaces"
          description="Save your open tabs and splits to bring them back later."
        />
      ) : (
        workspaces.map((ws) => (
          <ListRow
            key={ws.id}
            icon={<Layout {...ICON_SM} />}
            label={ws.name}
            description={formatWorkspaceDate(ws.updatedAt)}
            onSelect={() => restore(ws.id)}
            actions={
              <>
                <IconButton
                  size="xs"
                  label="Update with current session"
                  icon={<RefreshCw {...ICON_SM} />}
                  onClick={() => void update(ws.id)}
                />
                <IconButton
                  size="xs"
                  label="Delete workspace"
                  icon={<Trash2 {...ICON_SM} />}
                  onClick={() => setDeleteTarget({ id: ws.id, name: ws.name })}
                />
              </>
            }
          />
        ))
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Workspace"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PanelGroup>
  );
}
