import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import type { WebglAddon } from "@xterm/addon-webgl";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { bufferSaveBatch } from "./ipc";
import { useClipboardStore } from "../stores/clipboard";
import type { BlockTracker } from "./blocks/block-tracker";

export interface CachedTerminal {
  terminal: Terminal;
  fitAddon: FitAddon;
  
  element: HTMLDivElement;
  sessionId: string;
  unlistenOutput: UnlistenFn | null;
  unlistenExit: UnlistenFn | null;
  
  webglAddon: WebglAddon | null;
  /** Command blocks from the shell integration; disposed with the terminal. */
  blocks: BlockTracker | null;
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



/** The pane's shell reports prompts and cwd itself (shell integration is active). */
export function isShellIntegrationActive(paneId: string): boolean {
  return cache.get(paneId)?.blocks?.active ?? false;
}

export function getTerminal(paneId: string): Terminal | undefined {
  return cache.get(paneId)?.terminal;
}

export function copySelection(paneId: string): boolean {
  const term = cache.get(paneId)?.terminal;
  if (!term) return false;
  const sel = term.getSelection();
  if (!sel) return false;
  navigator.clipboard.writeText(sel);
  useClipboardStore.getState().addEntry(sel, 'terminal');
  return true;
}

/**
 * Records the terminal selection in clipboard history whenever the webview
 * copies natively (Cmd+C on macOS and the Edit menu never reach copySelection).
 * copySelection writes through navigator.clipboard, which fires no copy event,
 * so one copy is never recorded twice. Returns a cleanup function.
 */
export function recordNativeCopies(terminal: Pick<Terminal, "getSelection">, element: HTMLElement): () => void {
  const onCopy = () => {
    const selection = terminal.getSelection();
    if (selection) useClipboardStore.getState().addEntry(selection, "terminal");
  };
  element.addEventListener("copy", onCopy);
  return () => element.removeEventListener("copy", onCopy);
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
  
  bufferSaveBatch([{ paneId, bufferData: "" }]).catch(() => {});
}

export function resetTerminal(paneId: string) {
  cache.get(paneId)?.terminal.reset();
  // reset() leaves the old markers behind; the blocks they mark are gone.
  cache.get(paneId)?.blocks?.reset();
  bufferSaveBatch([{ paneId, bufferData: "" }]).catch(() => {});
}

export function hasSelection(paneId: string): boolean {
  return !!cache.get(paneId)?.terminal.hasSelection();
}

export function writeToTerminal(paneId: string, text: string) {
  const entry = cache.get(paneId);
  if (entry?.terminal) {
    entry.terminal.paste(text);
  }
}
