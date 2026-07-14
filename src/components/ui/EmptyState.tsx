import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: EmptyStateAction;
  /** Fill the parent's height and center vertically. Off by default for
   *  inline use inside scrollable lists. */
  fill?: boolean;
  className?: string;
}

/**
 * The one canonical "there's nothing here (yet)" surface. Replaces the
 * hand-copied empty-state markup that used to live in each panel with
 * slightly different spacing/wording. Icon + title + optional hint +
 * optional call-to-action.
 */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  fill = false,
  className = "",
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`flex flex-col items-center justify-center gap-3 px-6 text-center ${
        fill ? "h-full" : "py-8"
      } ${className}`}
    >
      {Icon && (
        <div className="flex size-10 items-center justify-center rounded-full bg-overlay/[0.06]">
          <Icon size={18} className="text-text-muted" />
        </div>
      )}
      <div className="space-y-1">
        <div className="text-xs text-text-secondary">{title}</div>
        {hint && (
          <div className="text-[11px] text-text-muted max-w-[240px] leading-relaxed">
            {hint}
          </div>
        )}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="rounded-md bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/25"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
