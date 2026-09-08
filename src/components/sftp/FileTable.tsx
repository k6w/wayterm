import { useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import { Icon, Icons, type IconComponent } from "../../ui/icons";
import { isMac } from "../../lib/platform";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  EmptyState,
  ICON_SM,
  cn,
  focusRing,
} from "../../ui";
import type { SftpEntry } from "../../types/sftp";
import {
  applySelection,
  fileMenuItems,
  formatDate,
  formatSize,
  nextSort,
  sortEntries,
  type FileAction,
  type SftpSide,
  type SortKey,
  type SortState,
} from "./file-table";

const ACTION_ICONS: Record<FileAction, IconComponent> = {
  open: Icons.folderOpen,
  download: Icons.download,
  upload: Icons.upload,
  rename: Icons.edit,
  delete: Icons.delete,
  copy_path: Icons.copy,
  new_folder: Icons.newFolder,
  refresh: Icons.refresh,
};

const COLUMNS: { key: SortKey; label: string; className: string }[] = [
  { key: "name", label: "Name", className: "text-left" },
  { key: "size", label: "Size", className: "w-20 text-right" },
  { key: "modified", label: "Modified", className: "w-32 text-right" },
];

interface FileTableProps {
  side: SftpSide;
  /** Accessible name of the grid, e.g. "Remote files". */
  label: string;
  entries: SftpEntry[];
  selected: ReadonlySet<string>;
  onSelectionChange: (next: Set<string>) => void;
  /** Double-click or Enter on a folder. */
  onOpen: (entry: SftpEntry) => void;
  /** A context menu choice; `entry` is null for the empty area. */
  onAction: (action: FileAction, entry: SftpEntry | null) => void;
  onDragStart?: (event: DragEvent, entries: SftpEntry[]) => void;
  onDragEnd?: () => void;
  onDrop?: (event: DragEvent) => void;
}

function EntryIcon({ entry }: { entry: SftpEntry }) {
  if (entry.isSymlink) return <Icon name="symlink" size="sm" aria-hidden className="shrink-0 text-fg-muted" />;
  if (entry.isDir) return <Icon name="folder" size="sm" aria-hidden className="shrink-0 text-fg-secondary" />;
  return <Icon name="file" size="sm" aria-hidden className="shrink-0 text-fg-muted" />;
}

/**
 * Dense, sortable file list for one side of the SFTP browser. Click selects,
 * Cmd/Ctrl+click toggles, Shift+click adds a range. Keyboard: Up/Down move
 * (Shift extends), Home/End jump, Space toggles, Enter opens a folder. Right-
 * click a row (or the empty area) for its actions.
 */
export default function FileTable({
  side,
  label,
  entries,
  selected,
  onSelectionChange,
  onOpen,
  onAction,
  onDragStart,
  onDragEnd,
  onDrop,
}: FileTableProps) {
  const [sort, setSort] = useState<SortState>({ key: "name", dir: "asc" });
  const [cursor, setCursor] = useState(0);
  const [anchor, setAnchor] = useState(-1);
  const [menuEntry, setMenuEntry] = useState<SftpEntry | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  const sorted = useMemo(() => sortEntries(entries, sort), [entries, sort]);
  const paths = useMemo(() => sorted.map((e) => e.path), [sorted]);
  const focusIndex = Math.min(cursor, Math.max(sorted.length - 1, 0));

  const select = (index: number, mods: { toggle: boolean; range: boolean }) => {
    const result = applySelection(selected, paths, index, anchor, mods);
    setAnchor(result.anchor);
    setCursor(index);
    onSelectionChange(result.selected);
  };

  const handleRowClick = (event: MouseEvent, index: number) => {
    select(index, { toggle: isMac ? event.metaKey : event.ctrlKey, range: event.shiftKey });
  };

  const moveTo = (index: number, extend: boolean) => {
    if (sorted.length === 0) return;
    const next = Math.max(0, Math.min(sorted.length - 1, index));
    select(next, { toggle: false, range: extend });
    rowRefs.current[next]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTableSectionElement>) => {
    const entry = sorted[focusIndex];
    switch (event.key) {
      case "ArrowDown":
        moveTo(focusIndex + 1, event.shiftKey);
        break;
      case "ArrowUp":
        moveTo(focusIndex - 1, event.shiftKey);
        break;
      case "Home":
        moveTo(0, event.shiftKey);
        break;
      case "End":
        moveTo(sorted.length - 1, event.shiftKey);
        break;
      case " ":
        if (entry) select(focusIndex, { toggle: true, range: false });
        break;
      case "Enter":
        if (entry?.isDir) onOpen(entry);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  // Which entry the context menu is for: the row under the pointer, or none.
  const handleContextMenu = (event: MouseEvent) => {
    const row = (event.target as Element).closest<HTMLElement>("tr[data-path]");
    setMenuEntry(row ? (sorted.find((e) => e.path === row.dataset.path) ?? null) : null);
  };

  const menuItems = fileMenuItems(side, menuEntry);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "min-h-0 flex-1 overflow-auto",
            dragOver && "outline-dashed outline-1 -outline-offset-2 outline-accent"
          )}
          onContextMenu={handleContextMenu}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            onDrop?.(event);
          }}
        >
          <table role="grid" aria-label={label} aria-multiselectable="true" className="w-full table-fixed border-collapse text-label">
            <thead>
              <tr>
                {COLUMNS.map((col) => {
                  const active = sort.key === col.key;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                      className={cn(
                        "sticky top-0 z-[1] h-6 border-b border-border bg-panel px-2 font-medium text-fg-muted",
                        col.className
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setSort((prev) => nextSort(prev, col.key))}
                        className={cn("inline-flex items-center gap-1 rounded-sm hover:text-fg", focusRing)}
                      >
                        {col.label}
                        {active &&
                          (sort.dir === "asc" ? (
                            <Icon name="sortAscending" size={12} aria-hidden />
                          ) : (
                            <Icon name="sortDescending" size={12} aria-hidden />
                          ))}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody onKeyDown={handleKeyDown}>
              {sorted.map((entry, index) => {
                const isSelected = selected.has(entry.path);
                return (
                  <tr
                    key={entry.path}
                    ref={(node) => {
                      rowRefs.current[index] = node;
                    }}
                    data-path={entry.path}
                    tabIndex={index === focusIndex ? 0 : -1}
                    aria-selected={isSelected}
                    draggable
                    onClick={(event) => handleRowClick(event, index)}
                    onDoubleClick={() => entry.isDir && onOpen(entry)}
                    onFocus={() => setCursor(index)}
                    onDragStart={(event) => {
                      const chosen = sorted.filter((e) => selected.has(e.path));
                      onDragStart?.(event, isSelected && chosen.length > 0 ? chosen : [entry]);
                    }}
                    onDragEnd={() => onDragEnd?.()}
                    className={cn(
                      "h-row cursor-default select-none outline-none transition-colors duration-150 ease-out",
                      "focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
                      isSelected ? "bg-accent-subtle text-fg" : "text-fg-secondary hover:bg-hover"
                    )}
                  >
                    <td className="px-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <EntryIcon entry={entry} />
                        <span className="truncate">{entry.name}</span>
                      </span>
                    </td>
                    <td className="px-2 text-right font-mono tabular-nums text-fg-muted">
                      {entry.isDir ? "--" : formatSize(entry.size)}
                    </td>
                    <td className="px-2 text-right tabular-nums text-fg-muted">{formatDate(entry.modified)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sorted.length === 0 && <EmptyState title="Empty folder" />}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {menuItems.map((item, i) => {
          if (item === "separator") return <ContextMenuSeparator key={`sep-${i}`} />;
          const ActionIcon = ACTION_ICONS[item.action];
          return (
            <ContextMenuItem
              key={item.action}
              danger={item.danger}
              icon={<ActionIcon {...ICON_SM} />}
              onSelect={() => onAction(item.action, menuEntry)}
            >
              {item.label}
            </ContextMenuItem>
          );
        })}
      </ContextMenuContent>
    </ContextMenu>
  );
}
