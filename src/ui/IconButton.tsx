import type { ComponentPropsWithRef, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Tooltip, type TooltipProps } from "./Tooltip";
import { IconWeightProvider } from "./icons";
import { cn, focusRing } from "./utils";

export const iconButtonVariants = cva(
  cn(
    "inline-flex shrink-0 items-center justify-center rounded-md",
    "transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-50",
    focusRing
  ),
  {
    variants: {
      variant: {
        ghost: "",
        subtle: "bg-raised",
      },
      size: {
        xs: "size-5",
        sm: "size-6",
        md: "size-control",
      },
      pressed: {
        true: "bg-accent-subtle text-accent-fg",
        false: "text-fg-muted hover:bg-hover hover:text-fg active:bg-active",
      },
    },
    defaultVariants: { variant: "ghost", size: "sm", pressed: false },
  }
);

export interface IconButtonProps
  extends Omit<ComponentPropsWithRef<"button">, "children" | "aria-label">,
    Omit<VariantProps<typeof iconButtonVariants>, "pressed"> {
  /** Accessible name; also the tooltip text. */
  label: string;
  icon: ReactNode;
  /** Keybindings-format shortcut shown in the tooltip. */
  shortcut?: string;
  /** Makes this a toggle button (aria-pressed) and styles the on state. */
  pressed?: boolean;
  /** Set false to drop the tooltip (e.g. when a parent already labels it). */
  tooltip?: boolean;
  tooltipSide?: TooltipProps["side"];
}

/** Icon-only button with a tooltip showing its label and shortcut. */
export function IconButton({
  label,
  icon,
  shortcut,
  pressed,
  tooltip = true,
  tooltipSide,
  variant,
  size,
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <Tooltip content={tooltip ? label : null} shortcut={shortcut} side={tooltipSide}>
      <button
        type={type}
        aria-label={label}
        aria-pressed={pressed}
        className={cn(iconButtonVariants({ variant, size, pressed: pressed ?? false }), className)}
        {...rest}
      >
        <span aria-hidden className="inline-flex">
          <IconWeightProvider weight={pressed ? "fill" : "regular"}>{icon}</IconWeightProvider>
        </span>
      </button>
    </Tooltip>
  );
}
