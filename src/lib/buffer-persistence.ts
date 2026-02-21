import { SerializeAddon } from "@xterm/addon-serialize";
import type { Terminal } from "@xterm/xterm";
import { bufferSaveBatch, bufferCleanup } from "./ipc";
import { getCachedTerminal } from "./terminal-registry";

/** 2 MB cap per buffer to avoid bloating the database */
const MAX_BUFFER_BYTES = 2 * 1024 * 1024;

const addons = new Map<string, SerializeAddon>();
let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

export function attachSerializeAddon(paneId: string, terminal: Terminal) {
  if (addons.has(paneId)) return;
  const addon = new SerializeAddon();
  terminal.loadAddon(addon);
  addons.set(paneId, addon);
}

export function detachSerializeAddon(paneId: string) {
  const addon = addons.get(paneId);
  if (addon) {
    addon.dispose();
    addons.delete(paneId);
  }
}

export async function saveAllBuffers(): Promise<void> {
  const entries: { paneId: string; bufferData: string }[] = [];

  for (const [paneId, addon] of addons) {
    // Only serialize if the terminal is still alive
    const cached = getCachedTerminal(paneId);
    if (!cached) continue;

    try {
      const data = addon.serialize();
      if (data && data.length <= MAX_BUFFER_BYTES) {
        entries.push({ paneId, bufferData: data });
      }
    } catch {
      // terminal may be disposed
    }
  }

  if (entries.length > 0) {
    await bufferSaveBatch(entries).catch(() => {});
  }
}

export function startBufferAutoSave() {
  // Run cleanup of old buffers on startup
  bufferCleanup().catch(() => {});

  if (autoSaveTimer) return;
  autoSaveTimer = setInterval(() => {
    saveAllBuffers();
  }, 30_000);
}

export function stopBufferAutoSave() {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }
}
