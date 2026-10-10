/** localStorage keys renamed with the app (Nexterm to Wayterm), as new key to old key. */
export const RENAMED_STORAGE_KEYS: Readonly<Record<string, string>> = {
  "wayterm-welcomed": "nexterm-welcomed",
  "wayterm.palette.recents": "nexterm.palette.recents",
};

/** Copies each old value to its new key when the new key is unset. Old keys are left in place. */
export function migrateLegacyStorage(storage: Storage = localStorage): void {
  try {
    for (const [key, legacyKey] of Object.entries(RENAMED_STORAGE_KEYS)) {
      if (storage.getItem(key) !== null) continue;
      const value = storage.getItem(legacyKey);
      if (value !== null) storage.setItem(key, value);
    }
  } catch {
    // Storage can be unavailable (private mode, blocked site data); nothing to migrate then.
  }
}
