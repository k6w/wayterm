import type { SshConnection } from "../../types/ssh";

/** One visible row of the connections tree, in display order. */
export type TreeRow =
  | { kind: "folder"; id: string; folder: string; expanded: boolean; connections: SshConnection[] }
  | { kind: "connection"; id: string; conn: SshConnection; folder: string | null };

/** A connection's folder, or null for "/" and blank folder paths (shown at the top level). */
export function folderOf(conn: SshConnection): string | null {
  const folder = conn.folderPath?.trim() ?? "";
  return folder && folder !== "/" ? folder : null;
}

export const folderRowId = (folder: string) => `folder:${folder}`;
export const connectionRowId = (id: string) => `conn:${id}`;

/**
 * Folders first (in the order their first connection sorts), each followed by
 * its connections unless collapsed, then the connections without a folder.
 * Connections keep their sortOrder.
 */
export function buildTreeRows(connections: readonly SshConnection[], collapsed: ReadonlySet<string>): TreeRow[] {
  const folders = new Map<string, SshConnection[]>();
  const loose: SshConnection[] = [];
  for (const conn of [...connections].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const folder = folderOf(conn);
    if (folder === null) {
      loose.push(conn);
      continue;
    }
    const list = folders.get(folder) ?? [];
    list.push(conn);
    folders.set(folder, list);
  }
  const rows: TreeRow[] = [];
  for (const [folder, conns] of folders) {
    const expanded = !collapsed.has(folder);
    rows.push({ kind: "folder", id: folderRowId(folder), folder, expanded, connections: conns });
    if (expanded) {
      for (const conn of conns) rows.push({ kind: "connection", id: connectionRowId(conn.id), conn, folder });
    }
  }
  for (const conn of loose) rows.push({ kind: "connection", id: connectionRowId(conn.id), conn, folder: null });
  return rows;
}

/** What a key press on the focused row does: move focus, and/or expand or collapse a folder. */
export interface TreeKeyResult {
  focus?: string;
  toggleFolder?: string;
}

/**
 * Tree keyboard model (WAI-ARIA tree view): Up/Down move, Home/End jump,
 * Right expands a folder or steps into it, Left collapses a folder or steps
 * out to the parent folder. Returns null for keys the tree does not handle.
 */
export function treeKeyAction(rows: readonly TreeRow[], currentId: string, key: string): TreeKeyResult | null {
  const index = rows.findIndex((row) => row.id === currentId);
  if (index === -1 || rows.length === 0) return null;
  const row = rows[index];
  switch (key) {
    case "ArrowDown":
      return { focus: rows[Math.min(index + 1, rows.length - 1)].id };
    case "ArrowUp":
      return { focus: rows[Math.max(index - 1, 0)].id };
    case "Home":
      return { focus: rows[0].id };
    case "End":
      return { focus: rows[rows.length - 1].id };
    case "ArrowRight":
      if (row.kind !== "folder") return {};
      if (!row.expanded) return { toggleFolder: row.folder };
      return { focus: rows[index + 1]?.kind === "connection" ? rows[index + 1].id : row.id };
    case "ArrowLeft":
      if (row.kind === "folder") return row.expanded ? { toggleFolder: row.folder } : {};
      return row.folder === null ? {} : { focus: folderRowId(row.folder) };
    default:
      return null;
  }
}
