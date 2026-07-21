import type { ComponentPropsWithRef } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, focusRing } from "./utils";

/** Root. Controlled with value/onValueChange. Arrow keys move between triggers and activate them. */
export const Tabs = TabsPrimitive.Root;

export const tabsListVariants = cva("flex", {
  variants: {
    variant: {
      underline: "items-center gap-4 border-b border-border",
      pill: "items-center gap-0.5 rounded-md bg-input p-0.5",
      strip: "items-center gap-0.5",
    },
  },
  defaultVariants: { variant: "underline" },
});

export interface TabsListProps
  extends ComponentPropsWithRef<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {}

export function TabsList({ variant, className, ...rest }: TabsListProps) {
  return <TabsPrimitive.List className={cn(tabsListVariants({ variant }), className)} {...rest} />;
}

export const tabsTriggerVariants = cva(
  cn(
    "inline-flex select-none items-center gap-1.5 whitespace-nowrap font-medium",
    "transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-50",
    focusRing
  ),
  {
    variants: {
      variant: {
        underline:
          "relative h-control text-label text-fg-muted hover:text-fg data-[state=active]:text-fg data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:bg-accent",
        pill: "h-6 rounded-sm px-2.5 text-label text-fg-muted hover:text-fg data-[state=active]:bg-raised data-[state=active]:text-fg",
        strip:
          "h-control rounded-md px-3 text-label text-fg-muted hover:bg-hover hover:text-fg data-[state=active]:bg-tab-active data-[state=active]:text-fg",
      },
    },
    defaultVariants: { variant: "underline" },
  }
);

export interface TabsTriggerProps
  extends ComponentPropsWithRef<typeof TabsPrimitive.Trigger>,
    VariantProps<typeof tabsTriggerVariants> {}

export function TabsTrigger({ variant, className, ...rest }: TabsTriggerProps) {
  return <TabsPrimitive.Trigger className={cn(tabsTriggerVariants({ variant }), className)} {...rest} />;
}

export function TabsContent({ className, ...rest }: ComponentPropsWithRef<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn(focusRing, className)} {...rest} />;
}
