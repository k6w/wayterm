import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import type { WebglAddon } from "@xterm/addon-webgl";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { bufferSaveBatch } from "./ipc";

export interface CachedTerminal {
  terminal: Terminal;
  fitAddon: FitAddon;
  /** The div xterm opened into — portable across containers */
  element: HTMLDivElement;
  sessionId: string;
  unlistenOutput: UnlistenFn | null;
  unlistenExit: UnlistenFn | null;
  /** Stored so we can dispose/reload when toggling vibrancy */
  webglAddon: WebglAddon | null;
}

const cache = new Map<string, CachedTerminal>();

export function setCachedTerminal(paneId: string, entry: CachedTerminal) {
  cache.set(paneId, entry);
}

export function getCachedTerminal(paneId: string): CachedTerminal | undefined {
  return cache.get(paneId);
}

export function removeCachedTerminal(paneId: string) {
  cache.delete(paneId);
}

// ── convenience helpers used by context menus / status bar ──

export function getTerminal(paneId: string): Terminal | undefined {
  return cache.get(paneId)?.terminal;
}

export function copySelection(paneId: string): boolean {
  const term = cache.get(paneId)?.terminal;
  if (!term) return false;
  const sel = term.getSelection();
  if (!sel) return false;
  navigator.clipboard.writeText(sel);
  return true;
}

export async function pasteToTerminal(paneId: string): Promise<boolean> {
  const term = cache.get(paneId)?.terminal;
  if (!term) return false;
  try {
    const text = await navigator.clipboard.readText();
    if (text) term.paste(text);
    return true;
  } catch {
    return false;
  }
}

export function selectAll(paneId: string) {
  cache.get(paneId)?.terminal.selectAll();
}

export function clearBuffer(paneId: string) {
  cache.get(paneId)?.terminal.clear();
  // Wipe persisted buffer so restore starts fresh
  bufferSaveBatch([{ paneId, bufferData: "" }]).catch(() => {});
}

export function resetTerminal(paneId: string) {
  cache.get(paneId)?.terminal.reset();
  bufferSaveBatch([{ paneId, bufferData: "" }]).catch(() => {});
}

export function hasSelection(paneId: string): boolean {
  return !!cache.get(paneId)?.terminal.hasSelection();
}
