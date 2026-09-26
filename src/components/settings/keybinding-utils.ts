const MODIFIERS = ["Control", "Meta", "Alt", "Shift"] as const;
const MODIFIER_KEYS = new Set<string>(MODIFIERS);

type KeyEventLike = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">;

/**
 * The keybindings-format combo for a key press ("Control+Shift+p",
 * "Meta+Space"), in the order the recorder has always written them. Null for
 * a lone modifier press (wait for the real key).
 */
export function comboFromEvent(event: KeyEventLike): string | null {
  if (MODIFIER_KEYS.has(event.key)) return null;
  const parts: string[] = [];
  if (event.ctrlKey) parts.push("Control");
  if (event.metaKey) parts.push("Meta");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  let key = event.key;
  if (key === " ") key = "Space";
  if (key.length === 1) key = key.toLowerCase();
  parts.push(key);
  return parts.join("+");
}

/**
 * One spelling per combo, so "Shift+Control+P" and "Control+Shift+p" compare
 * equal: modifiers in a fixed order, the key lower-cased.
 */
export function normalizeCombo(keys: string): string {
  const parts = keys.split("+").map((part) => part.trim()).filter(Boolean);
  const key = (parts.filter((part) => !MODIFIER_KEYS.has(part)).pop() ?? "").toLowerCase();
  const modifiers = MODIFIERS.filter((modifier) => parts.includes(modifier));
  return [...modifiers, key].join("+");
}

export interface BindingRow {
  id: string;
  label: string;
  keys: string;
  /** Shares its keys on purpose with this action (it only takes them in some contexts). */
  fallsThroughTo?: string;
}

/** For every action whose combo another action also uses: action id -> labels of the others. */
export function findConflicts(rows: readonly BindingRow[]): Map<string, string[]> {
  const byCombo = new Map<string, BindingRow[]>();
  for (const row of rows) {
    const combo = normalizeCombo(row.keys);
    byCombo.set(combo, [...(byCombo.get(combo) ?? []), row]);
  }
  const conflicts = new Map<string, string[]>();
  for (const group of byCombo.values()) {
    if (group.length < 2) continue;
    for (const row of group) {
      const others = group.filter(
        (other) => other.id !== row.id && other.fallsThroughTo !== row.id && row.fallsThroughTo !== other.id
      );
      if (others.length > 0) conflicts.set(row.id, others.map((other) => other.label));
    }
  }
  return conflicts;
}
