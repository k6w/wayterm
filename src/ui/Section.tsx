import { useId, type ComponentPropsWithRef, type ReactNode } from "react";
import { cn } from "./utils";

export interface SectionProps extends Omit<ComponentPropsWithRef<"section">, "title"> {
  title: ReactNode;
  description?: ReactNode;
  /** Small controls aligned right of the heading (IconButtons, a Button). */
  actions?: ReactNode;
}

/** Titled group inside a panel. Exposed to assistive tech as a region named by its title. */
export function Section({ title, description, actions, className, children, ...rest }: SectionProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cn("flex flex-col gap-3", className)} {...rest}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={headingId} className="text-caption font-semibold uppercase tracking-wide text-fg-muted">
            {title}
          </h3>
          {description && <p className="mt-0.5 text-label text-fg-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </header>
      {children}
    </section>
  );
}
