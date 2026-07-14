import { useId } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface SegmentedOption<T extends string> {
  value: T;
  label?: string;
  icon?: LucideIcon;
  title?: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  disabled?: boolean;
  className?: string;
}

/** The single segmented / radio-group control, with a sliding active pill. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  disabled,
  className = "",
}: SegmentedControlProps<T>) {
  const groupId = useId();
  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-md border border-border bg-overlay/[0.03] p-0.5 ${
        disabled ? "pointer-events-none opacity-50" : ""
      } ${className}`}
    >
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            title={o.title ?? o.label}
            onClick={() => onChange(o.value)}
            className={`relative inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors ${
              active ? "text-white" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${groupId}`}
                className="absolute inset-0 rounded bg-accent"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            {Icon && <Icon size={13} className="relative z-10" />}
            {o.label && <span className="relative z-10">{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
