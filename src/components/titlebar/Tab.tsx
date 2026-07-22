import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { Columns2, Cpu, HardDrive, Rows2, Terminal, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { TerminalTab } from "../../types/terminal";
import { useTerminalStore, countPaneNodes } from "../../stores/terminal";
import { ContextMenu, ContextMenuTrigger, ICON_SM, IconButton, Input, TabsTrigger, Tooltip, cn } from "../../ui";
import TerminalTree from "./TerminalTree";
import TabContextMenuContent from "./TabContextMenu";

interface TabProps {
  tab: TerminalTab;
  index: number;
  tabRef: (el: HTMLDivElement | null) => void;
  isDragTarget: boolean;
  isDragSource: boolean;
  onReorderStart: (index: number, clientX: number) => void;
  onClose: (id: string) => void;
  onRename: (id: string, title: string) => void;
  isVertical?: boolean;
}

/**
 * One terminal tab: a Radix tab trigger (arrow keys move between tabs and
 * activate them; F2 renames; Delete closes), a close button, a right-click
 * menu, and a split-layout tooltip for tabs with more than one pane.
 */
export default function Tab({
  tab,
  index,
  tabRef,
  isDragTarget,
  isDragSource,
  onReorderStart,
  onClose,
  onRename,
  isVertical = false,
}: TabProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(tab.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const panes = useTerminalStore((s) => s.panes);
  const hasSplits = countPaneNodes(tab.panes) > 1;

  useEffect(() => {
    tabRef(containerRef.current);
    return () => tabRef(null);
  }, [tabRef]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startRename = useCallback(() => {
    setEditValue(tab.title);
    setEditing(true);
  }, [tab.title]);

  const commitRename = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== tab.title) onRename(tab.id, trimmed);
    else setEditValue(tab.title);
    setEditing(false);
  }, [editValue, tab.title, tab.id, onRename]);

  const cancelRename = useCallback(() => {
    setEditValue(tab.title);
    setEditing(false);
  }, [tab.title]);

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (editing || e.button !== 0) return;
      if ((e.target as HTMLElement).closest("[data-close-btn]")) return;
      e.stopPropagation();
      onReorderStart(index, e.clientX);
    },
    [editing, index, onReorderStart]
  );

  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "F2") {
      e.preventDefault();
      startRename();
    } else if (e.key === "Delete") {
      e.preventDefault();
      onClose(tab.id);
    }
  };

  const icon = hasSplits ? (
    tab.panes.direction === "horizontal" ? (
      <Columns2 {...ICON_SM} />
    ) : (
      <Rows2 {...ICON_SM} />
    )
  ) : tab.shellType === "sftp" ? (
    <HardDrive {...ICON_SM} />
  ) : tab.shellType === "serial" ? (
    <Cpu {...ICON_SM} />
  ) : (
    <Terminal {...ICON_SM} />
  );

  const enterOffset = reduceMotion ? 0 : -8;
  const fade = reduceMotion ? { duration: 0 } : { duration: 0.14, ease: "easeOut" as const };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={editing}>
        <div
          ref={containerRef}
          data-no-drag
          onMouseDown={handleMouseDown}
          className={cn("group relative shrink-0", isVertical ? "w-full" : "flex h-full items-center")}
        >
          {isDragTarget && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-10 rounded-md border-2 border-accent bg-accent-subtle"
            />
          )}

          <motion.div
            layout="position"
            initial={{ opacity: 0, x: isVertical ? 0 : enterOffset, y: isVertical ? enterOffset : 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: isVertical ? 0 : enterOffset, y: isVertical ? enterOffset : 0 }}
            transition={fade}
            className={cn("relative flex items-center", isVertical ? "w-full" : "max-w-[180px]", isDragSource && "opacity-40")}
          >
            {editing ? (
              <div
                className={cn(
                  "flex h-control items-center gap-2 rounded-md bg-tab-active px-3",
                  isVertical ? "w-full" : "w-[180px]"
                )}
              >
                <span aria-hidden className="inline-flex shrink-0 text-fg-muted">
                  {icon}
                </span>
                <Input
                  ref={inputRef}
                  variant="bare"
                  size="sm"
                  aria-label="Tab name"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    else if (e.key === "Escape") cancelRename();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                />
              </div>
            ) : (
              <Tooltip
                content={hasSplits ? <TerminalTree node={tab.panes} panes={panes} /> : null}
                side={isVertical ? "right" : "bottom"}
                delayDuration={500}
              >
                <TabsTrigger
                  value={tab.id}
                  variant="strip"
                  onKeyDown={handleTriggerKeyDown}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    startRename();
                  }}
                  className={cn("max-w-full gap-2 pr-7", isVertical && "w-full justify-start")}
                >
                  <span aria-hidden className="inline-flex shrink-0">
                    {icon}
                  </span>
                  {tab.colorTag && (
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full bg-(--nx-dyn-tag)"
                      style={{ "--nx-dyn-tag": tab.colorTag } as CSSProperties}
                    />
                  )}
                  <span className="truncate">{tab.title}</span>
                  {tab.hasBell && !tab.isActive && (
                    <>
                      <span aria-hidden className="size-1.5 shrink-0 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
                      <span className="sr-only">(activity)</span>
                    </>
                  )}
                </TabsTrigger>
              </Tooltip>
            )}

            {!editing && (
              <IconButton
                data-close-btn
                label={`Close ${tab.title}`}
                icon={<X {...ICON_SM} />}
                size="xs"
                tooltip={false}
                tabIndex={-1}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
                className={cn(
                  "absolute right-1 top-1/2 -translate-y-1/2",
                  tab.isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                )}
              />
            )}

            {tab.isActive && !editing && (
              <motion.span
                layoutId="active-tab-indicator"
                aria-hidden
                className={cn(
                  "pointer-events-none absolute rounded-full bg-accent",
                  isVertical ? "bottom-1.5 left-0 top-1.5 w-0.5" : "-bottom-[3px] left-3 right-3 h-0.5"
                )}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: "easeOut" }}
              />
            )}
          </motion.div>
        </div>
      </ContextMenuTrigger>
      <TabContextMenuContent tabId={tab.id} tabIndex={index} onStartRename={startRename} />
    </ContextMenu>
  );
}
