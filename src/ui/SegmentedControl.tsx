import type { ReactNode } from "react";
import { ToggleGroup } from "radix-ui";
import { IconWeightProvider } from "./icons";
import { cn, focusRing } from "./utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  "aria-label": string;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  /**
   * Extra classes for the option labels. With icons, "sr-only @[340px]:not-sr-only"
   * collapses the control to icons (labels stay the accessible names and
   * native tooltips) until the nearest @container is wide enough.
   */
  labelClassName?: string;
}

/**
 * Pick exactly one of a few options. Arrow keys move focus, Space/Enter
 * selects. Clicking the selected segment keeps it selected.
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  size = "md",
  disabled,
  className,
  labelClassName,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next as T);
      }}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn("inline-flex items-center gap-0.5 rounded-md border border-border bg-input p-0.5", className)}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          title={option.label}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-sm px-2.5 font-medium text-fg-muted",
            "transition-colors duration-150 ease-out hover:text-fg disabled:opacity-50",
            "data-[state=on]:bg-raised data-[state=on]:text-fg",
            size === "sm" ? "h-5 text-caption" : "h-6 text-label",
            focusRing
          )}
        >
          {option.icon && (
            <span aria-hidden className="inline-flex">
              <IconWeightProvider weight={option.value === value ? "fill" : "regular"}>{option.icon}</IconWeightProvider>
            </span>
          )}
          <span className={labelClassName}>{option.label}</span>
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
