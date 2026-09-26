import type { Block, BlockTracker } from "./block-tracker";
import { getCachedTerminal } from "../terminal-registry";
import { terminalWrite } from "../ipc";
import { formatDuration } from "../format";
import { useClipboardStore } from "../../stores/clipboard";

export type BlockPart = "command" | "output" | "both";

export function blockText(tracker: BlockTracker, block: Block, part: BlockPart): string {
  const command = tracker.getCommandText(block);
  const output = tracker.getOutputText(block);
  if (part === "command") return command;
  if (part === "output") return output;
  return output ? `$ ${command}\n${output}` : `$ ${command}`;
}

/** `$ cmd`, the output, then `[exit n, 1.2s, cwd]`: a block as plain text for sharing. */
export function shareText(tracker: BlockTracker, block: Block): string {
  const facts: string[] = [];
  if (block.exitCode !== undefined) facts.push(`exit ${block.exitCode}`);
  if (block.startedAt !== undefined && block.endedAt !== undefined) facts.push(formatDuration(block.endedAt - block.startedAt));
  if (block.cwd) facts.push(block.cwd);
  const body = blockText(tracker, block, "both");
  return facts.length ? `${body}\n[${facts.join(", ")}]` : body;
}

/** Copies `text` and records it in the clipboard history. */
export function copyText(text: string): boolean {
  if (!text) return false;
  void navigator.clipboard.writeText(text).catch(() => {});
  useClipboardStore.getState().addEntry(text, "terminal");
  return true;
}

/** The shell sits at a prompt, so typed text reaches it and not a running program. */
export function canRerun(tracker: BlockTracker): boolean {
  const last = tracker.blocks[tracker.blocks.length - 1];
  return !!last && (last.state === "prompt" || last.state === "input");
}

/**
 * The bytes that put `command` at the prompt. Control characters are dropped (an ESC could end
 * a bracketed paste early). It runs (a trailing CR) only when `execute`; otherwise it is only
 * pasted, and without bracketed paste its line breaks become spaces so nothing runs early.
 */
export function rerunInput(command: string, { bracketed, execute }: { bracketed: boolean; execute: boolean }): string {
  let text = Array.from(command)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return ch === "\n" || ch === "\t" || (code >= 0x20 && code !== 0x7f && !(code >= 0x80 && code < 0xa0));
    })
    .join("");
  if (!bracketed && !execute) text = text.replace(/\n+/g, " ");
  if (bracketed) text = `\x1b[200~${text}\x1b[201~`;
  return execute ? `${text}\r` : text;
}

/** Selected blocks of a pane, else `fallback`. */
function targets(tracker: BlockTracker, fallback?: Block): Block[] {
  const selection = tracker.selection;
  if (selection.length > 0) return selection;
  return fallback ? [fallback] : [];
}

/** Copies part of the given block, or of every selected block. */
export function copyBlocks(paneId: string, part: BlockPart, block?: Block): boolean {
  const tracker = getCachedTerminal(paneId)?.blocks;
  if (!tracker) return false;
  const blocks = targets(tracker, block);
  return copyText(blocks.map((b) => blockText(tracker, b, part)).join("\n\n"));
}

export function shareBlock(paneId: string, block: Block): boolean {
  const tracker = getCachedTerminal(paneId)?.blocks;
  return tracker ? copyText(shareText(tracker, block)) : false;
}

/**
 * Types the block's command at the prompt again. It runs only when the command report was
 * ours (trusted); a command read from output that could have been faked is only pasted.
 */
export function rerunBlock(paneId: string, block: Block): boolean {
  const cached = getCachedTerminal(paneId);
  const tracker = cached?.blocks;
  if (!cached?.sessionId || !tracker || !canRerun(tracker)) return false;
  const command = tracker.getCommandText(block);
  if (!command) return false;
  const input = rerunInput(command, {
    bracketed: cached.terminal.modes.bracketedPasteMode,
    execute: block.trusted,
  });
  void terminalWrite(cached.sessionId, Array.from(new TextEncoder().encode(input))).catch(() => {});
  cached.terminal.scrollToBottom();
  cached.terminal.focus();
  return true;
}
