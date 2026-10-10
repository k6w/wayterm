import type { ComponentPropsWithRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";

export const panelVariants = cva("rounded-lg border border-border", {
  variants: {
    elevation: { canvas: "", panel: "", raised: "" },
    glass: { true: "wt-blur", false: "" },
    padding: { none: "", sm: "p-2", md: "p-3" },
  },
  compoundVariants: [
    { elevation: "canvas", class: "bg-canvas" },
    { elevation: "panel", glass: false, class: "bg-panel" },
    { elevation: "panel", glass: true, class: "bg-panel-glass" },
    { elevation: "raised", glass: false, class: "bg-raised" },
    { elevation: "raised", glass: true, class: "bg-raised-glass" },
  ],
  defaultVariants: { elevation: "panel", glass: false, padding: "none" },
});

export interface PanelProps extends ComponentPropsWithRef<"div">, VariantProps<typeof panelVariants> {}

/** Bordered surface. `glass` turns translucent (and blurred) while vibrancy is on. */
export function Panel({ elevation, glass, padding, className, ...rest }: PanelProps) {
  return <div className={cn(panelVariants({ elevation, glass, padding }), className)} {...rest} />;
}
