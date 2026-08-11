import type { SftpEntry, Transfer } from "../../types/sftp";

export type SftpSide = "local" | "remote";
export type SortKey = "name" | "size" | "modified";
export interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

/** Folders first, then by the chosen column; ties fall back to the name, A-Z. Never mutates `entries`. */
export function sortEntries(entries: readonly SftpEntry[], sort: SortState): SftpEntry[] {
  const byName = (a: SftpEntry, b: SftpEntry) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  const modified = (e: SftpEntry) => {
    const n = Number(e.modified);
    return e.modified === null || Number.isNaN(n) ? Number.NEGATIVE_INFINITY : n;
  };
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...entries].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    if (sort.key === "name") return byName(a, b) * sign;
    const diff = sort.key === "size" ? a.size - b.size : modified(a) - modified(b);
    return diff !== 0 ? diff * sign : byName(a, b);
  });
}

/** Clicking the sorted column flips its direction; another column starts ascending. */
export function nextSort(sort: SortState, key: SortKey): SortState {
  return sort.key === key ? { key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" };
}

export interface ClickModifiers {
  /** Cmd (macOS) / Ctrl: toggle one entry. */
  toggle: boolean;
  /** Shift: add the range from the anchor. */
  range: boolean;
}

/**
 * Selection after a click (or a keyboard move) on `paths[index]`: a plain
 * click selects only that entry, toggle adds or removes it, range adds every
 * entry between the anchor and it. Returns the new selection and anchor.
 */
export function applySelection(
  selected: ReadonlySet<string>,
  paths: readonly string[],
  index: number,
  anchor: number,
  mods: ClickModifiers
): { selected: Set<string>; anchor: number } {
  const path = paths[index];
  if (mods.range && anchor >= 0 && anchor < paths.length) {
    const next = new Set(selected);
    for (let i = Math.min(anchor, index); i <= Math.max(anchor, index); i++) next.add(paths[i]);
    return { selected: next, anchor };
  }
  if (mods.toggle) {
    const next = new Set(selected);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    return { selected: next, anchor: index };
  }
  return { selected: new Set([path]), anchor: index };
}

export type FileAction = "open" | "download" | "upload" | "rename" | "delete" | "copy_path" | "new_folder" | "refresh";
export type FileMenuItem = { action: FileAction; label: string; danger?: boolean } | "separator";

/**
 * Context menu for a right-clicked entry (or the empty area when `entry` is
 * null). Remote entries download, local ones upload; only remote entries can
 * be renamed or deleted, and only the remote side gets "New folder".
 */
export function fileMenuItems(side: SftpSide, entry: SftpEntry | null): FileMenuItem[] {
  if (!entry) {
    return side === "remote"
      ? [{ action: "new_folder", label: "New folder" }, { action: "refresh", label: "Refresh" }]
      : [{ action: "refresh", label: "Refresh" }];
  }
  const open: FileMenuItem[] = entry.isDir ? [{ action: "open", label: "Open" }] : [];
  if (side === "remote") {
    return [
      ...open,
      { action: "download", label: "Download" },
      "separator",
      { action: "rename", label: "Rename" },
      { action: "delete", label: "Delete", danger: true },
      "separator",
      { action: "copy_path", label: "Copy path" },
    ];
  }
  return [...open, { action: "upload", label: "Upload" }, "separator", { action: "copy_path", label: "Copy path" }];
}

/** "0 B", "1.5 KB", "12 MB". */
export function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

/** "Mar 4 09:15" this year, "Mar 4, 2024" otherwise, "--" when unknown. `timestamp` is Unix seconds as text. */
export function formatDate(timestamp: string | null, now: Date = new Date()): string {
  if (!timestamp) return "--";
  const num = Number(timestamp);
  if (Number.isNaN(num)) return "--";
  const d = new Date(num * 1000);
  const month = d.toLocaleString("en", { month: "short" });
  if (d.getFullYear() === now.getFullYear()) {
    return `${month} ${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return `${month} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Percent done; completed transfers are always 100. */
export function transferPercent(t: Pick<Transfer, "status" | "bytesTransferred" | "totalBytes">): number {
  if (t.status === "completed") return 100;
  return t.totalBytes > 0 ? Math.round((t.bytesTransferred / t.totalBytes) * 100) : 0;
}

export const TRANSFER_TONE = {
  queued: "neutral",
  in_progress: "info",
  completed: "success",
  error: "danger",
} as const satisfies Record<Transfer["status"], "neutral" | "info" | "success" | "danger">;

export function transferStatusLabel(t: Pick<Transfer, "status" | "bytesTransferred" | "totalBytes">): string {
  if (t.status === "error") return "Failed";
  if (t.status === "completed") return "Done";
  if (t.status === "queued") return "Queued";
  return `${transferPercent(t)}%`;
}
