import type { Terminal } from "@xterm/xterm";
import type { BlockTracker } from "./block-tracker";
import { getCachedTerminal } from "../terminal-registry";
import { useTerminalStore } from "../../stores/terminal";
import { useSettingsStore } from "../../stores/settings";
import { copyBlocks } from "./block-actions";

interface ActiveBlocks {
  paneId: string;
  term: Terminal;
  tracker: BlockTracker;
}

/** The focused pane's command blocks, when the feature is on and its shell reports them. */
export function activeBlocks(): ActiveBlocks | null {
  if (!useSettingsStore.getState().settings.terminal.commandBlocks) return null;
  const paneId = useTerminalStore.getState().activePaneId;
  const cached = paneId ? getCachedTerminal(paneId) : undefined;
  if (!paneId || !cached?.blocks?.active) return null;
  return { paneId, term: cached.terminal, tracker: cached.blocks };
}

/**
 * Block keys apply only in a pane whose shell reports blocks, on its normal screen (never in
 * vim, less or tmux on the alternate screen), while the terminal itself has focus.
 */
export function blocksWhen(): boolean {
  const ctx = activeBlocks();
  if (!ctx || ctx.term.buffer.active.type !== "normal") return false;
  const focused = document.activeElement;
  return !!focused && !!ctx.term.element?.contains(focused);
}

export function hasBlockSelection(): boolean {
  return (activeBlocks()?.tracker.selection.length ?? 0) > 0;
}

/** Selects the previous (-1) or next (1) block, or extends the selection, and scrolls to it. */
export function jumpToBlock(direction: -1 | 1, extend = false): void {
  const ctx = activeBlocks();
  const block = ctx?.tracker.moveSelection(direction, extend);
  if (!ctx || !block) return;
  const line = block.promptStart.line;
  const buf = ctx.term.buffer.active;
  if (line < buf.viewportY || line >= buf.viewportY + ctx.term.rows) ctx.term.scrollToLine(line);
}

/** Copies the output of the selected blocks (when no text is selected). */
export function copySelectedBlockOutput(): void {
  const ctx = activeBlocks();
  if (ctx) copyBlocks(ctx.paneId, "output");
}

export function clearBlockSelection(): void {
  activeBlocks()?.tracker.clearSelection();
}
