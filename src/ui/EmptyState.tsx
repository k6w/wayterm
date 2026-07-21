import type { ReactNode } from "react";
import { cn } from "./utils";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Usually a Button. */
  action?: ReactNode;
  className?: string;
}

/** Placeholder for an empty list, panel or screen. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      {icon && (
        <div aria-hidden className="mb-1 text-fg-muted">
          {icon}
        </div>
      )}
      <p className="text-body font-medium text-fg">{title}</p>
      {description && <p className="max-w-80 text-label text-fg-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
