import { useState } from "react";
import { Upload, Download, ChevronDown, ChevronUp, X } from "lucide-react";
import { useThemeStore } from "../../stores/theme";
import { useSettingsStore } from "../../stores/settings";
import { hexToRgba } from "../../lib/color";
import { vibrancyAlpha } from "../../lib/platform";
import type { Transfer } from "../../types/sftp";

interface TransferQueueProps {
  transfers: Transfer[];
  onClearCompleted: () => void;
}

const STATUS_COLORS: Record<Transfer["status"], string> = {
  queued: "text-text-muted",
  in_progress: "text-accent",
  completed: "text-green-400",
  error: "text-red-400",
};

const STATUS_BAR_COLORS: Record<Transfer["status"], string> = {
  queued: "bg-text-muted/30",
  in_progress: "bg-accent",
  completed: "bg-green-400",
  error: "bg-red-400",
};

export default function TransferQueue({
  transfers,
  onClearCompleted,
}: TransferQueueProps) {
  const [collapsed, setCollapsed] = useState(true);
  const theme = useThemeStore((s) => s.active);
  const vibrancy = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const windowOpacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);

  if (transfers.length === 0) return null;

  const bgSecondary = vibrancy
    ? hexToRgba(theme.ui.bgSecondary, vibrancyAlpha(windowOpacity))
    : theme.ui.bgSecondary;

  const completedCount = transfers.filter(
    (t) => t.status === "completed" || t.status === "error"
  ).length;

  return (
    <div
      className="border-t border-border shrink-0"
      style={{ backgroundColor: bgSecondary }}
    >
      {}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] font-medium text-text-secondary hover:bg-white/[0.04] transition-colors"
      >
        {collapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        <span>
          Transfers ({transfers.length})
        </span>
        <span className="flex-1" />
        {completedCount > 0 && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onClearCompleted();
            }}
            className="flex items-center gap-1 text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={10} />
            Clear
          </span>
        )}
      </button>

      {}
      {!collapsed && (
        <div className="max-h-[140px] overflow-auto">
          {transfers.map((transfer) => {
            const pct =
              transfer.totalBytes > 0
                ? Math.round(
                    (transfer.bytesTransferred / transfer.totalBytes) * 100
                  )
                : 0;
            return (
              <div
                key={transfer.id}
                className="flex items-center gap-2 px-3 py-[3px] text-xs"
                style={{ height: 28 }}
              >
                {}
                <span className={STATUS_COLORS[transfer.status]}>
                  {transfer.direction === "upload" ? (
                    <Upload size={12} />
                  ) : (
                    <Download size={12} />
                  )}
                </span>

                {}
                <span className="truncate min-w-0 flex-1 text-text-secondary">
                  {transfer.fileName}
                </span>

                {}
                <div className="w-20 h-1.5 rounded-full bg-white/[0.06] shrink-0 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${STATUS_BAR_COLORS[transfer.status]}`}
                    style={{
                      width: `${transfer.status === "completed" ? 100 : pct}%`,
                    }}
                  />
                </div>

                {}
                <span
                  className={`w-10 text-right text-[10px] tabular-nums shrink-0 ${STATUS_COLORS[transfer.status]}`}
                >
                  {transfer.status === "error"
                    ? "ERR"
                    : transfer.status === "completed"
                      ? "Done"
                      : transfer.status === "queued"
                        ? "Wait"
                        : `${pct}%`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
