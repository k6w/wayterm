import type { ComponentPropsWithRef, ReactNode } from "react";
import { Kbd } from "./Kbd";
import { cn, focusRing } from "./utils";

/** Left padding per tree level (8px base, then 16px per level). */
const INDENT = ["pl-2", "pl-6", "pl-10", "pl-14"] as const;

export interface ListRowProps extends Omit<ComponentPropsWithRef<"button">, "onSelect"> {
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  /** Right-aligned content (a Badge, a status dot). Must not be interactive. */
  trailing?: ReactNode;
  selected?: boolean;
  /** Keybindings-format shortcut rendered as a Kbd hint. */
  shortcut?: string;
  /** Called on click, Enter and Space. */
  onSelect?: () => void;
  /** Tree depth, 0 to 3. Each level indents the row by 16px. */
  indent?: 0 | 1 | 2 | 3;
  /**
   * Small IconButtons shown at the right edge while the row is hovered or
   * holds focus. They render next to the row's button, never inside it
   * (buttons cannot nest).
   */
  actions?: ReactNode;
}

/** One selectable row in a list (connections, files, snippets). */
export function ListRow({
  label,
  description,
  icon,
  trailing,
  selected = false,
  shortcut,
  onSelect,
  indent = 0,
  actions,
  onClick,
  className,
  type = "button",
  ...rest
}: ListRowProps) {
  const row = (
    <button
      type={type}
      aria-current={selected ? "true" : undefined}
      data-selected={selected || undefined}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onSelect?.();
      }}
      className={cn(
        "flex min-h-row w-full items-center gap-2 rounded-md py-1 pr-2 text-left transition-colors duration-150 ease-out",
        INDENT[indent],
        selected ? "bg-accent-subtle" : "hover:bg-hover",
        focusRing,
        className
      )}
      {...rest}
    >
      {icon && (
        <span aria-hidden className="inline-flex shrink-0 items-center gap-1.5 text-fg-muted">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body text-fg">{label}</span>
        {description && <span className="block truncate text-label text-fg-muted">{description}</span>}
      </span>
      {trailing}
      {shortcut && <Kbd shortcut={shortcut} />}
    </button>
  );
  if (!actions) return row;
  return (
    <div className="group/row relative">
      {row}
      <div
        data-row-actions
        className={cn(
          "pointer-events-none absolute inset-y-0 right-1 flex items-center gap-0.5 opacity-0",
          "transition-opacity duration-150 ease-out",
          "group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100",
          "group-hover/row:pointer-events-auto group-hover/row:opacity-100"
        )}
      >
        <div className="flex items-center gap-0.5 rounded-md bg-hover pl-1">{actions}</div>
      </div>
    </div>
  );
}
