import type { ComponentPropsWithRef } from "react";
import { formatShortcut, shortcutLabel } from "./shortcut";
import { cn } from "./utils";

export interface KbdProps extends Omit<ComponentPropsWithRef<"kbd">, "children"> {
  /** Keybindings-format shortcut, e.g. "Meta+Shift+p". */
  shortcut: string;
  /** Force the macOS (true) or Windows/Linux (false) glyphs. Defaults to the host platform. */
  mac?: boolean;
}

/** Keyboard shortcut hint chip. */
export function Kbd({ shortcut, mac, className, ...rest }: KbdProps) {
  const parts = formatShortcut(shortcut, mac);
  return (
    <kbd
      aria-label={shortcutLabel(shortcut, mac)}
      className={cn("inline-flex items-center gap-0.5 font-sans text-caption text-kbd-fg", className)}
      {...rest}
    >
      {parts.map((part, i) => (
        <span
          key={i}
          aria-hidden
          className="inline-flex h-4 min-w-4 items-center justify-center rounded-sm border border-border bg-kbd px-1 leading-none"
        >
          {part}
        </span>
      ))}
    </kbd>
  );
}
