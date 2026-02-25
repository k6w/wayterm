import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useThemeStore } from "../../stores/theme";
import { useSettingsStore } from "../../stores/settings";
import { hexToRgba } from "../../lib/color";
import { vibrancyAlpha } from "../../lib/platform";

interface InputDialogProps {
  open: boolean;
  title: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export default function InputDialog({
  open,
  title,
  label,
  defaultValue = "",
  placeholder,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: InputDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const theme = useThemeStore((s) => s.active);
  const vibrancy = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const opacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [open, defaultValue]);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") onCancel();
    },
    [open, onCancel]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (value.trim()) onConfirm(value.trim());
    },
    [value, onConfirm]
  );

  const cardBg = vibrancy
    ? hexToRgba(theme.ui.bgPrimary, vibrancyAlpha(opacity) * 0.92)
    : theme.ui.bgPrimary;
  const footerBg = vibrancy
    ? hexToRgba(theme.ui.bgSecondary, vibrancyAlpha(opacity) * 0.5)
    : undefined;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onClick={onCancel}
        >
          <motion.div
            className="w-[380px] max-w-[calc(100vw-2rem)] rounded-xl border border-border overflow-hidden shadow-2xl"
            style={{
              backgroundColor: cardBg,
              backdropFilter: vibrancy ? "blur(24px) saturate(1.4)" : undefined,
              WebkitBackdropFilter: vibrancy ? "blur(24px) saturate(1.4)" : undefined,
            }}
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSubmit}>
              <div className="px-5 pt-5 pb-4">
                <h3 className="text-sm font-medium text-text-primary">
                  {title}
                </h3>
                <p className="mt-1 text-xs text-text-muted">{label}</p>
                <input
                  ref={inputRef}
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={placeholder}
                  className="mt-3 w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent transition-colors"
                />
              </div>
              <div
                className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border"
                style={{ backgroundColor: footerBg }}
              >
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary rounded-md transition-colors"
                >
                  {cancelLabel}
                </button>
                <button
                  type="submit"
                  disabled={!value.trim()}
                  className="px-3 py-1.5 text-xs font-medium text-white rounded-md bg-accent hover:bg-accent-hover transition-colors disabled:opacity-40"
                >
                  {confirmLabel}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
