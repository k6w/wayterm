import { useId, type ComponentPropsWithRef, type ReactNode } from "react";
import { Badge, Toolbar, cn } from "../../ui";

/**
 * Building blocks every side panel shares, under the frame header that
 * Sidebar.tsx renders (panel name + hide button): one action row, then a
 * scrolling body of ListRows. Panels never render their own title.
 */

/** The panel's action row. Wrap each IconButton or Button in a ToolbarButton. */
export function PanelToolbar({ className, ...rest }: ComponentPropsWithRef<typeof Toolbar>) {
  return <Toolbar className={cn("h-9 shrink-0 gap-1 border-b border-border px-2", className)} {...rest} />;
}

/** Scrolling panel body. An EmptyState inside it sits at the top, like in every other panel. */
export function PanelContent({ className, ...rest }: ComponentPropsWithRef<"div">) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto p-1", className)} {...rest} />;
}

export interface PanelGroupProps {
  title: string;
  /** Shown as a neutral Badge after the title. */
  count?: number;
  /** Small controls at the right of the heading (an IconButton, a Button size="xs"). */
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** A titled group of rows inside a panel (Staged / Changes, one host's forwards, Workspaces). */
export function PanelGroup({ title, count, actions, className, children }: PanelGroupProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cn("flex flex-col", className)}>
      <header className="flex h-7 shrink-0 items-center gap-2 pl-2 pr-1">
        <h3
          id={headingId}
          className="min-w-0 truncate text-caption font-medium uppercase tracking-wide text-fg-muted"
        >
          {title}
        </h3>
        {count !== undefined && <Badge>{count}</Badge>}
        <span aria-hidden className="flex-1" />
        {actions}
      </header>
      {children}
    </section>
  );
}
