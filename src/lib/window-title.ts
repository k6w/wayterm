import type { TerminalTab } from "../types/terminal";

/** "zsh — Wayterm" for the active tab, "Wayterm" with no tabs. */
export function windowTitleFor(tabs: readonly TerminalTab[], activeTabId: string | null): string {
  const tab = tabs.find((t) => t.id === activeTabId);
  return tab ? `${tab.title} — Wayterm` : "Wayterm";
}

/**
 * Returns a setter that forwards only real title changes to `apply`. The
 * terminal store changes constantly (cwd, focus, bells); every native title
 * change makes macOS lay out the title bar again, so redundant ones are
 * dropped. A failed apply is retried on the next call.
 */
export function createTitleSync(apply: (title: string) => Promise<void>): (title: string) => void {
  let last: string | null = null;
  return (title) => {
    if (title === last) return;
    last = title;
    apply(title).catch(() => {
      if (last === title) last = null;
    });
  };
}
