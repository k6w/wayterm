import type { CSSProperties } from "react";
import { Icon } from "../../ui/icons";
import { useTerminalStore, collectPaneIds } from "../../stores/terminal";
import { splitActivePane } from "../../lib/keybindings";
import { shortcutFor } from "../../lib/shortcut-hints";
import { TAB_TAG_COLORS } from "../../themes/tab-tags";
import { ContextMenuContent, ContextMenuItem, ContextMenuRadioGroup, ContextMenuRadioItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger } from "../../ui";

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
      <ContextMenuItem icon={<Icon name="edit" size="sm" />} shortcut="F2" onSelect={onStartRename}>
        Rename Tab
      </ContextMenuItem>
      <ContextMenuItem icon={<Icon name="copy" size="sm" />} onSelect={() => duplicateTab(tabId)}>
        Duplicate Tab
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem icon={<Icon name="close" size="sm" />} shortcut={shortcutFor("close-tab")} onSelect={() => removeTab(tabId)}>
        Close Tab
      </ContextMenuItem>
      <ContextMenuItem
        icon={<Icon name="closeAll" size="sm" />}
        disabled={tabCount <= 1}
        onSelect={() => closeOtherTabs(tabId)}
      >
        Close Other Tabs
      </ContextMenuItem>
      <ContextMenuItem
        icon={<Icon name="closeToRight" size="sm" />}
        disabled={isLast}
        onSelect={() => closeTabsToRight(tabId)}
      >
        Close Tabs to Right
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        icon={<Icon name="splitHorizontal" size="sm" />}
        shortcut={shortcutFor("split-horizontal")}
        onSelect={() => {
          setActiveTab(tabId);
          splitActivePane("horizontal");
        }}
      >
        Split Right
      </ContextMenuItem>
      <ContextMenuItem
        icon={<Icon name="splitVertical" size="sm" />}
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
        icon={<Icon name="moveLeft" size="sm" />}
        disabled={tabIndex === 0}
        onSelect={() => reorderTabs(tabIndex, tabIndex - 1)}
      >
        Move Left
      </ContextMenuItem>
      <ContextMenuItem
        icon={<Icon name="moveRight" size="sm" />}
        disabled={isLast}
        onSelect={() => reorderTabs(tabIndex, tabIndex + 1)}
      >
        Move Right
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        icon={<Icon name="folderOpen" size="sm" />}
        onSelect={() => {
          void navigator.clipboard?.writeText(firstPane?.cwd || "~");
        }}
      >
        Copy Path
      </ContextMenuItem>
      <ContextMenuSub>
        <ContextMenuSubTrigger icon={<Icon name="theme" size="sm" />}>Set Color</ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuRadioGroup
            value={currentColor ?? ""}
            onValueChange={(value) => setTabColor(tabId, value || null)}
          >
            {TAB_TAG_COLORS.map((color) => (
              <ContextMenuRadioItem key={color.value} value={color.value}>
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full bg-(--wt-dyn-tag)"
                  style={{ "--wt-dyn-tag": color.value } as CSSProperties}
                />
                {color.label}
              </ContextMenuRadioItem>
            ))}
          </ContextMenuRadioGroup>
          <ContextMenuSeparator />
          <ContextMenuItem
            icon={<Icon name="closeOthers" size="sm" />}
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
