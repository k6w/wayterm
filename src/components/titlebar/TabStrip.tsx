import { useCallback, useRef, useState, useEffect, type ReactNode } from "react";
import { Icon } from "../../ui/icons";
import { AnimatePresence } from "framer-motion";
import { useTerminalStore, collectPaneIds } from "../../stores/terminal";
import { useSettingsStore } from "../../stores/settings";
import { getPreferredShell, getDefaultShells } from "../../lib/shell-detect";
import { shortcutFor } from "../../lib/shortcut-hints";
import { openProfileTab } from "../../lib/profiles";
import type { ShellType } from "../../types/terminal";
import type { DropZone } from "../../stores/terminal";
import { IconButton, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Tabs, TabsList, cn } from "../../ui";
import Tab from "./Tab";

/** Pointer travel (px) before a press on a tab becomes a drag instead of a click. */
const DRAG_THRESHOLD_PX = 4;

function computeDropZone(x: number, y: number, rect: DOMRect): DropZone {
  const rx = (x - rect.left) / rect.width;
  const ry = (y - rect.top) / rect.height;
  if (rx < 0.3) return "left";
  if (rx > 0.7) return "right";
  if (ry < 0.3) return "top";
  if (ry > 0.7) return "bottom";
  if (rx < 0.5) return "left";
  return "right";
}

export default function TabStrip() {
  const tabs = useTerminalStore((s) => s.tabs);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const addTab = useTerminalStore((s) => s.addTab);
  const removeTab = useTerminalStore((s) => s.removeTab);
  const setActiveTab = useTerminalStore((s) => s.setActiveTab);
  const renameTab = useTerminalStore((s) => s.renameTab);
  const tabPosition = useSettingsStore((s) => s.settings.appearance.tabPosition);

  const isVertical = tabPosition === 'left' || tabPosition === 'right';

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const tabRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const isDraggingRef = useRef(false);
  const dragIndexRef = useRef<number | null>(null);
  const dropIndexRef = useRef<number | null>(null);
  /** True between the end of a drag and the click event the browser may fire after it. */
  const justDraggedRef = useRef(false);

  const handleRename = useCallback(
    (id: string, title: string) => {
      renameTab(id, title);
    },
    [renameTab]
  );

  useEffect(() => { dragIndexRef.current = dragIndex; }, [dragIndex]);
  useEffect(() => { dropIndexRef.current = dropIndex; }, [dropIndex]);

  /**
   * Mouse selection happens on click, not mousedown (Radix's default), so that
   * press-and-drag never activates the dragged tab. Activating it would show
   * its own pane, and a tab cannot be merged into itself.
   */
  const handleActivate = useCallback(
    (id: string, trigger: HTMLElement) => {
      if (justDraggedRef.current) return;
      setActiveTab(id);
      trigger.focus();
    },
    [setActiveTab]
  );

  const handleReorderStart = useCallback(
    (index: number, startX: number, startY: number) => {
      isDraggingRef.current = false;
      justDraggedRef.current = false;
      dragIndexRef.current = index;

      const draggedTab = useTerminalStore.getState().tabs[index];
      const ownPaneIds = new Set(draggedTab ? collectPaneIds(draggedTab.panes) : []);

      const onMouseMove = (e: MouseEvent) => {
        if (!isDraggingRef.current) {
          if (Math.hypot(e.clientX - startX, e.clientY - startY) <= DRAG_THRESHOLD_PX) return;
          isDraggingRef.current = true;
          useTerminalStore.getState().setDraggingTab(draggedTab?.id ?? null);
        }

        setDragIndex(index);

        let overTab: number | null = null;
        tabRefs.current.forEach((el, i) => {
          const rect = el.getBoundingClientRect();
          if (e.clientX >= rect.left && e.clientX <= rect.right &&
              e.clientY >= rect.top && e.clientY <= rect.bottom) {
            overTab = i;
          }
        });

        if (overTab !== null) {
          setDropIndex(overTab);
          dropIndexRef.current = overTab;
          useTerminalStore.getState().setDragOverPane(null, null);
          return;
        }

        setDropIndex(null);
        dropIndexRef.current = null;

        const el = document.elementFromPoint(e.clientX, e.clientY);
        const paneEl = el?.closest<HTMLElement>("[data-pane-id]");
        const paneId = paneEl?.getAttribute("data-pane-id");
        if (paneEl && paneId && !ownPaneIds.has(paneId)) {
          const zone = computeDropZone(e.clientX, e.clientY, paneEl.getBoundingClientRect());
          useTerminalStore.getState().setDragOverPane(paneId, zone);
        } else {
          useTerminalStore.getState().setDragOverPane(null, null);
        }
      };

      const finish = (commit: boolean) => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.removeEventListener("keydown", onKeyDown, true);

        if (isDraggingRef.current) {
          const from = dragIndexRef.current;
          const to = dropIndexRef.current;
          const s = useTerminalStore.getState();

          if (commit) {
            if (from !== null && to !== null && from !== to) {
              s.reorderTabs(from, to);
            } else if (s.dragOverPaneId && s.dragOverZone && s.draggingTabId) {
              s.mergeTabIntoPane(s.draggingTabId, s.dragOverPaneId, s.dragOverZone);
            }
          }

          s.setDraggingTab(null);
          s.setDragOverPane(null, null);
          justDraggedRef.current = true;
          setTimeout(() => { justDraggedRef.current = false; }, 0);
        }

        setDragIndex(null);
        setDropIndex(null);
        dropIndexRef.current = null;
        isDraggingRef.current = false;
      };

      const onMouseUp = () => finish(true);
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key !== "Escape" || !isDraggingRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        finish(false);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.addEventListener("keydown", onKeyDown, true);
    },
    []
  );

  const setTabRef = useCallback(
    (index: number, el: HTMLDivElement | null) => {
      if (el) {
        tabRefs.current.set(index, el);
      } else {
        tabRefs.current.delete(index);
      }
    },
    []
  );

  return (
    <Tabs
      value={activeTabId ?? ""}
      onValueChange={setActiveTab}
      orientation={isVertical ? "vertical" : "horizontal"}
      data-tauri-drag-region
      className={cn(
        "flex min-w-0 items-center",
        isVertical ? "w-full flex-1 flex-col overflow-y-auto" : "scrollbar-none h-full flex-1 overflow-x-auto overflow-y-hidden"
      )}
    >
      <TabsList
        variant="strip"
        aria-label="Terminal tabs"
        data-tauri-drag-region
        className={cn("scrollbar-none", isVertical ? "w-full flex-col" : "h-full")}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {tabs.map((tab, i) => (
            <Tab
              key={tab.id}
              tab={tab}
              index={i}
              tabRef={(el) => setTabRef(i, el)}
              isDragTarget={dropIndex === i && dragIndex !== null && dragIndex !== i}
              isDragSource={dragIndex === i}
              onReorderStart={handleReorderStart}
              onActivate={handleActivate}
              onClose={removeTab}
              onRename={handleRename}
              isVertical={isVertical}
            />
          ))}
        </AnimatePresence>
      </TabsList>
      <NewTabControls onAdd={addTab} isVertical={isVertical} />
      <div
        data-tauri-drag-region
        className={cn("shrink-0", isVertical ? "min-h-5 w-full flex-1" : "h-full min-w-5 flex-1")}
      />
    </Tabs>
  );
}


const SHELL_ICONS: Record<string, ReactNode> = {
  powershell: <Icon name="newTerminal" size="sm" />,
  cmd: <Icon name="shellCmd" size="sm" />,
  gitbash: <Icon name="shellGitBash" size="sm" />,
  wsl: <Icon name="terminal" size="sm" />,
  bash: <Icon name="terminal" size="sm" />,
  zsh: <Icon name="terminal" size="sm" />,
  fish: <Icon name="terminal" size="sm" />,
  sh: <Icon name="terminal" size="sm" />,
  ssh: <Icon name="terminal" size="sm" />,
  sftp: <Icon name="sftp" size="sm" />,
};

/** "+" opens a tab with the default shell; the chevron menu picks another shell or a profile. */
function NewTabControls({
  onAdd,
  isVertical,
}: {
  onAdd: (type: ShellType, path?: string) => void;
  isVertical: boolean;
}) {
  const shells = getDefaultShells();
  const defaultShellSetting = useSettingsStore((s) => s.settings.general.defaultShell);
  const defaultShell = getPreferredShell(defaultShellSetting);
  const profiles = useSettingsStore((s) => s.settings.profiles);
  const tooltipSide = isVertical ? "right" : "bottom";

  return (
    <div className={cn("flex shrink-0 items-center gap-0.5", isVertical ? "w-full justify-center py-1" : "pl-1")}>
      <IconButton
        label={`New tab (${defaultShell.label})`}
        icon={<Icon name="newTab" size="sm" />}
        shortcut={shortcutFor("new-tab")}
        tooltipSide={tooltipSide}
        onClick={() => onAdd(defaultShell.type, defaultShell.path)}
      />
      <Menu>
        <MenuTrigger asChild>
          <IconButton label="Choose shell" icon={<Icon name="chevronDown" size="sm" />} size="xs" tooltipSide={tooltipSide} />
        </MenuTrigger>
        <MenuContent align="start" side={isVertical ? "right" : "bottom"}>
          <MenuLabel>New tab with</MenuLabel>
          {shells.map((shell, i) => (
            <MenuItem
              key={`${shell.type}-${i}`}
              icon={SHELL_ICONS[shell.type] ?? <Icon name="terminal" size="sm" />}
              onSelect={() => onAdd(shell.type, shell.path)}
            >
              {shell.label}
              {shell.path === defaultShell.path && <span className="text-caption text-fg-muted">default</span>}
            </MenuItem>
          ))}
          {profiles.length > 0 && (
            <>
              <MenuSeparator />
              <MenuLabel>Profiles</MenuLabel>
              {profiles.map((profile) => (
                <MenuItem
                  key={profile.id}
                  icon={<Icon name="terminal" size="sm" />}
                  onSelect={() => openProfileTab(profile, useSettingsStore.getState().settings)}
                >
                  {profile.name}
                </MenuItem>
              ))}
            </>
          )}
        </MenuContent>
      </Menu>
    </div>
  );
}
