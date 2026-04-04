import { useEffect, useRef } from "react";
import {
  Pencil,
  Copy,
  X,
  XCircle,
  ArrowRightToLine,
  Columns2,
  Rows2,
  ArrowLeft,
  ArrowRight,
  FolderOpen,
} from "lucide-react";
import { useTerminalStore, collectPaneIds } from "../../stores/terminal";
import { useThemeStore } from "../../stores/theme";
import { useSettingsStore } from "../../stores/settings";
import { hexToRgba } from "../../lib/color";
import { vibrancyAlpha } from "../../lib/platform";
import { splitActivePane } from "../../lib/keybindings";

interface TabContextMenuProps {
  tabId: string;
  tabIndex: number;
  x: number;
  y: number;
  onClose: () => void;
  onStartRename: () => void;
}

type MenuItem =
  | { type: "item"; label: string; icon: React.ReactNode; shortcut?: string; action: () => void; disabled?: boolean }
  | { type: "separator" };

export default function TabContextMenu({
  tabId,
  tabIndex,
  x,
  y,
  onClose,
  onStartRename,
}: TabContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const themeObj = useThemeStore((s) => s.active);
  const vibrancy = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const windowOpacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);
  const menuBg = vibrancy
    ? hexToRgba(themeObj.ui.bgSecondary, vibrancyAlpha(windowOpacity) * 0.85)
    : themeObj.ui.bgSecondary;
  const tabs = useTerminalStore((s) => s.tabs);
  const panes = useTerminalStore((s) => s.panes);
  const removeTab = useTerminalStore((s) => s.removeTab);
  const setActiveTab = useTerminalStore((s) => s.setActiveTab);
  const duplicateTab = useTerminalStore((s) => s.duplicateTab);
  const closeOtherTabs = useTerminalStore((s) => s.closeOtherTabs);
  const closeTabsToRight = useTerminalStore((s) => s.closeTabsToRight);
  const reorderTabs = useTerminalStore((s) => s.reorderTabs);

  const isMac = navigator.platform.toLowerCase().includes("mac");
  const mod = isMac ? "\u2318" : "Ctrl";

  const tabCount = tabs.length;
  const isFirst = tabIndex === 0;
  const isLast = tabIndex === tabCount - 1;
  const hasTabsToRight = tabIndex < tabCount - 1;

  
  const tab = tabs.find((t) => t.id === tabId);
  const firstPaneId = tab ? collectPaneIds(tab.panes)[0] : null;
  const firstPane = firstPaneId ? panes[firstPaneId] : null;

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

  const items: MenuItem[] = [
    {
      type: "item",
      label: "Rename Tab",
      icon: <Pencil size={14} />,
      action: () => {
        onStartRename();
      },
    },
    {
      type: "item",
      label: "Duplicate Tab",
      icon: <Copy size={14} />,
      action: () => duplicateTab(tabId),
    },
    { type: "separator" },
    {
      type: "item",
      label: "Close Tab",
      icon: <X size={14} />,
      shortcut: `${mod}+W`,
      action: () => removeTab(tabId),
    },
    {
      type: "item",
      label: "Close Other Tabs",
      icon: <XCircle size={14} />,
      action: () => closeOtherTabs(tabId),
      disabled: tabCount <= 1,
    },
    {
      type: "item",
      label: "Close Tabs to Right",
      icon: <ArrowRightToLine size={14} />,
      action: () => closeTabsToRight(tabId),
      disabled: !hasTabsToRight,
    },
    { type: "separator" },
    {
      type: "item",
      label: "Split Right",
      icon: <Columns2 size={14} />,
      shortcut: `${mod}+\u21e7+D`,
      action: () => {
        setActiveTab(tabId);
        splitActivePane("horizontal");
      },
    },
    {
      type: "item",
      label: "Split Down",
      icon: <Rows2 size={14} />,
      shortcut: `${mod}+\u21e7+E`,
      action: () => {
        setActiveTab(tabId);
        splitActivePane("vertical");
      },
    },
    { type: "separator" },
    {
      type: "item",
      label: "Move Left",
      icon: <ArrowLeft size={14} />,
      action: () => reorderTabs(tabIndex, tabIndex - 1),
      disabled: isFirst,
    },
    {
      type: "item",
      label: "Move Right",
      icon: <ArrowRight size={14} />,
      action: () => reorderTabs(tabIndex, tabIndex + 1),
      disabled: isLast,
    },
    { type: "separator" },
    {
      type: "item",
      label: "Copy Path",
      icon: <FolderOpen size={14} />,
      action: () => {
        const path = firstPane?.cwd || "~";
        navigator.clipboard.writeText(path);
      },
    },
  ];

  return (
    <div
      ref={menuRef}
      style={{ position: "fixed", top: y, left: x, zIndex: 200 }}
    >
      <div
        className="min-w-[200px] rounded-lg border border-border py-1 shadow-xl"
        style={{
          backgroundColor: menuBg,
          backdropFilter: vibrancy ? "blur(20px) saturate(1.3)" : undefined,
          WebkitBackdropFilter: vibrancy ? "blur(20px) saturate(1.3)" : undefined,
        }}
      >
        {items.map((item, i) =>
          item.type === "separator" ? (
            <div key={i} className="my-1 h-px bg-border mx-2" />
          ) : (
            <button
              key={i}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                item.disabled
                  ? "text-text-muted/40 cursor-default"
                  : "text-text-primary hover:bg-white/[0.06]"
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
