import type { ComponentPropsWithRef } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { cn } from "./utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

export type PopoverContentProps = ComponentPropsWithRef<typeof PopoverPrimitive.Content>;

/** Floating panel anchored to its trigger. Escape or an outside click closes it. */
export function PopoverContent({ className, sideOffset = 6, align = "center", ...rest }: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={8}
        className={cn(
          "z-[var(--z-dropdown)] min-w-48 animate-wt-fade-in rounded-lg border border-border bg-raised-glass wt-blur p-3 text-body text-fg shadow-popover outline-none",
          className
        )}
        {...rest}
      />
    </PopoverPrimitive.Portal>
  );
}
