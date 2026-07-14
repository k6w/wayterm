import type { KeyboardEvent } from "react";

const BASE =
  "rounded-md border border-border bg-overlay/[0.03] px-3 py-1.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent disabled:cursor-not-allowed disabled:opacity-50";

interface TextFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  type?: "text" | "password";
  mono?: boolean;
  disabled?: boolean;
  className?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}

export function TextField({
  value,
  onChange,
  placeholder,
  id,
  type = "text",
  mono,
  disabled,
  className = "w-56",
  onKeyDown,
}: TextFieldProps) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className={`${BASE} ${mono ? "font-mono" : ""} ${className}`}
    />
  );
}

interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  step,
  unit,
  id,
  disabled,
  className = "w-28",
}: NumberFieldProps) {
  return (
    <div className="relative inline-flex items-center">
      <input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${BASE} ${unit ? "pr-10" : ""} ${className}`}
      />
      {unit && (
        <span className="pointer-events-none absolute right-3 text-xs text-text-muted">
          {unit}
        </span>
      )}
    </div>
  );
}

interface TextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  rows?: number;
  mono?: boolean;
  className?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function TextArea({
  value,
  onChange,
  placeholder,
  id,
  rows = 3,
  mono,
  className = "w-full",
  onKeyDown,
}: TextAreaProps) {
  return (
    <textarea
      id={id}
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className={`resize-none ${BASE} ${mono ? "font-mono" : ""} ${className}`}
    />
  );
}
