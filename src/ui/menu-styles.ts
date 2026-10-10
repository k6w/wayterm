// Shared by Menu, ContextMenu and Select so every list surface looks the same.

/** Surface styles without a min-width, for lists that size themselves (Select matches its trigger). */
export const menuSurfaceClass =
  "z-[var(--z-dropdown)] overflow-hidden rounded-lg border border-border bg-raised-glass wt-blur p-1 shadow-popover outline-none animate-wt-fade-in";

export const menuContentClass = `${menuSurfaceClass} min-w-44`;

export const menuItemClass =
  "relative flex h-row w-full cursor-default select-none items-center gap-2 rounded-sm px-2 text-label text-fg outline-none data-[highlighted]:bg-hover data-[disabled]:pointer-events-none data-[disabled]:text-fg-disabled";

export const menuSeparatorClass = "-mx-1 my-1 h-px bg-border";

export const menuLabelClass = "px-2 py-1 text-caption font-medium uppercase tracking-wide text-fg-muted";
