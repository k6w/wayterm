import { useCallback, useRef, useState, useEffect, type ReactNode } from "react";
import { ChevronDown, HardDrive, Hash, MonitorDot, Plus, SquareTerminal, Terminal } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useTerminalStore } from "../../stores/terminal";
import { useSettingsStore } from "../../stores/settings";
import { getPreferredShell, getDefaultShells } from "../../lib/shell-detect";
import { shortcutFor } from "../../lib/shortcut-hints";
import type { ShellType } from "../../types/terminal";
import type { DropZone } from "../../stores/terminal";
import { ICON_SM, IconButton, Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger, Tabs, TabsList, cn } from "../../ui";
import Tab from "./Tab";

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
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const dragIndexRef = useRef<number | null>(null);
  const dropIndexRef = useRef<number | null>(null);

  const handleRename = useCallback(
    (id: string, title: string) => {
      renameTab(id, title);
    },
    [renameTab]
  );

  
  useEffect(() => { dragIndexRef.current = dragIndex; }, [dragIndex]);
  useEffect(() => { dropIndexRef.current = dropIndex; }, [dropIndex]);

  const handleReorderStart = useCallback(
    (index: number, clientX: number) => {
      startXRef.current = clientX;
      isDraggingRef.current = false;
      dragIndexRef.current = index;

      const store = useTerminalStore.getState();
      const draggedTabId = store.tabs[index]?.id;

      const onMouseMove = (e: MouseEvent) => {
        const dx = Math.abs(e.clientX - startXRef.current);
        if (dx > 5) {
          if (!isDraggingRef.current) {
            isDraggingRef.current = true;
            
            useTerminalStore.getState().setDraggingTab(draggedTabId ?? null);
          }
        }

        if (!isDraggingRef.current) return;

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
        } else {
          
          setDropIndex(null);
          dropIndexRef.current = null;

          const el = document.elementFromPoint(e.clientX, e.clientY);
          const paneEl = el?.closest("[data-pane-id]") as HTMLElement | null;
          if (paneEl) {
            const paneId = paneEl.getAttribute("data-pane-id")!;
            const rect = paneEl.getBoundingClientRect();
            const zone = computeDropZone(e.clientX, e.clientY, rect);
            useTerminalStore.getState().setDragOverPane(paneId, zone);
          } else {
            useTerminalStore.getState().setDragOverPane(null, null);
          }
        }
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);

        if (isDraggingRef.current) {
          const from = dragIndexRef.current;
          const to = dropIndexRef.current;

          const s = useTerminalStore.getState();

          if (from !== null && to !== null && from !== to) {
            
            s.reorderTabs(from, to);
          } else if (s.dragOverPaneId && s.dragOverZone && s.draggingTabId) {
            
            s.mergeTabIntoPane(s.draggingTabId, s.dragOverPaneId, s.dragOverZone);
          }

          
          s.setDraggingTab(null);
          s.setDragOverPane(null, null);
        }

        setDragIndex(null);
        setDropIndex(null);
        isDraggingRef.current = false;
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
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
  powershell: <SquareTerminal {...ICON_SM} />,
  cmd: <MonitorDot {...ICON_SM} />,
  gitbash: <Hash {...ICON_SM} />,
  wsl: <Terminal {...ICON_SM} />,
  bash: <Terminal {...ICON_SM} />,
  zsh: <Terminal {...ICON_SM} />,
  fish: <Terminal {...ICON_SM} />,
  sh: <Terminal {...ICON_SM} />,
  ssh: <Terminal {...ICON_SM} />,
  sftp: <HardDrive {...ICON_SM} />,
};

/** "+" opens a tab with the default shell; the chevron menu picks another shell. */
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
  const tooltipSide = isVertical ? "right" : "bottom";

  return (
    <div className={cn("flex shrink-0 items-center gap-0.5", isVertical ? "w-full justify-center py-1" : "pl-1")}>
      <IconButton
        label={`New tab (${defaultShell.label})`}
        icon={<Plus {...ICON_SM} />}
        shortcut={shortcutFor("new-tab")}
        tooltipSide={tooltipSide}
        onClick={() => onAdd(defaultShell.type, defaultShell.path)}
      />
      <Menu>
        <MenuTrigger asChild>
          <IconButton label="Choose shell" icon={<ChevronDown {...ICON_SM} />} size="xs" tooltipSide={tooltipSide} />
        </MenuTrigger>
        <MenuContent align="start" side={isVertical ? "right" : "bottom"}>
          <MenuLabel>New tab with</MenuLabel>
          {shells.map((shell, i) => (
            <MenuItem
              key={`${shell.type}-${i}`}
              icon={SHELL_ICONS[shell.type] ?? <Terminal {...ICON_SM} />}
              onSelect={() => onAdd(shell.type, shell.path)}
            >
              {shell.label}
              {shell.path === defaultShell.path && <span className="text-caption text-fg-muted">default</span>}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
    </div>
  );
}
