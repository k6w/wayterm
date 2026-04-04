import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Copy, SkipForward, Replace } from "lucide-react";
import { useThemeStore } from "../../stores/theme";
import { useSettingsStore } from "../../stores/settings";
import { hexToRgba } from "../../lib/color";
import { vibrancyAlpha } from "../../lib/platform";

interface FileConflictDialogProps {
  open: boolean;
  fileName: string;
  onReplace: () => void;
  onRename: (newPath: string) => void;
  onSkip: () => void;
  
  remoteNames: Set<string>;
  
  remoteDir: string;
}


function nextAvailableName(
  fileName: string,
  existingNames: Set<string>
): string {
  const dotIdx = fileName.lastIndexOf(".");
  const base = dotIdx > 0 ? fileName.slice(0, dotIdx) : fileName;
  const ext = dotIdx > 0 ? fileName.slice(dotIdx) : "";

  let n = 1;
  while (true) {
    const candidate = `${base} (${n})${ext}`;
    if (!existingNames.has(candidate)) return candidate;
    n++;
  }
}

export default function FileConflictDialog({
  open,
  fileName,
  onReplace,
  onRename,
  onSkip,
  remoteNames,
  remoteDir,
}: FileConflictDialogProps) {
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
      if (e.key === "Escape") onSkip();
    },
    [open, onSkip]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const handleKeepBoth = useCallback(() => {
    const newName = nextAvailableName(fileName, remoteNames);
    const newPath = remoteDir.replace(/\/+$/, "") + "/" + newName;
    onRename(newPath);
  }, [fileName, remoteNames, remoteDir, onRename]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onClick={onSkip}
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
            <div className="px-5 pt-5 pb-4 flex gap-3.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning/15">
                <AlertTriangle size={18} className="text-warning" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-text-primary">
                  File already exists
                </h3>
                <p className="mt-1 text-xs text-text-muted leading-relaxed">
                  <span className="font-medium text-text-secondary">
                    {fileName}
                  </span>{" "}
                  already exists in the remote directory. What would you like to
                  do?
                </p>
              </div>
            </div>
            <div
              className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border"
              style={{ backgroundColor: footerBg }}
            >
              <button
                onClick={onSkip}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary rounded-md transition-colors"
              >
                <SkipForward size={12} />
                Skip
              </button>
              <button
                onClick={handleKeepBoth}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary rounded-md border border-border hover:bg-white/[0.04] transition-colors"
              >
                <Copy size={12} />
                Keep Both
              </button>
              <button
                onClick={onReplace}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-md bg-accent hover:bg-accent-hover transition-colors"
              >
                <Replace size={12} />
                Replace
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
