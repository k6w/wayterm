import { useId, type ComponentPropsWithRef, type ReactNode } from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { Icon } from "./icons";
import { cn, focusRing } from "./utils";

export interface CheckboxProps extends Omit<ComponentPropsWithRef<typeof CheckboxPrimitive.Root>, "children"> {
  /** Visible label; clicking it toggles the box. */
  label?: ReactNode;
}

/** Checkbox with an optional visible label. Space toggles. */
export function Checkbox({ label, id, className, checked, ...rest }: CheckboxProps) {
  const autoId = useId();
  const boxId = id ?? autoId;
  const box = (
    <CheckboxPrimitive.Root
      id={boxId}
      checked={checked}
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-sm border border-border-strong bg-input text-fg-on-accent",
        "transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent",
        "data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent",
        focusRing,
        className
      )}
      {...rest}
    >
      <CheckboxPrimitive.Indicator className="inline-flex">
        {checked === "indeterminate" ? (
          <Icon name="indeterminate" size={12} aria-hidden />
        ) : (
          <Icon name="checked" size={12} aria-hidden />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
  if (!label) return box;
  return (
    <div className="inline-flex items-center gap-2">
      {box}
      <label htmlFor={boxId} className="select-none text-body text-fg">
        {label}
      </label>
    </div>
  );
}
