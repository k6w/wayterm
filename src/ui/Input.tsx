import type { ComponentPropsWithRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, focusRing, CODE_TEXT_ATTRS } from "./utils";

export const inputVariants = cva(
  cn(
    "w-full min-w-0 text-fg placeholder:text-fg-muted transition-colors duration-150 ease-out",
    "disabled:cursor-not-allowed disabled:opacity-50"
  ),
  {
    variants: {
      variant: {
        default:
          cn(
            "rounded-md border border-input-border bg-input px-2 hover:border-border-strong aria-[invalid=true]:border-danger",
            focusRing
          ),
        bare: cn("rounded-sm border-0 bg-transparent px-0", focusRing),
        /** Borderless, no ring: the caret is the only focus cue (command palette, where the surface itself is focused). */
        plain: "rounded-sm border-0 bg-transparent px-0 outline-none",
      },
      size: {
        sm: "h-6 text-label",
        md: "h-control text-body",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  }
);

export interface InputProps
  extends Omit<ComponentPropsWithRef<"input">, "size">,
    VariantProps<typeof inputVariants> {
  /** Marks the field invalid (aria-invalid + danger border). */
  invalid?: boolean;
  /** Code, command, path or host text: mono font, and no spell check, autocorrect, smart punctuation or autocapitalize. */
  code?: boolean;
  /** Like `code` without the mono font: search boxes and filters that must not be autocompleted or autocorrected. */
  plainText?: boolean;
}

/** Single-line text field. Label it with <label htmlFor> or aria-label. */
export function Input({ variant, size, invalid, code, plainText, className, ...rest }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      {...(code || plainText ? CODE_TEXT_ATTRS : undefined)}
      className={cn(inputVariants({ variant, size }), code && "font-mono", className)}
      {...rest}
    />
  );
}
