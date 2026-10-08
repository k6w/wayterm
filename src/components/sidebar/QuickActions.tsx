import { Icon } from "../../ui/icons";
import { useTerminalStore } from "../../stores/terminal";
import { useSettingsStore } from "../../stores/settings";
import { getPreferredShell } from "../../lib/shell-detect";
import { shortcutFor } from "../../lib/shortcut-hints";
import { IconButton, ToolbarButton } from "../../ui";
import { openSshConfigImport } from "../ssh/ssh-config-import";
import { PanelButton, PanelToolbar } from "./PanelChrome";

interface QuickActionsProps {
  onNewSsh?: () => void;
}

/** The Connections panel's action row: new local terminal, new SSH connection, import from ~/.ssh/config. */
export default function QuickActions({ onNewSsh }: QuickActionsProps) {
  const addTab = useTerminalStore((s) => s.addTab);
  const defaultShellPath = useSettingsStore((s) => s.settings.general.defaultShell);

  return (
    <PanelToolbar aria-label="Connection actions">
      <ToolbarButton>
        <PanelButton
          variant="ghost"
          label="New terminal"
          icon={<Icon name="newTerminal" size="sm" />}
          shortcut={shortcutFor("new-tab")}
          onClick={() => {
            const shell = getPreferredShell(defaultShellPath);
            addTab(shell.type, shell.path);
          }}
        />
      </ToolbarButton>
      <ToolbarButton>
        <IconButton label="New SSH" icon={<Icon name="add" size="sm" />} size="md" tooltipSide="bottom" onClick={() => onNewSsh?.()} />
      </ToolbarButton>
      <ToolbarButton>
        <IconButton
          label="Import from ~/.ssh/config"
          icon={<Icon name="importSshConfig" size="sm" />}
          size="md"
          tooltipSide="bottom"
          onClick={openSshConfigImport}
        />
      </ToolbarButton>
    </PanelToolbar>
  );
}
