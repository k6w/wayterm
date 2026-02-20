import { useEffect, useRef } from "react";
import {
  ExternalLink,
  Columns2,
  Rows2,
  X,
  Copy,
  ClipboardPaste,
  TextSelect,
  Eraser,
  RotateCcw,
  FolderOpen,
} from "lucide-react";
import { useTerminalStore } from "../../stores/terminal";
import { splitActivePane } from "../../lib/keybindings";
import {
  copySelection,
  pasteToTerminal,
  selectAll,
  clearBuffer,
  resetTerminal,
  hasSelection,
} from "../../lib/terminal-registry";

interface PaneContextMenuProps {
  paneId: string;
  paneCount: number;
  x: number;
  y: number;
  onClose: () => void;
}

type MenuItem =
  | { type: "item"; label: string; icon: React.ReactNode; shortcut?: string; action: () => void; disabled?: boolean }
  | { type: "separator" };

export default function PaneContextMenu({
  paneId,
  paneCount,
  x,
  y,
  onClose,
}: PaneContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const detachPaneToTab = useTerminalStore((s) => s.detachPaneToTab);
  const closePaneInTab = useTerminalStore((s) => s.closePaneInTab);
  const setActivePane = useTerminalStore((s) => s.setActivePane);
  const pane = useTerminalStore((s) => s.panes[paneId]);

  const isMac = navigator.platform.toLowerCase().includes("mac");
  const mod = isMac ? "\u2318" : "Ctrl";

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

  const hasSel = hasSelection(paneId);

  const items: MenuItem[] = [
    {
      type: "item",
      label: "Copy",
      icon: <Copy size={14} />,
      shortcut: `${mod}+C`,
      action: () => copySelection(paneId),
      disabled: !hasSel,
    },
    {
      type: "item",
      label: "Paste",
      icon: <ClipboardPaste size={14} />,
      shortcut: `${mod}+V`,
      action: () => { pasteToTerminal(paneId); },
    },
    {
      type: "item",
      label: "Select All",
      icon: <TextSelect size={14} />,
      shortcut: `${mod}+A`,
      action: () => selectAll(paneId),
    },
    { type: "separator" },
    {
      type: "item",
      label: "Clear Buffer",
      icon: <Eraser size={14} />,
      shortcut: `${mod}+K`,
      action: () => clearBuffer(paneId),
    },
    {
      type: "item",
      label: "Reset Terminal",
      icon: <RotateCcw size={14} />,
      action: () => resetTerminal(paneId),
    },
    { type: "separator" },
    {
      type: "item",
      label: "Split Right",
      icon: <Columns2 size={14} />,
      shortcut: `${mod}+\u21e7+D`,
      action: () => {
        setActivePane(paneId);
        splitActivePane("horizontal");
      },
    },
    {
      type: "item",
      label: "Split Down",
      icon: <Rows2 size={14} />,
      shortcut: `${mod}+\u21e7+E`,
      action: () => {
        setActivePane(paneId);
        splitActivePane("vertical");
      },
    },
    { type: "separator" },
    ...(paneCount > 1
      ? [
          {
            type: "item" as const,
            label: "Detach to Tab",
            icon: <ExternalLink size={14} />,
            shortcut: `${mod}+\u21e7+T`,
            action: () => {
              setActivePane(paneId);
              detachPaneToTab(paneId);
            },
          },
          {
            type: "item" as const,
            label: "Close Pane",
            icon: <X size={14} />,
            shortcut: `${mod}+\u21e7+W`,
            action: () => closePaneInTab(paneId),
          },
          { type: "separator" as const },
        ]
      : []),
    {
      type: "item",
      label: "Copy Path",
      icon: <FolderOpen size={14} />,
      action: () => {
        const path = pane?.cwd || "~";
        navigator.clipboard.writeText(path);
      },
    },
  ];

  return (
    <div
      ref={menuRef}
      style={{ position: "fixed", top: y, left: x, zIndex: 200 }}
    >
      <div className="min-w-[200px] rounded-lg border border-border bg-bg-secondary py-1 shadow-xl">
        {items.map((item, i) =>
          item.type === "separator" ? (
            <div key={i} className="my-1 h-px bg-border mx-2" />
          ) : (
            <button
              key={i}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                item.disabled
                  ? "text-text-muted/40 cursor-default"
                  : "text-text-primary hover:bg-bg-tertiary"
              }`}
              disabled={item.disabled}
              onClick={() => {
                if (!item.disabled) {
                  item.action();
                  onClose();
                }
              }}
            >
              <span className="text-text-muted">{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.shortcut && (
                <span className="text-[10px] text-text-muted/60 ml-4">{item.shortcut}</span>
              )}
            </button>
          )
        )}
      </div>
    </div>
  );
}
