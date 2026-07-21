import type { ComponentPropsWithRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-sm font-medium leading-none",
  {
    variants: {
      tone: {
        neutral: "bg-hover text-fg-secondary",
        accent: "bg-accent-subtle text-accent-fg",
        solid: "bg-accent text-fg-on-accent",
        success: "bg-success-subtle text-success",
        warning: "bg-warning-subtle text-warning",
        danger: "bg-danger-subtle text-danger",
        info: "bg-info-subtle text-info",
      },
      size: {
        sm: "h-4 px-1 text-caption",
        md: "h-5 px-1.5 text-label",
      },
    },
    defaultVariants: { tone: "neutral", size: "sm" },
  }
);

export interface BadgeProps extends ComponentPropsWithRef<"span">, VariantProps<typeof badgeVariants> {}

/** Small status or count label. */
export function Badge({ tone, size, className, ...rest }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...rest} />;
}
