import { Command, Monitor, Plus, Terminal } from "lucide-react";
import { useTerminalStore } from "../stores/terminal";
import { shortcutFor } from "../lib/shortcut-hints";
import { Button, EmptyState, ICON_SM } from "../ui";

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
        icon={<Terminal size={32} strokeWidth={1.5} />}
        title="No open tabs"
        description="Start a terminal, connect to a server, or search every command."
        action={
          <div className="flex w-60 flex-col items-stretch gap-2">
            <Button
              className="w-full"
              leadingIcon={<Plus {...ICON_SM} />}
              shortcut={shortcutFor("new-tab")}
              onClick={onNewTerminal}
            >
              New terminal
            </Button>
            <Button className="w-full" leadingIcon={<Monitor {...ICON_SM} />} onClick={onNewSsh}>
              New SSH connection
            </Button>
            <Button
              className="w-full"
              leadingIcon={<Command {...ICON_SM} />}
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
