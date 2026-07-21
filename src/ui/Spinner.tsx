import { Loader2 } from "lucide-react";
import { cn } from "./utils";

export interface SpinnerProps {
  size?: 14 | 16;
  /** Accessible name announced by screen readers. */
  label?: string;
  className?: string;
}

/** Indeterminate progress indicator. Stops spinning under prefers-reduced-motion. */
export function Spinner({ size = 14, label = "Loading", className }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={cn("inline-flex text-fg-muted", className)}>
      <Loader2 size={size} strokeWidth={1.5} aria-hidden className="animate-spin motion-reduce:animate-none" />
    </span>
  );
}
