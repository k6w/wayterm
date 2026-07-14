interface SliderFieldProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  disabled?: boolean;
  className?: string;
}

/** Labeled range input with a value readout on the right. */
export function SliderField({
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
  disabled,
  className = "",
}: SliderFieldProps) {
  return (
    <div className={`flex items-center gap-3 ${disabled ? "opacity-50" : ""} ${className}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-40 cursor-pointer accent-accent disabled:cursor-not-allowed"
      />
      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-text-muted">
        {format ? format(value) : value}
      </span>
    </div>
  );
}
