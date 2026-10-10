import { useCallback, useMemo, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent } from "react";
import { Icon } from "../../ui/icons";
import { savedConnections, useSshStore } from "../../stores/ssh";
import { useTerminalStore, getFirstPaneId } from "../../stores/terminal";
import { CONNECTION_TAG_COLORS } from "../../themes/connection-tags";
import { Badge, Button, ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger, EmptyState, IconButton, ListRow, cn, ConfirmDialog } from "../../ui";
import { openSavedConnection } from "../ssh/open-connection";
import { buildTreeRows, treeKeyAction, type TreeRow } from "./connection-tree";
import type { SshConnection } from "../../types/ssh";

interface ConnectionTreeProps {
  onAddConnection?: () => void;
  onEditConnection?: (conn: SshConnection) => void;
}

/** Tag name -> color. Unknown names are user data and pass through as-is. */
function tagColor(tag: string): string {
  return CONNECTION_TAG_COLORS.find((t) => t.name === tag)?.value ?? tag;
}

/**
 * Saved SSH connections as a tree (folders, then loose connections). One tab
 * stop; arrows move, Left/Right fold, Enter connects. Hover or focus shows the
 * inline actions; right-click (or the context-menu key) shows all of them.
 */
export default function ConnectionTree({ onAddConnection, onEditConnection }: ConnectionTreeProps) {
  const allConnections = useSshStore((s) => s.connections);
  const connections = useMemo(() => savedConnections(allConnections), [allConnections]);
  const saveConnection = useSshStore((s) => s.saveConnection);
  const deleteConnection = useSshStore((s) => s.deleteConnection);
  const addTab = useTerminalStore((s) => s.addTab);
  const panes = useTerminalStore((s) => s.panes);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragSourceRef = useRef<SshConnection | null>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

  const rows = useMemo(() => buildTreeRows(connections, collapsedFolders), [connections, collapsedFolders]);
  // The roving tab stop: the last focused row, or the first row when that one is gone.
  const tabStopId = rows.some((r) => r.id === focusId) ? focusId : (rows[0]?.id ?? null);

  // Connections with a tab open (terminal or SFTP) get a status dot.
  const openIds = useMemo(() => {
    const ids = new Set<string>();
    for (const pane of Object.values(panes)) {
      if (pane.sshConnectionId) ids.add(pane.sshConnectionId);
      if (pane.sftpConnectionId) ids.add(pane.sftpConnectionId);
    }
    return ids;
  }, [panes]);

  const toggleFolder = useCallback((folder: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  }, []);

  const handleConnect = useCallback(
    (conn: SshConnection) => openSavedConnection(conn),
    []
  );

  const handleConnectAll = useCallback(
    (conns: SshConnection[]) => {
      for (const conn of conns) handleConnect(conn);
    },
    [handleConnect]
  );

  const handleSftp = useCallback(
    (conn: SshConnection) => {
      addTab("sftp");
      const { tabs, renameTab } = useTerminalStore.getState();
      const newTab = tabs[tabs.length - 1];
      if (!newTab) return;
      renameTab(newTab.id, `SFTP: ${conn.name}`);
      const paneId = getFirstPaneId(newTab.panes);
      if (paneId) {
        useTerminalStore.setState((s) => ({
          panes: { ...s.panes, [paneId]: { ...s.panes[paneId], sftpConnectionId: conn.id } },
        }));
      }
    },
    [addTab]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteConnection(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, deleteConnection]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Keys from a portalled context menu bubble here through React; ignore them.
    if (!tabStopId || !event.currentTarget.contains(event.target as Node)) return;
    const result = treeKeyAction(rows, tabStopId, event.key);
    if (!result) return;
    event.preventDefault();
    if (result.toggleFolder) toggleFolder(result.toggleFolder);
    if (result.focus) {
      setFocusId(result.focus);
      rowRefs.current.get(result.focus)?.focus();
    }
  };

  // Drag to reorder within a folder: swap the two connections' sort orders.
  const handleDragStart = (event: DragEvent, conn: SshConnection) => {
    dragSourceRef.current = conn;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", conn.id);
  };

  const handleDragOver = (event: DragEvent, conn: SshConnection) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverId(conn.id);
  };

  const handleDrop = async (event: DragEvent, target: SshConnection) => {
    event.preventDefault();
    setDragOverId(null);
    const source = dragSourceRef.current;
    if (!source || source.id === target.id || source.folderPath !== target.folderPath) return;
    const now = new Date().toISOString();
    await saveConnection({ ...source, sortOrder: target.sortOrder, updatedAt: now });
    await saveConnection({ ...target, sortOrder: source.sortOrder, updatedAt: now });
    dragSourceRef.current = null;
  };

  const handleDragEnd = () => {
    setDragOverId(null);
    dragSourceRef.current = null;
  };

  const rowRef = (id: string) => (node: HTMLButtonElement | null) => {
    if (node) rowRefs.current.set(id, node);
    else rowRefs.current.delete(id);
  };

  if (connections.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="server" size="md" />}
        title="No connections"
        description="Save an SSH host to connect to it in one click."
        action={
          onAddConnection && (
            <Button size="sm" leadingIcon={<Icon name="add" size="sm" />} onClick={onAddConnection}>
              New SSH connection
            </Button>
          )
        }
      />
    );
  }

  const renderRow = (row: TreeRow) => {
    const treeProps = {
      ref: rowRef(row.id),
      role: "treeitem",
      tabIndex: row.id === tabStopId ? 0 : -1,
      onFocus: () => setFocusId(row.id),
    } as const;

    if (row.kind === "folder") {
      return (
        <ContextMenu key={row.id}>
          <ContextMenuTrigger asChild>
            <div>
              <ListRow
                {...treeProps}
                aria-level={1}
                aria-expanded={row.expanded}
                icon={
                  <>
                    <Icon name="disclosure"
                      size="sm"
                      className={cn("transition-transform duration-150 ease-out", row.expanded && "rotate-90")}
                    />
                    <Icon name="folder" size="sm" />
                  </>
                }
                label={row.folder}
                trailing={<Badge>{row.connections.length}</Badge>}
                onSelect={() => toggleFolder(row.folder)}
                actions={
                  <IconButton
                    size="xs"
                    tabIndex={-1}
                    label="Connect all"
                    icon={<Icon name="openSession" size="sm" />}
                    onClick={() => handleConnectAll(row.connections)}
                  />
                }
              />
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem icon={<Icon name="openSession" size="sm" />} onSelect={() => handleConnectAll(row.connections)}>
              Connect all
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );
    }

    const { conn } = row;
    const tag = conn.colorTag ? tagColor(conn.colorTag) : null;
    const isOpen = openIds.has(conn.id);
    return (
      <ContextMenu key={row.id}>
        <ContextMenuTrigger asChild>
          <div
            draggable
            onDragStart={(event) => handleDragStart(event, conn)}
            onDragOver={(event) => handleDragOver(event, conn)}
            onDrop={(event) => void handleDrop(event, conn)}
            onDragEnd={handleDragEnd}
            className={cn("rounded-md", dragOverId === conn.id && "bg-accent-subtle")}
          >
            <ListRow
              {...treeProps}
              aria-level={row.folder === null ? 1 : 2}
              indent={row.folder === null ? 0 : 1}
              icon={
                <>
                  {/* Always reserve the slot so tagged and untagged rows line up. */}
                  <span data-testid="tag-slot" className="inline-flex size-2 shrink-0">
                    {tag && (
                      <span
                        data-testid="tag-dot"
                        className="size-2 rounded-full bg-(--wt-dyn-tag)"
                        style={{ "--wt-dyn-tag": tag } as CSSProperties}
                      />
                    )}
                  </span>
                  <Icon name="server" size="sm" />
                </>
              }
              label={conn.name}
              description={`${conn.username}@${conn.host}:${conn.port}`}
              trailing={
                isOpen && <span role="img" aria-label="Open in a tab" className="size-1.5 shrink-0 rounded-full bg-success" />
              }
              onSelect={() => handleConnect(conn)}
              actions={
                <>
                  <IconButton size="xs" tabIndex={-1} label="Connect" icon={<Icon name="connect" size="sm" />} onClick={() => handleConnect(conn)} />
                  <IconButton size="xs" tabIndex={-1} label="Open SFTP" icon={<Icon name="folderOpen" size="sm" />} onClick={() => handleSftp(conn)} />
                  <IconButton size="xs" tabIndex={-1} label="Edit" icon={<Icon name="edit" size="sm" />} onClick={() => onEditConnection?.(conn)} />
                  <IconButton
                    size="xs"
                    tabIndex={-1}
                    label="Delete"
                    icon={<Icon name="delete" size="sm" />}
                    onClick={() => setDeleteTarget({ id: conn.id, name: conn.name })}
                  />
                </>
              }
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem icon={<Icon name="connect" size="sm" />} onSelect={() => handleConnect(conn)}>
            Connect
          </ContextMenuItem>
          <ContextMenuItem icon={<Icon name="folderOpen" size="sm" />} onSelect={() => handleSftp(conn)}>
            Open SFTP
          </ContextMenuItem>
          <ContextMenuItem icon={<Icon name="edit" size="sm" />} onSelect={() => onEditConnection?.(conn)}>
            Edit
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem danger icon={<Icon name="delete" size="sm" />} onSelect={() => setDeleteTarget({ id: conn.id, name: conn.name })}>
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <>
      <div role="tree" aria-label="Connections" className="flex flex-col" onKeyDown={handleKeyDown}>
        {rows.map(renderRow)}
      </div>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete connection"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
