import { useState, useRef, useCallback } from "react";
import { Folder, FileText, Link } from "lucide-react";
import { useThemeStore } from "../../stores/theme";
import { useSettingsStore } from "../../stores/settings";
import { hexToRgba } from "../../lib/color";
import { vibrancyAlpha } from "../../lib/platform";
import type { SftpEntry } from "../../types/sftp";

interface FileListProps {
  entries: SftpEntry[];
  selectedPaths: Set<string>;
  onSelect: (path: string, multi: boolean) => void;
  onNavigate: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, entry: SftpEntry) => void;
  onDragStart?: (e: React.DragEvent, entries: SftpEntry[]) => void;
  onDragEnd?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  emptyMessage?: string;
}


function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}


function formatDate(timestamp: string | null): string {
  if (!timestamp) return "--";
  const num = Number(timestamp);
  if (isNaN(num)) return "--";
  const d = new Date(num * 1000);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();

  const month = d.toLocaleString("en", { month: "short" });
  const day = d.getDate();
  if (sameYear) {
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${month} ${day} ${hours}:${mins}`;
  }
  return `${month} ${day}, ${d.getFullYear()}`;
}

function EntryIcon({ entry }: { entry: SftpEntry }) {
  if (entry.isSymlink) return <Link size={14} className="text-text-muted shrink-0" />;
  if (entry.isDir) return <Folder size={14} className="text-accent shrink-0" />;
  return <FileText size={14} className="text-text-muted shrink-0" />;
}

export default function FileList({
  entries,
  selectedPaths,
  onSelect,
  onNavigate,
  onContextMenu,
  onDragStart,
  onDragEnd,
  onDrop,
  emptyMessage = "No files",
}: FileListProps) {
  const [dragOver, setDragOver] = useState(false);
  const lastClickIndex = useRef<number>(-1);
  const theme = useThemeStore((s) => s.active);
  const vibrancy = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const windowOpacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);

  const headerBg = vibrancy
    ? hexToRgba(theme.ui.bgSecondary, vibrancyAlpha(windowOpacity) * 0.8)
    : hexToRgba(theme.ui.bgSecondary, 0.8);

  const handleClick = useCallback(
    (e: React.MouseEvent, entry: SftpEntry, index: number) => {
      if (e.shiftKey && lastClickIndex.current >= 0) {
        
        const start = Math.min(lastClickIndex.current, index);
        const end = Math.max(lastClickIndex.current, index);
        for (let i = start; i <= end; i++) {
          if (!selectedPaths.has(entries[i].path)) {
            onSelect(entries[i].path, true);
          }
        }
      } else {
        onSelect(entry.path, e.ctrlKey || e.metaKey);
      }
      lastClickIndex.current = index;
    },
    [entries, selectedPaths, onSelect]
  );

  const handleDoubleClick = useCallback(
    (entry: SftpEntry) => {
      if (entry.isDir) {
        onNavigate(entry.path);
      }
    },
    [onNavigate]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      onDrop?.(e);
    },
    [onDrop]
  );

  return (
    <div
      className={`flex-1 overflow-auto min-h-0 ${
        dragOver ? "ring-1 ring-inset ring-accent/40 bg-accent/5" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {}
      <div
        className="sticky top-0 z-10 flex items-center gap-2 border-b border-border backdrop-blur-sm px-2 py-1 text-[11px] font-medium text-text-muted select-none"
        style={{ backgroundColor: headerBg }}
      >
        <span className="flex-1 min-w-0">Name</span>
        <span className="w-16 text-right shrink-0">Size</span>
        <span className="w-28 text-right shrink-0">Modified</span>
      </div>

      {entries.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-xs text-text-muted">
          {emptyMessage}
        </div>
      ) : (
        <div>
          {entries.map((entry, index) => {
            const isSelected = selectedPaths.has(entry.path);
            return (
              <div
                key={entry.path}
                className={`flex items-center gap-2 px-2 py-[3px] text-xs cursor-default select-none transition-colors ${
                  isSelected
                    ? "bg-accent/15 text-text-primary"
                    : "text-text-secondary hover:bg-overlay/[0.04]"
                }`}
                draggable
                onClick={(e) => handleClick(e, entry, index)}
                onDoubleClick={() => handleDoubleClick(entry)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onContextMenu(e, entry);
                }}
                onDragStart={(e) => {
                  if (onDragStart) {
                    const selected = entries.filter((en) =>
                      selectedPaths.has(en.path)
                    );
                    const dragged =
                      selected.length > 0 && isSelected ? selected : [entry];
                    onDragStart(e, dragged);
                  }
                }}
                onDragEnd={() => onDragEnd?.()}
              >
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <EntryIcon entry={entry} />
                  <span className="truncate">{entry.name}</span>
                </div>
                <span className="w-16 text-right shrink-0 font-mono text-text-muted tabular-nums">
                  {entry.isDir ? "--" : formatSize(entry.size)}
                </span>
                <span className="w-28 text-right shrink-0 text-text-muted tabular-nums">
                  {formatDate(entry.modified)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { formatSize, formatDate };
