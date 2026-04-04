import { useState, useRef, useEffect, useCallback } from "react";
import { Terminal, X, Columns2, Rows2, HardDrive } from "lucide-react";
import { motion } from "framer-motion";
import type { TerminalTab } from "../../types/terminal";
import { useTerminalStore, countPaneNodes } from "../../stores/terminal";
import { useSettingsStore } from "../../stores/settings";
import { useThemeStore } from "../../stores/theme";
import { hexToRgba } from "../../lib/color";
import { vibrancyAlpha } from "../../lib/platform";
import TerminalTree from "./TerminalTree";
import TabContextMenu from "./TabContextMenu";

interface TabProps {
  tab: TerminalTab;
  index: number;
  tabRef: (el: HTMLDivElement | null) => void;
  isDragTarget: boolean;
  isDragSource: boolean;
  onReorderStart: (index: number, clientX: number) => void;
  onClose: (id: string) => void;
  onClick: (id: string) => void;
  onRename: (id: string, title: string) => void;
  isVertical?: boolean;
}

export default function Tab({
  tab,
  index,
  tabRef,
  isDragTarget,
  isDragSource,
  onReorderStart,
  onClose,
  onClick,
  onRename,
  isVertical = false,
}: TabProps) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(tab.title);
  const [showPopover, setShowPopover] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const panes = useTerminalStore((s) => s.panes);
  const vibrancyEnabled = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const windowOpacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);
  const theme = useThemeStore((s) => s.active);
  const hasSplits = countPaneNodes(tab.panes) > 1;

  
  useEffect(() => {
    tabRef(containerRef.current);
    return () => tabRef(null);
  }, [tabRef]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const commitRename = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== tab.title) {
      useTerminalStore.getState().renameTab(tab.id, trimmed);
      onRename(tab.id, trimmed);
    } else {
      setEditValue(tab.title);
    }
    setEditing(false);
  }, [editValue, tab.title, tab.id, onRename]);

  const cancelRename = useCallback(() => {
    setEditValue(tab.title);
    setEditing(false);
  }, [tab.title]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setEditValue(tab.title);
      setEditing(true);
    },
    [tab.title]
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        commitRename();
      } else if (e.key === "Escape") {
        cancelRename();
      }
    },
    [commitRename, cancelRename]
  );

  const handleMouseEnter = useCallback(() => {
    setHovered(true);
    if (hasSplits) {
      hoverTimerRef.current = setTimeout(() => {
        setShowPopover(true);
      }, 500);
    }
  }, [hasSplits]);

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
    setShowPopover(false);
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (editing) return;
      if (e.button !== 0) return;
      
      if ((e.target as HTMLElement).closest("[data-close-btn]")) return;
      
      e.stopPropagation();
      onReorderStart(index, e.clientX);
    },
    [editing, index, onReorderStart]
  );

  return (
    <div
      ref={containerRef}
      data-no-drag
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setCtxMenu({ x: e.clientX, y: e.clientY });
      }}
      className="relative h-full"
    >
      {}
      {isDragTarget && (
        <div className="absolute inset-0 z-10 rounded bg-accent/20 border-2 border-accent/40 pointer-events-none" />
      )}

      <motion.div
        layout="position"
        initial={{ opacity: 0, x: isVertical ? 0 : -20, y: isVertical ? -20 : 0 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, x: isVertical ? 0 : -20, y: isVertical ? -20 : 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className={`
          relative flex items-center gap-2 text-xs transition-colors select-none cursor-default
          px-3 shrink-0
          ${
            isVertical 
              ? 'w-full min-h-[44px] py-2.5 justify-start' 
              : 'h-full min-w-[120px] max-w-[200px]'
          }
          ${
            tab.isActive
              ? vibrancyEnabled ? "text-text-primary" : "bg-bg-primary text-text-primary"
              : "bg-transparent text-text-secondary hover:bg-bg-tertiary"
          }
          ${isDragSource ? "opacity-50" : ""}
        `}
        style={
          tab.isActive && vibrancyEnabled
            ? { backgroundColor: hexToRgba(theme.ui.bgPrimary, vibrancyAlpha(windowOpacity)) }
            : undefined
        }
        onClick={() => onClick(tab.id)}
        onDoubleClick={handleDoubleClick}
      >
        {hasSplits ? (
          tab.panes.direction === "horizontal" ? (
            <Columns2 className="size-3.5 shrink-0" />
          ) : (
            <Rows2 className="size-3.5 shrink-0" />
          )
        ) : tab.shellType === "sftp" ? (
          <HardDrive className="size-3.5 shrink-0" />
        ) : (
          <Terminal className="size-3.5 shrink-0" />
        )}

        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleInputKeyDown}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="min-w-0 flex-1 truncate border-none bg-transparent text-xs text-text-primary outline-none"
          />
        ) : (
          <span className="truncate">{tab.title}</span>
        )}

        {(hovered || tab.isActive) && !editing && (
          <span
            data-close-btn
            className="ml-auto flex size-4 shrink-0 items-center justify-center rounded-sm hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.id);
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <X className="size-3" />
          </span>
        )}

        {tab.isActive && (
          <motion.span
            layoutId="active-tab-indicator"
            className={`absolute bg-accent ${
              isVertical 
                ? 'left-0 top-0 w-[3px] h-full' 
                : 'bottom-0 left-0 h-[2px] w-full'
            }`}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          />
        )}
      </motion.div>

      {showPopover && hasSplits && (
        <div
          className="fixed z-[100] mt-1 rounded-lg border border-border bg-bg-secondary p-2 shadow-lg"
          style={{
            top: (containerRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
            left: containerRef.current?.getBoundingClientRect().left ?? 0,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <TerminalTree node={tab.panes} panes={panes} />
        </div>
      )}

      {ctxMenu && (
        <TabContextMenu
          tabId={tab.id}
          tabIndex={index}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          onStartRename={() => {
            setEditValue(tab.title);
            setEditing(true);
          }}
        />
      )}
    </div>
  );
}
