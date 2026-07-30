import { useId, type ReactNode } from "react";
import { cn } from "./utils";

/** Props a Field hands to its control. Spread them onto an Input, Textarea or Select. */
export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  invalid: boolean;
}

export interface FieldProps {
  label: ReactNode;
  /** Help text under the control. Hidden while an error shows. */
  hint?: ReactNode;
  /** Inline validation message. A non-empty string marks the control invalid. */
  error?: string | null;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/**
 * A labelled form control with optional help text and an inline error. The
 * label is tied to the control by id, and the hint or error is announced as its
 * description.
 */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error || hint;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-label font-medium text-fg-secondary">
        {label}
      </label>
      {children({ id, "aria-describedby": message ? messageId : undefined, invalid: Boolean(error) })}
      {message && (
        <p id={messageId} className={cn("text-label", error ? "text-danger" : "text-fg-muted")}>
          {message}
        </p>
      )}
    </div>
  );
}
