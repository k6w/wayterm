import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useThemeStore } from "../../stores/theme";
import { useSettingsStore } from "../../stores/settings";
import { hexToRgba } from "../../lib/color";
import { vibrancyAlpha } from "../../lib/platform";
import type { PendingHostKey } from "../../lib/ipc";

interface TofuDialogProps {
  open: boolean;
  pendingKey: PendingHostKey | null;
  onTrust: () => void;
  onCancel: () => void;
}

export default function TofuDialog({ open, pendingKey, onTrust, onCancel }: TofuDialogProps) {
  const theme = useThemeStore((s) => s.active);
  const vibrancy = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const opacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);

  const cardBg = vibrancy
    ? hexToRgba(theme.ui.bgPrimary, vibrancyAlpha(opacity) * 0.92)
    : theme.ui.bgPrimary;
  const footerBg = vibrancy
    ? hexToRgba(theme.ui.bgSecondary, vibrancyAlpha(opacity) * 0.5)
    : undefined;

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onTrust();
    },
    [open, onCancel, onTrust]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  if (!pendingKey) return null;

  const hostDisplay = pendingKey.port === 22
    ? pendingKey.host
    : `${pendingKey.host}:${pendingKey.port}`;

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
            className="w-[420px] max-w-[calc(100vw-2rem)] rounded-xl border border-border overflow-hidden shadow-2xl"
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
            <div className="px-5 pt-5 pb-4 flex gap-3.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning/15">
                <ShieldAlert size={18} className="text-warning" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-text-primary">Unknown Host</h3>
                <p className="mt-1 text-xs text-text-muted leading-relaxed">
                  The authenticity of host{" "}
                  <span className="font-mono text-text-secondary">{hostDisplay}</span>{" "}
                  can't be established. Verify the fingerprint with the server administrator
                  before trusting.
                </p>
              </div>
            </div>

            <div className="px-5 pb-4 space-y-2">
              <div className="rounded-lg bg-overlay/[0.06] border border-border p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-text-muted w-20 shrink-0">Host</span>
                  <span className="font-mono text-text-primary">{hostDisplay}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-text-muted w-20 shrink-0">Key type</span>
                  <span className="font-mono text-text-secondary">{pendingKey.keyType}</span>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <span className="text-text-muted w-20 shrink-0 mt-0.5">Fingerprint</span>
                  <span className="font-mono text-text-secondary break-all">{pendingKey.fingerprint}</span>
                </div>
              </div>
            </div>

            <div
              className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border"
              style={{ backgroundColor: footerBg }}
            >
              <button
                onClick={onCancel}
                className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onTrust}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-md bg-accent hover:bg-accent-hover transition-colors"
              >
                <ShieldCheck size={13} />
                Trust Host
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
