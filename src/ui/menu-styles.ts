// Shared by Menu, ContextMenu and Select so every list surface looks the same.

export const menuContentClass =
  "z-[var(--z-dropdown)] min-w-44 overflow-hidden rounded-lg border border-border bg-raised-glass nx-blur p-1 shadow-popover outline-none animate-nx-fade-in";

export const menuItemClass =
  "relative flex h-row w-full cursor-default select-none items-center gap-2 rounded-sm px-2 text-label text-fg outline-none data-[highlighted]:bg-hover data-[disabled]:pointer-events-none data-[disabled]:text-fg-disabled";

export const menuSeparatorClass = "-mx-1 my-1 h-px bg-border";

export const menuLabelClass = "px-2 py-1 text-caption font-medium uppercase tracking-wide text-fg-muted";
