import type { ComponentPropsWithRef } from "react";
import { cn, focusRing, CODE_TEXT_ATTRS } from "./utils";

export interface TextareaProps extends ComponentPropsWithRef<"textarea"> {
  /** Marks the field invalid (aria-invalid + danger border). */
  invalid?: boolean;
  /** Code, command, path or host text: mono font, and no spell check, autocorrect, smart punctuation or autocapitalize. */
  code?: boolean;
}

/** Multi-line text field, styled like Input. Label it with <label htmlFor> or aria-label. */
export function Textarea({ invalid, code, className, rows = 3, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      {...(code ? CODE_TEXT_ATTRS : undefined)}
      className={cn(
        "w-full min-w-0 resize-none rounded-md border border-input-border bg-input px-2 py-1.5 text-body text-fg",
        "placeholder:text-fg-muted transition-colors duration-150 ease-out hover:border-border-strong",
        "aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:opacity-50",
        focusRing,
        code && "font-mono",
        className
      )}
      {...rest}
    />
  );
}
