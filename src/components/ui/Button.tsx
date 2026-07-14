import { motion } from "framer-motion";
import type { ReactNode } from "react";

type ButtonVariant = "primary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:opacity-90",
  ghost: "text-text-secondary hover:bg-overlay/[0.08] hover:text-text-primary",
  danger: "text-error hover:bg-error/15",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "px-2 py-1 text-[11px] gap-1",
  md: "px-3 py-1.5 text-xs gap-1.5",
};

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
  className?: string;
}

/** Text/label button with the app's standard press feedback. */
export function Button({
  children,
  onClick,
  variant = "ghost",
  size = "md",
  disabled,
  title,
  type = "button",
  className = "",
}: ButtonProps) {
  return (
    <motion.button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
    >
      {children}
    </motion.button>
  );
}

interface IconButtonProps {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
  active?: boolean;
  className?: string;
}

/** Square icon-only button (toolbars, row actions). */
export function IconButton({
  children,
  onClick,
  title,
  disabled,
  active,
  className = "",
}: IconButtonProps) {
  return (
    <motion.button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.1 }}
      whileTap={disabled ? undefined : { scale: 0.9 }}
      className={`inline-flex items-center justify-center rounded-md p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? "bg-accent/10 text-accent"
          : "text-text-muted hover:bg-overlay/[0.08] hover:text-text-primary"
      } ${className}`}
    >
      {children}
    </motion.button>
  );
}
