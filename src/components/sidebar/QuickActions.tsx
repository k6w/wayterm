import { Plus, SquareTerminal } from "lucide-react";
import { useTerminalStore } from "../../stores/terminal";
import { useSettingsStore } from "../../stores/settings";
import { getPreferredShell } from "../../lib/shell-detect";
import { shortcutFor } from "../../lib/shortcut-hints";
import { Button, ICON_SM, IconButton, ToolbarButton } from "../../ui";
import { PanelToolbar } from "./PanelChrome";

interface QuickActionsProps {
  onNewSsh?: () => void;
}

/** The Connections panel's action row: new local terminal, new SSH connection. */
export default function QuickActions({ onNewSsh }: QuickActionsProps) {
  const addTab = useTerminalStore((s) => s.addTab);
  const defaultShellPath = useSettingsStore((s) => s.settings.general.defaultShell);

  return (
    <PanelToolbar aria-label="Connection actions">
      <ToolbarButton>
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<SquareTerminal {...ICON_SM} />}
          shortcut={shortcutFor("new-tab")}
          onClick={() => {
            const shell = getPreferredShell(defaultShellPath);
            addTab(shell.type, shell.path);
          }}
        >
          New terminal
        </Button>
      </ToolbarButton>
      <ToolbarButton>
        <IconButton label="New SSH" icon={<Plus {...ICON_SM} />} size="md" tooltipSide="bottom" onClick={() => onNewSsh?.()} />
      </ToolbarButton>
    </PanelToolbar>
  );
}
