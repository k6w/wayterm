import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useToastStore, type ToastVariant } from "../../stores/toast";

const ICONS: Record<ToastVariant, typeof Info> = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

const ACCENT: Record<ToastVariant, string> = {
  error: "text-error",
  success: "text-success",
  info: "text-accent",
};

/**
 * App-wide transient notifications. Mounted once at the root. Replaces the
 * per-panel copy-pasted error banners that used to stick until manually
 * cleared; action failures (git push, db connect, …) surface here instead.
 */
export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[var(--z-toast)] flex flex-col items-end gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = ICONS[t.variant];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="pointer-events-auto flex max-w-[360px] items-start gap-2 rounded-lg border border-border bg-bg-secondary/95 px-3 py-2 shadow-lg backdrop-blur-md"
            >
              <Icon size={14} className={`mt-0.5 shrink-0 ${ACCENT[t.variant]}`} />
              <span className="flex-1 break-words text-xs text-text-primary">
                {t.message}
              </span>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="shrink-0 rounded p-0.5 text-text-muted transition-colors hover:bg-overlay/[0.08] hover:text-text-primary"
              >
                <X size={12} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
