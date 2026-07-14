import type { ReactNode } from "react";

interface SettingsSectionProps {
  title: string;
  description?: string;
  /** Right-aligned action (button) rendered next to the title. */
  action?: ReactNode;
  /** Wrap children in a bordered, row-divided card (default). Set false for
   *  grids/lists that manage their own layout. */
  card?: boolean;
  children: ReactNode;
  className?: string;
}

/** Titled group of settings. In card mode, children are expected to be
 *  <SettingRow>s and get dividers between them. */
export function SettingsSection({
  title,
  description,
  action,
  card = true,
  children,
  className = "",
}: SettingsSectionProps) {
  return (
    <section className={`space-y-3 ${className}`}>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-text-muted">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {card ? (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {children}
        </div>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </section>
  );
}
