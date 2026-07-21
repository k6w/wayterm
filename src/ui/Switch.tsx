import type { ComponentPropsWithRef } from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn, focusRing } from "./utils";

export interface SwitchProps extends Omit<ComponentPropsWithRef<typeof SwitchPrimitive.Root>, "children"> {
  /** Accessible name when there is no visible <label htmlFor>. */
  label?: string;
}

/** On/off toggle. Space toggles. */
export function Switch({ label, className, ...rest }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      aria-label={label}
      className={cn(
        "relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border border-border-strong bg-active",
        "transition-colors duration-150 ease-out data-[state=checked]:border-accent data-[state=checked]:bg-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        focusRing,
        className
      )}
      {...rest}
    >
      <SwitchPrimitive.Thumb className="block size-3 translate-x-px rounded-full bg-fg transition-transform duration-150 ease-out data-[state=checked]:translate-x-[13px] data-[state=checked]:bg-fg-on-accent" />
    </SwitchPrimitive.Root>
  );
}
