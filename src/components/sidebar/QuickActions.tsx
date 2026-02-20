import { Terminal, Monitor, Settings } from "lucide-react";
import { useTerminalStore } from "../../stores/terminal";
import { getDefaultShell } from "../../lib/shell-detect";

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
  const toggleSettings = useTerminalStore((s) => s.toggleSettings);
  const toggleSidebar = useTerminalStore((s) => s.toggleSidebar);

  const actions: QuickAction[] = [
    {
      icon: <Terminal size={16} />,
      label: "New Tab",
      onClick: () => {
        const shell = getDefaultShell();
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
    {
      icon: <Settings size={16} />,
      label: "Settings",
      onClick: () => {
        toggleSidebar();
        toggleSettings();
      },
    },
  ];

  return (
    <div className="px-3 py-3">
      <div className="grid grid-cols-3 gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className="flex flex-col items-center gap-1.5 rounded-lg bg-white/[0.08] px-2 py-2.5 text-text-secondary transition-colors hover:bg-white/[0.14] hover:text-text-primary"
          >
            {action.icon}
            <span className="text-[11px] leading-none">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
