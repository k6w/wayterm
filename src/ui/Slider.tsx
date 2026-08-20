import { Slider as SliderPrimitive } from "radix-ui";
import { cn, focusRing } from "./utils";

export interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  /** Accessible name. The thumb is a span, so a <label htmlFor> cannot name it. */
  "aria-label": string;
  "aria-describedby"?: string;
  /** Formats the readout shown right of the track; also announced as the value text. */
  format?: (value: number) => string;
  className?: string;
}

/** Numeric range with a value readout. Arrow keys step, Page Up/Down jump, Home/End go to the ends. */
export function Slider({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  disabled,
  format,
  className,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: SliderProps) {
  const text = format ? format(value) : String(value);
  return (
    <div className={cn("flex items-center gap-3", disabled && "opacity-50", className)}>
      <SliderPrimitive.Root
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([next]) => {
          if (next !== undefined) onValueChange(next);
        }}
        className="relative flex h-4 w-40 touch-none select-none items-center data-[disabled]:cursor-not-allowed"
      >
        <SliderPrimitive.Track className="relative h-1 grow overflow-hidden rounded-full bg-active">
          <SliderPrimitive.Range className="absolute h-full bg-accent" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-valuetext={text}
          className={cn(
            "block size-3.5 rounded-full border border-border-strong bg-fg transition-colors duration-150 ease-out",
            focusRing
          )}
        />
      </SliderPrimitive.Root>
      <span aria-hidden className="w-12 shrink-0 text-right text-label tabular-nums text-fg-muted">
        {text}
      </span>
    </div>
  );
}
