import { useState } from "react";
import { Icon, Icons } from "../../ui/icons";
import { Badge, Button, ICON_SM, Progress, cn } from "../../ui";
import type { Transfer } from "../../types/sftp";
import { TRANSFER_TONE, transferPercent, transferStatusLabel } from "./file-table";

const TEXT_TONE = {
  neutral: "text-fg-muted",
  info: "text-info",
  success: "text-success",
  danger: "text-danger",
} as const;

interface TransferQueueProps {
  transfers: Transfer[];
  onClearCompleted: () => void;
}

/**
 * Collapsible transfer list docked under the file lists (collapsed by
 * default). Hidden while there are no transfers.
 */
export default function TransferQueue({ transfers, onClearCompleted }: TransferQueueProps) {
  const [open, setOpen] = useState(false);
  if (transfers.length === 0) return null;

  const finished = transfers.filter((t) => t.status === "completed" || t.status === "error").length;
  const running = transfers.filter((t) => t.status === "in_progress").length;

  return (
    <section aria-label="Transfers" className="shrink-0 border-t border-border bg-panel">
      <div className="flex h-8 items-center gap-2 pl-1 pr-2">
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={open}
          leadingIcon={open ? <Icon name="chevronDown" size="sm" /> : <Icon name="chevronUp" size="sm" />}
          onClick={() => setOpen((v) => !v)}
        >
          Transfers
        </Button>
        <Badge>{transfers.length}</Badge>
        {running > 0 && <Badge tone="info">{running} running</Badge>}
        <span aria-hidden className="flex-1" />
        {finished > 0 && (
          <Button size="xs" variant="ghost" onClick={onClearCompleted}>
            Clear finished
          </Button>
        )}
      </div>
      {open && (
        <ul className="max-h-36 overflow-y-auto pb-1">
          {transfers.map((t) => {
            const tone = TRANSFER_TONE[t.status];
            const DirectionIcon = t.direction === "upload" ? Icons.upload : Icons.download;
            return (
              <li key={t.id} title={t.error ?? undefined} className="flex h-row items-center gap-2 px-3 text-label">
                <DirectionIcon {...ICON_SM} aria-label={t.direction === "upload" ? "Upload" : "Download"} className={cn("shrink-0", TEXT_TONE[tone])} />
                <span className="min-w-0 flex-1 truncate text-fg-secondary">{t.fileName}</span>
                <Progress label={t.fileName} value={transferPercent(t)} tone={tone} className="w-20 shrink-0" />
                <span className={cn("w-12 shrink-0 text-right tabular-nums text-caption", TEXT_TONE[tone])}>
                  {transferStatusLabel(t)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
