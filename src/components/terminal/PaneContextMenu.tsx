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
  FileText,
  StopCircle,
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
import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ICON_SM } from "../../ui";

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
        icon={<Copy {...ICON_SM} />}
        shortcut="Mod+c"
        disabled={!hasSel}
        onSelect={() => copySelection(paneId)}
      >
        Copy
      </ContextMenuItem>
      <ContextMenuItem
        icon={<ClipboardPaste {...ICON_SM} />}
        shortcut="Mod+v"
        onSelect={() => {
          void pasteToTerminal(paneId);
        }}
      >
        Paste
      </ContextMenuItem>
      <ContextMenuItem icon={<TextSelect {...ICON_SM} />} shortcut="Mod+a" onSelect={() => selectAll(paneId)}>
        Select All
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem icon={<Eraser {...ICON_SM} />} shortcut="Mod+k" onSelect={() => clearBuffer(paneId)}>
        Clear Buffer
      </ContextMenuItem>
      <ContextMenuItem icon={<RotateCcw {...ICON_SM} />} onSelect={() => resetTerminal(paneId)}>
        Reset Terminal
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        icon={<Columns2 {...ICON_SM} />}
        shortcut="Mod+Shift+d"
        onSelect={() => {
          setActivePane(paneId);
          splitActivePane("horizontal");
        }}
      >
        Split Right
      </ContextMenuItem>
      <ContextMenuItem
        icon={<Rows2 {...ICON_SM} />}
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
            icon={<ExternalLink {...ICON_SM} />}
            shortcut="Mod+Shift+t"
            onSelect={() => {
              setActivePane(paneId);
              detachPaneToTab(paneId);
            }}
          >
            Detach to Tab
          </ContextMenuItem>
          <ContextMenuItem
            icon={<X {...ICON_SM} />}
            shortcut="Mod+Shift+w"
            onSelect={() => closePaneInTab(paneId)}
          >
            Close Pane
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      <ContextMenuItem
        icon={<FolderOpen {...ICON_SM} />}
        onSelect={() => {
          void navigator.clipboard.writeText(pane?.cwd || "~");
        }}
      >
        Copy Path
      </ContextMenuItem>
      <ContextMenuSeparator />
      {isLogging ? (
        <ContextMenuItem icon={<StopCircle {...ICON_SM} />} onSelect={() => onStopLog?.()}>
          Stop Session Log
        </ContextMenuItem>
      ) : (
        <ContextMenuItem icon={<FileText {...ICON_SM} />} onSelect={() => onStartLog?.()}>
          Start Session Log
        </ContextMenuItem>
      )}
    </ContextMenuContent>
  );
}
