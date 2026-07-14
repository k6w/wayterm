import { Terminal, Monitor } from "lucide-react";
import { useTerminalStore } from "../../stores/terminal";
import { useSettingsStore } from "../../stores/settings";
import { getPreferredShell } from "../../lib/shell-detect";

interface QuickActionsProps {
  onNewSsh?: () => void;
}

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

export default function QuickActions({ onNewSsh }: QuickActionsProps) {
  const addTab = useTerminalStore((s) => s.addTab);
  const toggleSidebar = useTerminalStore((s) => s.toggleSidebar);
  const defaultShellPath = useSettingsStore((s) => s.settings.general.defaultShell);

  const actions: QuickAction[] = [
    {
      icon: <Terminal size={16} />,
      label: "New Tab",
      onClick: () => {
        const shell = getPreferredShell(defaultShellPath);
        addTab(shell.type, shell.path);
        toggleSidebar();
      },
    },
    {
      icon: <Monitor size={16} />,
      label: "New SSH",
      onClick: () => {
        toggleSidebar();
        onNewSsh?.();
      },
    },
  ];

  return (
    <div className="px-3 py-3">
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className="flex flex-col items-center gap-1.5 rounded-lg bg-overlay/[0.08] px-2 py-2.5 text-text-secondary transition-colors hover:bg-overlay/[0.14] hover:text-text-primary"
          >
            {action.icon}
            <span className="text-[11px] leading-none">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
