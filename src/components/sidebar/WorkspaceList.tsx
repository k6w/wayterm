import { useCallback, useMemo, useState, type FormEvent } from "react";
import { Icon } from "../../ui/icons";
import { useWorkspaceStore } from "../../stores/workspace";
import { useTerminalStore } from "../../stores/terminal";
import { toast } from "../../stores/toast";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Input,
  InputDialog,
  ListRow,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "../../ui";
import { plural } from "../../lib/plural";
import { countSnapshot, describeStartupTargets, parseWorkspaceLayout, snapshotPanes } from "../../lib/workspace-snapshot";
import type { RestoreMode, WorkspaceMeta, WorkspaceSnapshot } from "../../types/workspace";
import { PanelGroup } from "./PanelChrome";
import StartupCommandsDialog from "./StartupCommandsDialog";

/** "Today", "Yesterday", "3d ago", then a short date. */
export function formatWorkspaceDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function countsLabel(snapshot: WorkspaceSnapshot): string {
  const { tabs, panes } = countSnapshot(snapshot);
  return `${plural(tabs, "tab")} · ${plural(panes, "pane")}`;
}

/** Saved workspaces: save the open layout under a name, open one to bring its tabs, splits and commands back. */
export default function WorkspaceList() {
  const allWorkspaces = useWorkspaceStore((s) => s.workspaces);
  const workspaces = useMemo(() => allWorkspaces.filter((w) => w.id !== "__session__"), [allWorkspaces]);
  const hasTabs = useTerminalStore((s) => s.tabs.length > 0);
  const save = useWorkspaceStore((s) => s.save);
  const restore = useWorkspaceStore((s) => s.restore);
  const update = useWorkspaceStore((s) => s.update);
  const remove = useWorkspaceStore((s) => s.remove);
  const rename = useWorkspaceStore((s) => s.rename);
  const duplicate = useWorkspaceStore((s) => s.duplicate);
  const setStartupCommands = useWorkspaceStore((s) => s.setStartupCommands);

  const [saving, setSaving] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [choiceFor, setChoiceFor] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<WorkspaceMeta | null>(null);
  const [commandsTarget, setCommandsTarget] = useState<WorkspaceMeta | null>(null);
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

  const open = useCallback(
    (ws: WorkspaceMeta, mode: RestoreMode) => {
      setChoiceFor(null);
      if (!restore(ws.id, mode)) toast.error(`Could not open "${ws.name}": its saved layout is unreadable.`);
    },
    [restore]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, remove]);

  const commandsSnapshot = useMemo(() => parseWorkspaceLayout(commandsTarget?.layout), [commandsTarget]);

  return (
    <PanelGroup title="Workspaces" count={workspaces.length}>
      <form className="flex flex-col gap-1.5 px-2 pb-1" onSubmit={handleSave}>
        <Input
          size="sm"
          aria-label="Workspace name"
          placeholder="Workspace name"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
        />
        <Button
          type="submit"
          size="sm"
          loading={saving}
          disabled={!hasTabs}
          leadingIcon={<Icon name="save" size="sm" />}
        >
          Save current layout
        </Button>
      </form>

      {workspaces.length === 0 ? (
        <EmptyState
          icon={<Icon name="workspace" size="md" />}
          title="No saved workspaces"
          description="Save your open tabs, splits and folders to bring them back in one click."
        />
      ) : (
        workspaces.map((ws) => {
          const snapshot = parseWorkspaceLayout(ws.layout);
          return (
            <Popover
              key={ws.id}
              open={choiceFor === ws.id}
              onOpenChange={(next) => setChoiceFor(next ? ws.id : null)}
            >
              <PopoverAnchor asChild>
                <div>
                  <ListRow
                    icon={<Icon name="workspace" size="sm" />}
                    label={ws.name}
                    description={ws.lastOpenedAt ? `Opened ${formatWorkspaceDate(ws.lastOpenedAt)}` : "Never opened"}
                    trailing={
                      snapshot ? (
                        <Badge>{countsLabel(snapshot)}</Badge>
                      ) : (
                        <Badge tone="warning">Unreadable</Badge>
                      )
                    }
                    onSelect={() => (hasTabs ? setChoiceFor(ws.id) : open(ws, "replace"))}
                    actions={
                      <>
                        <IconButton
                          size="xs"
                          label="Open workspace"
                          icon={<Icon name="run" size="sm" />}
                          onClick={() => (hasTabs ? setChoiceFor(ws.id) : open(ws, "replace"))}
                        />
                        <IconButton
                          size="xs"
                          label="Update from current layout"
                          icon={<Icon name="refresh" size="sm" />}
                          disabled={!hasTabs}
                          onClick={() => void update(ws.id)}
                        />
                        <Menu>
                          <MenuTrigger asChild>
                            <IconButton size="xs" label="More actions" icon={<Icon name="more" size="sm" />} />
                          </MenuTrigger>
                          <MenuContent align="end">
                            <MenuItem icon={<Icon name="rename" size="sm" />} onSelect={() => setRenameTarget(ws)}>
                              Rename
                            </MenuItem>
                            <MenuItem icon={<Icon name="copy" size="sm" />} onSelect={() => void duplicate(ws.id)}>
                              Duplicate
                            </MenuItem>
                            <MenuItem
                              icon={<Icon name="run" size="sm" />}
                              disabled={!snapshot}
                              onSelect={() => setCommandsTarget(ws)}
                            >
                              Edit startup commands
                            </MenuItem>
                            <MenuSeparator />
                            <MenuItem
                              danger
                              icon={<Icon name="delete" size="sm" />}
                              onSelect={() => setDeleteTarget({ id: ws.id, name: ws.name })}
                            >
                              Delete
                            </MenuItem>
                          </MenuContent>
                        </Menu>
                      </>
                    }
                  />
                </div>
              </PopoverAnchor>
              <PopoverContent align="start" className="flex flex-col gap-1 p-1">
                <Button variant="ghost" className="justify-start" onClick={() => open(ws, "replace")}>
                  Replace current tabs
                </Button>
                <Button variant="ghost" className="justify-start" onClick={() => open(ws, "add")}>
                  Add to current tabs
                </Button>
              </PopoverContent>
            </Popover>
          );
        })
      )}

      <InputDialog
        open={!!renameTarget}
        title="Rename workspace"
        label="Name"
        defaultValue={renameTarget?.name}
        confirmLabel="Rename"
        onConfirm={(name) => {
          if (renameTarget) void rename(renameTarget.id, name);
          setRenameTarget(null);
        }}
        onCancel={() => setRenameTarget(null)}
      />

      <StartupCommandsDialog
        open={!!commandsTarget && !!commandsSnapshot}
        name={commandsTarget?.name ?? ""}
        targets={commandsSnapshot ? describeStartupTargets(commandsSnapshot) : []}
        paneCount={commandsSnapshot ? snapshotPanes(commandsSnapshot).length : 0}
        onSave={(commands) => {
          if (commandsTarget) void setStartupCommands(commandsTarget.id, commands);
          setCommandsTarget(null);
        }}
        onCancel={() => setCommandsTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete workspace"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PanelGroup>
  );
}
