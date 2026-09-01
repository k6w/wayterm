import type { ComponentPropsWithRef, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Kbd } from "./Kbd";
import { Spinner } from "./Spinner";
import { cn, focusRing } from "./utils";

export const buttonVariants = cva(
  cn(
    "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-md font-medium",
    "transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-50",
    focusRing
  ),
  {
    variants: {
      variant: {
        primary: "bg-accent text-fg-on-accent hover:bg-accent-hover active:bg-accent-active",
        secondary: "border border-border-strong bg-raised text-fg hover:bg-hover active:bg-active",
        ghost: "text-fg-secondary hover:bg-hover hover:text-fg active:bg-active",
        /** Filled red: the confirm button of a destructive dialog. */
        destructive: "bg-danger text-fg-on-accent hover:opacity-90 active:opacity-80",
        danger: "text-danger hover:bg-danger-subtle active:bg-danger-subtle",
      },
      size: {
        xs: "h-5 gap-1 px-1.5 text-caption",
        sm: "h-6 gap-1.5 px-2 text-label",
        md: "h-control gap-1.5 px-3 text-body",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  }
);

export interface ButtonProps extends ComponentPropsWithRef<"button">, VariantProps<typeof buttonVariants> {
  /** Keybindings-format shortcut rendered as a Kbd hint after the label. */
  shortcut?: string;
  leadingIcon?: ReactNode;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
}

/** Text button. Use IconButton for icon-only buttons. */
export function Button({
  variant,
  size,
  shortcut,
  leadingIcon,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...rest}
    >
      {loading ? (
        <Spinner size={14} label="Working" />
      ) : (
        leadingIcon && (
          <span aria-hidden className="inline-flex shrink-0">
            {leadingIcon}
          </span>
        )
      )}
      {children}
      {shortcut && <Kbd shortcut={shortcut} className="ml-1" />}
    </button>
  );
}
