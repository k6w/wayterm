import type { ClipboardEntry } from "../../types/clipboard";

/** Entries containing `query` (case-insensitive), starred ones first, otherwise newest first as stored. */
export function filterClipboard(entries: readonly ClipboardEntry[], query: string): ClipboardEntry[] {
  const needle = query.trim().toLowerCase();
  const matches = needle ? entries.filter((e) => e.content.toLowerCase().includes(needle)) : [...entries];
  return matches.sort((a, b) => Number(b.favorite) - Number(a.favorite));
}

/** One line for a list row: whitespace runs collapsed, cut at 100 characters. */
export function clipboardPreview(content: string): string {
  const line = content.replace(/\s+/g, " ").trim();
  return line.length > 100 ? `${line.slice(0, 100)}…` : line;
}
