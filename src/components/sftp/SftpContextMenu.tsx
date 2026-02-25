import { useEffect, useRef } from "react";
import {
  Download,
  Upload,
  FolderOpen,
  Edit3,
  Trash2,
  Copy,
  FolderPlus,
  RefreshCw,
  ClipboardPaste,
} from "lucide-react";
import type { SftpEntry } from "../../types/sftp";

interface SftpContextMenuProps {
  x: number;
  y: number;
  entry: SftpEntry | null;
  side: "local" | "remote";
  onAction: (action: string, entry: SftpEntry | null) => void;
  onClose: () => void;
}

type MenuItem =
  | {
      type: "item";
      label: string;
      icon: React.ReactNode;
      action: string;
    }
  | { type: "separator" };

export default function SftpContextMenu({
  x,
  y,
  entry,
  side,
  onAction,
  onClose,
}: SftpContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Clamp menu position to viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menuRef.current.style.left = `${window.innerWidth - rect.width - 8}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menuRef.current.style.top = `${window.innerHeight - rect.height - 8}px`;
    }
  }, []);

  const items: MenuItem[] = [];

  if (!entry) {
    // Background context menu (no entry selected)
    items.push(
      { type: "item", label: "New Folder", icon: <FolderPlus size={14} />, action: "new_folder" },
      { type: "item", label: "Refresh", icon: <RefreshCw size={14} />, action: "refresh" },
      { type: "separator" },
      { type: "item", label: "Paste", icon: <ClipboardPaste size={14} />, action: "paste" },
    );
  } else if (side === "remote") {
    // Remote entry
    if (entry.isDir) {
      items.push(
        { type: "item", label: "Open", icon: <FolderOpen size={14} />, action: "open" },
        { type: "item", label: "Download", icon: <Download size={14} />, action: "download" },
      );
    } else {
      items.push(
        { type: "item", label: "Download", icon: <Download size={14} />, action: "download" },
      );
    }
    items.push(
      { type: "separator" },
      { type: "item", label: "Rename", icon: <Edit3 size={14} />, action: "rename" },
      { type: "item", label: "Delete", icon: <Trash2 size={14} />, action: "delete" },
      { type: "separator" },
      { type: "item", label: "Copy Path", icon: <Copy size={14} />, action: "copy_path" },
    );
  } else {
    // Local entry
    if (entry.isDir) {
      items.push(
        { type: "item", label: "Open", icon: <FolderOpen size={14} />, action: "open" },
        { type: "item", label: "Upload", icon: <Upload size={14} />, action: "upload" },
      );
    } else {
      items.push(
        { type: "item", label: "Upload", icon: <Upload size={14} />, action: "upload" },
      );
    }
    items.push(
      { type: "separator" },
      { type: "item", label: "Copy Path", icon: <Copy size={14} />, action: "copy_path" },
    );
  }

  return (
    <div
      ref={menuRef}
      style={{ position: "fixed", top: y, left: x, zIndex: 200 }}
    >
      <div className="min-w-[180px] rounded-lg border border-border bg-bg-secondary py-1 shadow-xl">
        {items.map((item, i) =>
          item.type === "separator" ? (
            <div key={i} className="my-1 h-px bg-border mx-2" />
          ) : (
            <button
              key={i}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-tertiary transition-colors"
              onClick={() => {
                onAction(item.action, entry);
                onClose();
              }}
            >
              <span className="text-text-muted">{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
            </button>
          )
        )}
      </div>
    </div>
  );
}
