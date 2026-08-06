import { useTerminalStore } from "../../stores/terminal";

/** xterm's hidden input; focusing it is how a terminal takes keyboard input. */
function activeTerminalInput(): HTMLElement | null {
  const paneId = useTerminalStore.getState().activePaneId;
  if (!paneId) return null;
  const pane = Array.from(document.querySelectorAll<HTMLElement>("[data-pane-id]")).find(
    (el) => el.dataset.paneId === paneId
  );
  return pane?.querySelector<HTMLElement>("textarea") ?? null;
}

/**
 * Where focus goes when the palette closes: the element that had focus when it
 * opened if it is still on the page, otherwise the active terminal.
 */
export function restoreFocusAfterPalette(previous: Element | null): void {
  const usable =
    previous instanceof HTMLElement && previous !== document.body && previous.isConnected ? previous : null;
  (usable ?? activeTerminalInput())?.focus();
}
