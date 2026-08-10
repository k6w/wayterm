import { cn } from "./utils";

const TONE = {
  info: "bg-info",
  success: "bg-success",
  danger: "bg-danger",
  neutral: "bg-fg-muted",
} as const;

export interface ProgressProps {
  /** Percent done, 0 to 100. Out-of-range and non-finite values are clamped. */
  value: number;
  tone?: keyof typeof TONE;
  /** Accessible name, e.g. the file being transferred. */
  label: string;
  className?: string;
}

/** Thin determinate progress bar. */
export function Progress({ value, tone = "info", label, className }: ProgressProps) {
  const percent = Math.round(Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn("h-1 w-full overflow-hidden rounded-full bg-hover", className)}
    >
      <div
        data-tone={tone}
        className={cn("h-full rounded-full transition-[width] duration-150 ease-out", TONE[tone])}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
