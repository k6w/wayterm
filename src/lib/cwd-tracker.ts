import { useTerminalStore } from "../stores/terminal";
import { terminalCwd } from "./ipc";
import { isShellIntegrationActive } from "./terminal-registry";

/**
 * Polls the backend for the active local pane's working directory (the PTY's
 * foreground process), so cwd tracking works in every shell instead of relying on
 * bash-only PROMPT_COMMAND title escapes. SSH panes are skipped: their local PTY
 * runs ssh, whose cwd is not the remote one (those keep using the title escape).
 * Panes whose shell integration is active report their cwd with OSC 7 instead.
 * Returns a stop function.
 */
export function startCwdTracking(intervalMs = 1000): () => void {
  let inFlight = false;
  const tick = async () => {
    if (inFlight) return;
    const { activePaneId, panes } = useTerminalStore.getState();
    const pane = activePaneId ? panes[activePaneId] : undefined;
    if (!pane || !pane.sessionId || pane.sshConnectionId) return;
    if (isShellIntegrationActive(pane.id)) return;
    inFlight = true;
    try {
      const cwd = await terminalCwd(pane.sessionId);
      if (cwd && useTerminalStore.getState().panes[pane.id]?.cwd !== cwd) {
        useTerminalStore.getState().updatePaneCwd(pane.id, cwd);
      }
    } catch {
      // session gone or backend unavailable: keep the last known cwd
    } finally {
      inFlight = false;
    }
  };
  const timer = setInterval(() => void tick(), intervalMs);
  return () => clearInterval(timer);
}
