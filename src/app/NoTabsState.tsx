import { Icon } from "../ui/icons";
import { useTerminalStore } from "../stores/terminal";
import { shortcutFor } from "../lib/shortcut-hints";
import { Button, EmptyState } from "../ui";

interface NoTabsStateProps {
  onNewTerminal: () => void;
  onNewSsh: () => void;
}

/** Shown in the terminal area when every tab is closed. */
export default function NoTabsState({ onNewTerminal, onNewSsh }: NoTabsStateProps) {
  const toggleCommandPalette = useTerminalStore((s) => s.toggleCommandPalette);

  return (
    <div className="flex h-full w-full items-center justify-center">
      <EmptyState
        icon={<Icon name="terminal" size={32} strokeWidth={1.5} />}
        title="No open tabs"
        description="Start a terminal, connect to a server, or search every command."
        action={
          <div className="flex w-60 flex-col items-stretch gap-2">
            <Button
              className="w-full"
              leadingIcon={<Icon name="add" size="sm" />}
              shortcut={shortcutFor("new-tab")}
              onClick={onNewTerminal}
            >
              New terminal
            </Button>
            <Button className="w-full" leadingIcon={<Icon name="remote" size="sm" />} onClick={onNewSsh}>
              New SSH connection
            </Button>
            <Button
              className="w-full"
              leadingIcon={<Icon name="command" size="sm" />}
              shortcut={shortcutFor("command-palette")}
              onClick={toggleCommandPalette}
            >
              Command palette
            </Button>
          </div>
        }
      />
    </div>
  );
}
