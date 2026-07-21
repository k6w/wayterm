import type { ComponentPropsWithRef } from "react";
import { Toolbar as ToolbarPrimitive } from "radix-ui";
import { cn } from "./utils";

/** One tab stop for a row of controls; arrow keys move between them. */
export function Toolbar({ className, ...rest }: ComponentPropsWithRef<typeof ToolbarPrimitive.Root>) {
  return <ToolbarPrimitive.Root className={cn("flex items-center", className)} {...rest} />;
}

/**
 * Registers its child (a Button, IconButton or MenuTrigger) with the
 * toolbar's roving focus. Defaults to asChild.
 */
export function ToolbarButton({
  asChild = true,
  ...rest
}: ComponentPropsWithRef<typeof ToolbarPrimitive.Button>) {
  return <ToolbarPrimitive.Button asChild={asChild} {...rest} />;
}

export function ToolbarSeparator({
  className,
  ...rest
}: ComponentPropsWithRef<typeof ToolbarPrimitive.Separator>) {
  return <ToolbarPrimitive.Separator className={cn("mx-1 h-3 w-px shrink-0 bg-border", className)} {...rest} />;
}

/** Pushes the following items to the far end. */
export function ToolbarSpacer() {
  return <div aria-hidden className="flex-1" />;
}
