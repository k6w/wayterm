import type { PaletteAction } from "./actions";

export interface PaletteGroup {
  category: string;
  actions: PaletteAction[];
}

/**
 * Case-insensitive substring match on the label or the category (the rule the
 * palette has always used). Order is kept; an empty query matches everything.
 */
export function filterActions(actions: readonly PaletteAction[], query: string): PaletteAction[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...actions];
  return actions.filter(
    (action) => action.label.toLowerCase().includes(needle) || action.category.toLowerCase().includes(needle)
  );
}

/**
 * Groups actions under their category. Groups appear in the order their first
 * action does; inside a group, actions keep their relative order.
 */
export function groupActions(actions: readonly PaletteAction[]): PaletteGroup[] {
  const groups = new Map<string, PaletteGroup>();
  for (const action of actions) {
    let group = groups.get(action.category);
    if (!group) {
      group = { category: action.category, actions: [] };
      groups.set(action.category, group);
    }
    group.actions.push(action);
  }
  return [...groups.values()];
}

/** The actions in the order the grouped list shows them; arrow keys walk this order. */
export function displayOrder(groups: readonly PaletteGroup[]): PaletteAction[] {
  return groups.flatMap((group) => group.actions);
}

/** Case-insensitive substring match on a theme name. */
export function filterThemes<T extends { name: string }>(themes: readonly T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...themes];
  return themes.filter((theme) => theme.name.toLowerCase().includes(needle));
}

/** Moves a selection by `delta`, wrapping at both ends. Returns 0 for an empty list. */
export function wrapIndex(index: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return (((index + delta) % length) + length) % length;
}

/** Half-open [start, end) character range inside a label. */
export type MatchRange = readonly [start: number, end: number];

/**
 * Where the query matched inside `text`: the same case-insensitive substring
 * rule the filters use, so every filtered title has its match highlighted.
 * Returns no ranges for a blank query or when only the category matched.
 */
export function matchRanges(text: string, query: string): MatchRange[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const start = text.toLowerCase().indexOf(needle);
  return start < 0 ? [] : [[start, start + needle.length]];
}
