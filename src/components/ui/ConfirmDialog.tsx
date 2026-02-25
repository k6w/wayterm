import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    },
    [open, onCancel, onConfirm]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

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
            className="w-[360px] max-w-[calc(100vw-2rem)] rounded-xl bg-bg-primary border border-border overflow-hidden shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4 flex gap-3.5">
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                  variant === "danger" ? "bg-error/15" : "bg-accent/15"
                }`}
              >
                <AlertTriangle
                  size={18}
                  className={variant === "danger" ? "text-error" : "text-accent"}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-text-primary">{title}</h3>
                <p className="mt-1 text-xs text-text-muted leading-relaxed">
                  {message}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-bg-secondary/50">
              <button
                onClick={onCancel}
                className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary rounded-md transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={`px-3 py-1.5 text-xs font-medium text-white rounded-md transition-colors ${
                  variant === "danger"
                    ? "bg-error hover:bg-error/80"
                    : "bg-accent hover:bg-accent-hover"
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
