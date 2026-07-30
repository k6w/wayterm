import type { ComponentPropsWithRef } from "react";
import { cn, focusRing } from "./utils";

export interface TextareaProps extends ComponentPropsWithRef<"textarea"> {
  /** Marks the field invalid (aria-invalid + danger border). */
  invalid?: boolean;
}

/** Multi-line text field, styled like Input. Label it with <label htmlFor> or aria-label. */
export function Textarea({ invalid, className, rows = 3, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        "w-full min-w-0 resize-none rounded-md border border-input-border bg-input px-2 py-1.5 text-body text-fg",
        "placeholder:text-fg-muted transition-colors duration-150 ease-out hover:border-border-strong",
        "aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:opacity-50",
        focusRing,
        className
      )}
      {...rest}
    />
  );
}
