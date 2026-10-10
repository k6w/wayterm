const KEY = "wayterm.palette.recents";
export const MAX_RECENTS = 5;

// Used when localStorage is unavailable (private windows, blocked site data).
let memory: string[] = [];

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return memory;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((id): id is string => typeof id === "string").slice(0, MAX_RECENTS);
  } catch {
    // fall through to the in-memory copy
  }
  return memory;
}

/** Ids of the most recently run palette commands, newest first (at most five). */
export function getRecents(): string[] {
  return read();
}

/** Moves `id` to the front of the recents list and persists it. */
export function recordRecent(id: string): void {
  memory = [id, ...read().filter((existing) => existing !== id)].slice(0, MAX_RECENTS);
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // memory copy is enough
  }
}

/** Test helper: forget everything. */
export function clearRecents(): void {
  memory = [];
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
