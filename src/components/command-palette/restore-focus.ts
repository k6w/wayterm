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

/** Only text entry is worth returning to; a button that opened the palette is not. */
function isTextEntry(el: HTMLElement): boolean {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable;
}

/**
 * Where focus goes when the palette closes: the text entry (usually a terminal)
 * that had focus when it opened if it is still on the page, otherwise the
 * active terminal.
 */
export function restoreFocusAfterPalette(previous: Element | null): void {
  const usable =
    previous instanceof HTMLElement && previous.isConnected && isTextEntry(previous) ? previous : null;
  (usable ?? activeTerminalInput())?.focus();
}
