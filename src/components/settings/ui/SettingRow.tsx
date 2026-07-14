import type { ReactNode } from "react";

interface SettingRowProps {
  label: string;
  description?: string;
  htmlFor?: string;
  /** The control, rendered right-aligned. */
  children: ReactNode;
  /** Stack the control below the label (for wide controls like textareas). */
  stacked?: boolean;
  className?: string;
}

/** One label(+description) / control row. Designed to sit inside a
 *  <SettingsSection> card with dividers. */
export function SettingRow({
  label,
  description,
  htmlFor,
  children,
  stacked = false,
  className = "",
}: SettingRowProps) {
  if (stacked) {
    return (
      <div className={`setting-row px-4 py-3 ${className}`}>
        <label htmlFor={htmlFor} className="block text-sm text-text-primary">
          {label}
        </label>
        {description && (
          <p className="mt-0.5 mb-2 text-xs text-text-muted">{description}</p>
        )}
        <div className={description ? "" : "mt-2"}>{children}</div>
      </div>
    );
  }
  return (
    <div className={`setting-row flex items-center justify-between gap-4 px-4 py-3 ${className}`}>
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="block text-sm text-text-primary">
          {label}
        </label>
        {description && (
          <p className="mt-0.5 text-xs text-text-muted">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
