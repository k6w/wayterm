import { useId, type ReactNode } from "react";
import { Input, cn, type InputProps } from "../../ui";

/** Props a SettingRow hands to its control. Spread them onto an Input, Switch or Select. */
export interface SettingControlProps {
  id: string;
  "aria-describedby"?: string;
}

export interface SettingRowProps {
  label: string;
  description?: ReactNode;
  /**
   * The control. As a function it receives the id the label points at (Input,
   * Switch, Select) and the description id. SegmentedControl and Slider cannot
   * be labelled by id: give them aria-label={label} instead.
   */
  children: ReactNode | ((control: SettingControlProps) => ReactNode);
  /** Put the control under the label (wide controls: text areas, lists). */
  stacked?: boolean;
  className?: string;
}

/** One setting: label and description on the left, its control on the right. */
export function SettingRow({ label, description, children, stacked = false, className }: SettingRowProps) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const control: SettingControlProps = {
    id,
    "aria-describedby": description ? descriptionId : undefined,
  };
  return (
    <div
      data-setting={label}
      className={cn(
        "flex min-h-row gap-4 px-row-x py-row-y",
        stacked ? "flex-col gap-2" : "items-center justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <label htmlFor={id} className="block text-body text-fg">
          {label}
        </label>
        {description && (
          <p id={descriptionId} className="mt-0.5 text-label text-fg-muted">
            {description}
          </p>
        )}
      </div>
      <div className={stacked ? "w-full" : "flex shrink-0 items-center justify-end gap-2"}>
        {typeof children === "function" ? children(control) : children}
      </div>
    </div>
  );
}

/** Bordered card that separates its SettingRows with hairlines. */
export function SettingsCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("divide-y divide-border overflow-hidden rounded-lg border border-border bg-panel", className)}>
      {children}
    </div>
  );
}

export interface NumberInputProps extends Omit<InputProps, "type" | "value" | "onChange"> {
  value: number | null;
  /** Receives Number(text): an emptied field reports 0, as the old settings field did. */
  onValueChange: (value: number) => void;
  /** Unit shown after the number ("s", "lines"). */
  unit?: string;
}

/** Number field with an optional unit suffix. An empty `value` (null) shows an empty field. */
export function NumberInput({ value, onValueChange, unit, className, ...rest }: NumberInputProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Input
        type="number"
        value={value ?? ""}
        onChange={(event) => onValueChange(Number(event.target.value))}
        className={cn("w-24 tabular-nums", className)}
        {...rest}
      />
      {unit && <span className="text-label text-fg-muted">{unit}</span>}
    </span>
  );
}
