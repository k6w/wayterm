import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";

/** The container is laid out: a background tab is `display: none` and has no size. */
export function isLaidOut(container: HTMLElement): boolean {
  return container.isConnected && container.clientWidth > 0 && container.clientHeight > 0;
}

/**
 * Fits the terminal to its container; returns whether its rows or columns changed.
 * Skipped while the container is hidden: FitAddon would read the `100%` size of a
 * `display: none` element as 100px and shrink the terminal to about 10 columns.
 */
export function fitTerminal(term: Terminal, fit: FitAddon, container: HTMLElement): boolean {
  if (!isLaidOut(container)) return false;
  const { cols, rows } = term;
  fit.fit();
  return term.cols !== cols || term.rows !== rows;
}
