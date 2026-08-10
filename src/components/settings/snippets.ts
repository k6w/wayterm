import type { Snippet } from "../../types/settings";

export interface SnippetDraft {
  name: string;
  category: string;
  command: string;
}

export interface SnippetGroup {
  /** The category, or null for snippets without one. */
  category: string | null;
  snippets: Snippet[];
}

/** Categories A-Z, uncategorized last; snippets keep their saved order inside a group. */
export function groupSnippets(snippets: readonly Snippet[]): SnippetGroup[] {
  const byCategory = new Map<string | null, Snippet[]>();
  for (const snippet of snippets) {
    const category = snippet.category?.trim() || null;
    const list = byCategory.get(category) ?? [];
    list.push(snippet);
    byCategory.set(category, list);
  }
  return [...byCategory.entries()]
    .map(([category, list]) => ({ category, snippets: list }))
    .sort((a, b) => {
      if (a.category === null) return 1;
      if (b.category === null) return -1;
      return a.category.localeCompare(b.category);
    });
}

/** A draft can be saved once it has a name and a command. */
export function isDraftValid(draft: SnippetDraft): boolean {
  return draft.name.trim() !== "" && draft.command.trim() !== "";
}

/** Adds a new snippet (editingId null) or replaces the one being edited. Trims every field. */
export function saveSnippet(
  snippets: readonly Snippet[],
  draft: SnippetDraft,
  editingId: string | null,
  newId: () => string
): Snippet[] {
  const fields = {
    name: draft.name.trim(),
    command: draft.command.trim(),
    category: draft.category.trim() || undefined,
  };
  if (editingId === null) return [...snippets, { id: newId(), ...fields }];
  return snippets.map((s) => (s.id === editingId ? { ...s, ...fields } : s));
}

/**
 * Merges an imported JSON value into the list. Returns null when the file is
 * not an array. Entries without a string name and command are skipped, ids
 * that already exist are skipped, and entries without an id get a new one.
 */
export function mergeImportedSnippets(
  snippets: readonly Snippet[],
  imported: unknown,
  newId: () => string
): Snippet[] | null {
  if (!Array.isArray(imported)) return null;
  const existing = new Set(snippets.map((s) => s.id));
  const added: Snippet[] = [];
  for (const item of imported) {
    if (typeof item !== "object" || item === null) continue;
    const { id, name, command, category } = item as Record<string, unknown>;
    if (typeof name !== "string" || typeof command !== "string") continue;
    if (typeof id === "string" && existing.has(id)) continue;
    added.push({
      id: typeof id === "string" && id ? id : newId(),
      name,
      command,
      category: typeof category === "string" && category ? category : undefined,
    });
  }
  return [...snippets, ...added];
}
