import type { CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightToLine,
  Ban,
  Columns2,
  Copy,
  FolderOpen,
  Palette,
  Pencil,
  Rows2,
  X,
  XCircle,
} from "lucide-react";
import { useTerminalStore, collectPaneIds } from "../../stores/terminal";
import { splitActivePane } from "../../lib/keybindings";
import { shortcutFor } from "../../lib/shortcut-hints";
import { TAB_TAG_COLORS } from "../../themes/tab-tags";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ICON_SM,
} from "../../ui";

interface TabContextMenuContentProps {
  tabId: string;
  tabIndex: number;
  onStartRename: () => void;
}

/** Items of a tab's right-click menu. Rendered inside <ContextMenu> by Tab. */
export default function TabContextMenuContent({ tabId, tabIndex, onStartRename }: TabContextMenuContentProps) {
  const tabs = useTerminalStore((s) => s.tabs);
  const panes = useTerminalStore((s) => s.panes);
  const removeTab = useTerminalStore((s) => s.removeTab);
  const setActiveTab = useTerminalStore((s) => s.setActiveTab);
  const duplicateTab = useTerminalStore((s) => s.duplicateTab);
  const closeOtherTabs = useTerminalStore((s) => s.closeOtherTabs);
  const closeTabsToRight = useTerminalStore((s) => s.closeTabsToRight);
  const reorderTabs = useTerminalStore((s) => s.reorderTabs);
  const setTabColor = useTerminalStore((s) => s.setTabColor);

  const tabCount = tabs.length;
  const tab = tabs.find((t) => t.id === tabId);
  const firstPaneId = tab ? collectPaneIds(tab.panes)[0] : null;
  const firstPane = firstPaneId ? panes[firstPaneId] : null;
  const currentColor = tab?.colorTag ?? null;
  const isLast = tabIndex >= tabCount - 1;

  return (
    // Keep focus where the action put it (e.g. the rename input), not on the tab.
    <ContextMenuContent className="min-w-52" onCloseAutoFocus={(event) => event.preventDefault()}>
      <ContextMenuItem icon={<Pencil {...ICON_SM} />} shortcut="F2" onSelect={onStartRename}>
        Rename Tab
      </ContextMenuItem>
      <ContextMenuItem icon={<Copy {...ICON_SM} />} onSelect={() => duplicateTab(tabId)}>
        Duplicate Tab
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem icon={<X {...ICON_SM} />} shortcut={shortcutFor("close-tab")} onSelect={() => removeTab(tabId)}>
        Close Tab
      </ContextMenuItem>
      <ContextMenuItem
        icon={<XCircle {...ICON_SM} />}
        disabled={tabCount <= 1}
        onSelect={() => closeOtherTabs(tabId)}
      >
        Close Other Tabs
      </ContextMenuItem>
      <ContextMenuItem
        icon={<ArrowRightToLine {...ICON_SM} />}
        disabled={isLast}
        onSelect={() => closeTabsToRight(tabId)}
      >
        Close Tabs to Right
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        icon={<Columns2 {...ICON_SM} />}
        shortcut={shortcutFor("split-horizontal")}
        onSelect={() => {
          setActiveTab(tabId);
          splitActivePane("horizontal");
        }}
      >
        Split Right
      </ContextMenuItem>
      <ContextMenuItem
        icon={<Rows2 {...ICON_SM} />}
        shortcut={shortcutFor("split-vertical")}
        onSelect={() => {
          setActiveTab(tabId);
          splitActivePane("vertical");
        }}
      >
        Split Down
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        icon={<ArrowLeft {...ICON_SM} />}
        disabled={tabIndex === 0}
        onSelect={() => reorderTabs(tabIndex, tabIndex - 1)}
      >
        Move Left
      </ContextMenuItem>
      <ContextMenuItem
        icon={<ArrowRight {...ICON_SM} />}
        disabled={isLast}
        onSelect={() => reorderTabs(tabIndex, tabIndex + 1)}
      >
        Move Right
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        icon={<FolderOpen {...ICON_SM} />}
        onSelect={() => {
          void navigator.clipboard?.writeText(firstPane?.cwd || "~");
        }}
      >
        Copy Path
      </ContextMenuItem>
      <ContextMenuSub>
        <ContextMenuSubTrigger icon={<Palette {...ICON_SM} />}>Set Color</ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuRadioGroup
            value={currentColor ?? ""}
            onValueChange={(value) => setTabColor(tabId, value || null)}
          >
            {TAB_TAG_COLORS.map((color) => (
              <ContextMenuRadioItem key={color.value} value={color.value}>
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full bg-(--nx-dyn-tag)"
                  style={{ "--nx-dyn-tag": color.value } as CSSProperties}
                />
                {color.label}
              </ContextMenuRadioItem>
            ))}
          </ContextMenuRadioGroup>
          <ContextMenuSeparator />
          <ContextMenuItem
            icon={<Ban {...ICON_SM} />}
            disabled={!currentColor}
            onSelect={() => setTabColor(tabId, null)}
          >
            Remove Color
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
    </ContextMenuContent>
  );
}
