import type { ReactNode } from "react";
import { useTerminalStore } from "../../stores/terminal";
import { cn } from "../../ui";

/**
 * Wraps the app layout that the full-window Settings covers. While Settings
 * is open the layout is visibility-hidden, not unmounted: terminals keep their
 * sessions, scrollback and size (no refit), but nothing of it paints through
 * the Settings glass, so only the desktop vibrancy shows behind it.
 */
export function BehindSettings({ children }: { children: ReactNode }) {
  const settingsOpen = useTerminalStore((s) => s.settingsOpen);
  return (
    <div data-behind-settings className={cn("h-full w-full", settingsOpen && "invisible")}>
      {children}
    </div>
  );
}
