import { useSettingsStore } from "../stores/settings";
import type { Block, BlockTracker } from "./blocks/block-tracker";
import { historyAdd } from "./ipc";

const TITLE = "Wayterm — Command finished";

function show(body: string) {
  new Notification(TITLE, { body, silent: true });
}

/**
 * Desktop notification for a command that ran at least the configured threshold.
 * `exitCode` is known only from the shell integration.
 */
export function notifyCommandFinished(seconds: number, exitCode?: number): void {
  const { general } = useSettingsStore.getState().settings;
  if (!general.notifyOnLongCommands || seconds < general.longCommandThresholdSeconds) return;
  if (typeof Notification === "undefined") return;
  const rounded = Math.round(seconds);
  const body =
    exitCode !== undefined && exitCode !== 0 ? `Failed (exit ${exitCode}) after ${rounded}s` : `Completed in ${rounded}s`;
  if (Notification.permission === "granted") {
    show(body);
  } else if (Notification.permission !== "denied") {
    void Notification.requestPermission().then((permission) => {
      if (permission === "granted") show(body);
    });
  }
}

/**
 * A block finished (OSC 133;D): notify with its exact duration and exit code, and record it in
 * the command history when command blocks are on and the command report was ours.
 */
export function onBlockFinished(tracker: BlockTracker, block: Block, sessionId: string): void {
  if (block.startedAt !== undefined && block.endedAt !== undefined) {
    notifyCommandFinished((block.endedAt - block.startedAt) / 1000, block.exitCode);
  }
  if (!block.trusted || !useSettingsStore.getState().settings.terminal.commandBlocks) return;
  const command = tracker.getCommandText(block).trim();
  if (!command) return;
  void historyAdd(sessionId, command, block.exitCode ?? null, block.cwd ?? null).catch(() => {});
}
