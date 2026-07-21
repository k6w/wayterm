import type { ComponentPropsWithRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, focusRing } from "./utils";

export const inputVariants = cva(
  cn(
    "w-full min-w-0 text-fg placeholder:text-fg-muted transition-colors duration-150 ease-out",
    "disabled:cursor-not-allowed disabled:opacity-50",
    focusRing
  ),
  {
    variants: {
      variant: {
        default:
          "rounded-md border border-input-border bg-input px-2 hover:border-border-strong aria-[invalid=true]:border-danger",
        bare: "rounded-sm border-0 bg-transparent px-0",
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
}

/** Single-line text field. Label it with <label htmlFor> or aria-label. */
export function Input({ variant, size, invalid, className, ...rest }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(inputVariants({ variant, size }), className)}
      {...rest}
    />
  );
}
