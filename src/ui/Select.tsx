import { Select as SelectPrimitive } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { menuContentClass, menuItemClass } from "./menu-styles";
import { cn, focusRing, ICON_SM } from "./utils";

export interface SelectOption {
  /** Must not be an empty string (Radix reserves "" for "no value"). */
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
}

/** Single-choice dropdown. Keyboard: Enter/Space/Arrow opens, arrows move, Enter picks, Escape closes. */
export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  size = "md",
  disabled,
  id,
  className,
  "aria-label": ariaLabel,
}: SelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          "inline-flex w-full items-center justify-between gap-2 rounded-md border border-input-border bg-input px-2 text-fg",
          "hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-fg-muted",
          size === "sm" ? "h-6 text-label" : "h-control text-body",
          focusRing,
          className
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon className="inline-flex text-fg-muted">
          <ChevronDown {...ICON_SM} aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={cn(menuContentClass, "max-h-72 min-w-(--radix-select-trigger-width)")}
        >
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(menuItemClass, "pr-7")}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex text-accent-fg">
                  <Check {...ICON_SM} aria-hidden />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
