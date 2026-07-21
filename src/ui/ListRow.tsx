import type { ComponentPropsWithRef, ReactNode } from "react";
import { Kbd } from "./Kbd";
import { cn, focusRing } from "./utils";

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
  onClick,
  className,
  type = "button",
  ...rest
}: ListRowProps) {
  return (
    <button
      type={type}
      aria-current={selected ? "true" : undefined}
      data-selected={selected || undefined}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onSelect?.();
      }}
      className={cn(
        "flex min-h-row w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors duration-150 ease-out",
        selected ? "bg-accent-subtle" : "hover:bg-hover",
        focusRing,
        className
      )}
      {...rest}
    >
      {icon && (
        <span aria-hidden className="inline-flex shrink-0 text-fg-muted">
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
}
