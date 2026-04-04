import { useCallback, useRef, useState, useEffect } from "react";
import { Plus, Terminal, MonitorDot, Hash, SquareTerminal, HardDrive } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useTerminalStore } from "../../stores/terminal";
import { useThemeStore } from "../../stores/theme";
import { useSettingsStore } from "../../stores/settings";
import { hexToRgba } from "../../lib/color";
import { vibrancyAlpha } from "../../lib/platform";
import { getPreferredShell, getDefaultShells } from "../../lib/shell-detect";
import type { ShellType } from "../../types/terminal";
import type { DropZone } from "../../stores/terminal";
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
    <div data-tauri-drag-region className={`flex min-w-0 items-center ${
      isVertical ? 'flex-col w-full flex-1 overflow-y-auto' : 'h-full flex-1 overflow-x-auto'
    }`}>
      <div data-tauri-drag-region className={`flex items-center scrollbar-none ${
        isVertical ? 'flex-col w-full' : 'h-full'
      }`}>
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
              onClick={setActiveTab}
              onClose={removeTab}
              onRename={handleRename}
              isVertical={isVertical}
            />
          ))}
        </AnimatePresence>
      </div>
      <NewTabButton onAdd={addTab} isVertical={isVertical} />
      <div data-tauri-drag-region className={`shrink-0 ${
        isVertical ? 'w-full flex-1 min-h-[20px]' : 'h-full flex-1 min-w-[20px]'
      }`} />
    </div>
  );
}


const SHELL_ICONS: Record<string, React.ReactNode> = {
  powershell: <SquareTerminal size={14} />,
  cmd: <MonitorDot size={14} />,
  gitbash: <Hash size={14} />,
  wsl: <Terminal size={14} />,
  bash: <Terminal size={14} />,
  zsh: <Terminal size={14} />,
  fish: <Terminal size={14} />,
  sh: <Terminal size={14} />,
  ssh: <Terminal size={14} />,
  sftp: <HardDrive size={14} />,
};

function NewTabButton({ onAdd, isVertical }: { onAdd: (type: ShellType, path?: string) => void; isVertical: boolean }) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ntTheme = useThemeStore((s) => s.active);
  const ntVibrancy = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const ntOpacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);
  const ntMenuBg = ntVibrancy
    ? hexToRgba(ntTheme.ui.bgSecondary, vibrancyAlpha(ntOpacity) * 0.85)
    : ntTheme.ui.bgSecondary;

  const shells = getDefaultShells();
  const defaultShellSetting = useSettingsStore((s) => s.settings.general.defaultShell);
  const defaultShell = getPreferredShell(defaultShellSetting);

  const handleEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), 250);
  };

  const handleLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(false), 200);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative shrink-0 ${
        isVertical ? 'w-full' : ''
      }`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        className={`flex items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary ${
          isVertical ? 'w-full h-10 my-1' : 'size-7'
        }`}
        onClick={() => {
          onAdd(defaultShell.type, defaultShell.path);
          setOpen(false);
        }}
        title={`New tab (${defaultShell.label})`}
      >
        <Plus className="size-3.5" />
        {isVertical && <span className="ml-2 text-xs">New Tab</span>}
      </button>

      {open && (
        <div
          className={`absolute z-[200] min-w-[170px] rounded-lg border border-border py-1 shadow-xl ${
            isVertical ? 'left-full top-0 ml-2' : 'top-full left-0 mt-1'
          }`}
          style={{
            backgroundColor: ntMenuBg,
            backdropFilter: ntVibrancy ? "blur(20px) saturate(1.3)" : undefined,
            WebkitBackdropFilter: ntVibrancy ? "blur(20px) saturate(1.3)" : undefined,
          }}
          onMouseEnter={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
          }}
          onMouseLeave={handleLeave}
        >
          {shells.map((shell, i) => (
            <button
              key={`${shell.type}-${i}`}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs text-text-primary transition-colors hover:bg-bg-tertiary"
              onClick={() => {
                onAdd(shell.type, shell.path);
                setOpen(false);
              }}
            >
              <span className="text-text-muted">
                {SHELL_ICONS[shell.type] ?? <Terminal size={14} />}
              </span>
              <span>{shell.label}</span>
              {shell.type === defaultShell.type && i === 0 && (
                <span className="ml-auto text-[10px] text-text-muted/60">default</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
