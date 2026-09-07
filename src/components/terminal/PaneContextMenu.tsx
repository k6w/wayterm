import { Icon } from "../../ui/icons";
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
import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "../../ui";

interface PaneContextMenuProps {
  paneId: string;
  paneCount: number;
  isLogging?: boolean;
  onStartLog?: () => void;
  onStopLog?: () => void;
  /** Called when the menu closes, to hand focus back to the terminal. */
  onRestoreFocus?: () => void;
}

/** Items of a pane's right-click menu. Rendered inside <ContextMenu> by TerminalPane. */
export default function PaneContextMenu({
  paneId,
  paneCount,
  isLogging = false,
  onStartLog,
  onStopLog,
  onRestoreFocus,
}: PaneContextMenuProps) {
  const detachPaneToTab = useTerminalStore((s) => s.detachPaneToTab);
  const closePaneInTab = useTerminalStore((s) => s.closePaneInTab);
  const setActivePane = useTerminalStore((s) => s.setActivePane);
  const pane = useTerminalStore((s) => s.panes[paneId]);

  const hasSel = hasSelection(paneId);

  return (
    <ContextMenuContent
      className="min-w-52"
      // The pane wrapper re-focuses the terminal on mousedown; the portal bubbles React events to it.
      onMouseDown={(event) => event.stopPropagation()}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onRestoreFocus?.();
      }}
    >
      <ContextMenuItem
        icon={<Icon name="copy" size="sm" />}
        shortcut="Mod+c"
        disabled={!hasSel}
        onSelect={() => copySelection(paneId)}
      >
        Copy
      </ContextMenuItem>
      <ContextMenuItem
        icon={<Icon name="paste" size="sm" />}
        shortcut="Mod+v"
        onSelect={() => {
          void pasteToTerminal(paneId);
        }}
      >
        Paste
      </ContextMenuItem>
      <ContextMenuItem icon={<Icon name="selectAll" size="sm" />} shortcut="Mod+a" onSelect={() => selectAll(paneId)}>
        Select All
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem icon={<Icon name="clear" size="sm" />} shortcut="Mod+k" onSelect={() => clearBuffer(paneId)}>
        Clear Buffer
      </ContextMenuItem>
      <ContextMenuItem icon={<Icon name="reset" size="sm" />} onSelect={() => resetTerminal(paneId)}>
        Reset Terminal
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        icon={<Icon name="splitHorizontal" size="sm" />}
        shortcut="Mod+Shift+d"
        onSelect={() => {
          setActivePane(paneId);
          splitActivePane("horizontal");
        }}
      >
        Split Right
      </ContextMenuItem>
      <ContextMenuItem
        icon={<Icon name="splitVertical" size="sm" />}
        shortcut="Mod+Shift+e"
        onSelect={() => {
          setActivePane(paneId);
          splitActivePane("vertical");
        }}
      >
        Split Down
      </ContextMenuItem>
      <ContextMenuSeparator />
      {paneCount > 1 && (
        <>
          <ContextMenuItem
            icon={<Icon name="detach" size="sm" />}
            shortcut="Mod+Shift+t"
            onSelect={() => {
              setActivePane(paneId);
              detachPaneToTab(paneId);
            }}
          >
            Detach to Tab
          </ContextMenuItem>
          <ContextMenuItem
            icon={<Icon name="close" size="sm" />}
            shortcut="Mod+Shift+w"
            onSelect={() => closePaneInTab(paneId)}
          >
            Close Pane
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      <ContextMenuItem
        icon={<Icon name="folderOpen" size="sm" />}
        onSelect={() => {
          void navigator.clipboard.writeText(pane?.cwd || "~");
        }}
      >
        Copy Path
      </ContextMenuItem>
      <ContextMenuSeparator />
      {isLogging ? (
        <ContextMenuItem icon={<Icon name="stop" size="sm" />} onSelect={() => onStopLog?.()}>
          Stop Session Log
        </ContextMenuItem>
      ) : (
        <ContextMenuItem icon={<Icon name="log" size="sm" />} onSelect={() => onStartLog?.()}>
          Start Session Log
        </ContextMenuItem>
      )}
    </ContextMenuContent>
  );
}
