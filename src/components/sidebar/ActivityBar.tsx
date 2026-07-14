import { Server, GitBranch, Database, Clipboard, Route, Settings } from "lucide-react";
import { useTerminalStore } from "../../stores/terminal";
import { useSettingsStore } from "../../stores/settings";
import { useThemeStore } from "../../stores/theme";
import { hexToRgba } from "../../lib/color";
import { vibrancyAlpha } from "../../lib/platform";

type SidebarSection = 'connections' | 'git' | 'database' | 'clipboard' | 'tunnels';

const SECTIONS: { id: SidebarSection; icon: typeof Server; label: string }[] = [
  { id: 'connections', icon: Server,    label: 'Connections' },
  { id: 'git',        icon: GitBranch, label: 'Git' },
  { id: 'database',  icon: Database,  label: 'Database' },
  { id: 'clipboard', icon: Clipboard, label: 'Clipboard' },
  { id: 'tunnels',   icon: Route,     label: 'Port Forwards' },
];

export default function ActivityBar() {
  const activeSidebarSection = useTerminalStore((s) => s.activeSidebarSection);
  const setSidebarSection = useTerminalStore((s) => s.setSidebarSection);
  const toggleSettings = useTerminalStore((s) => s.toggleSettings);
  const vibrancyEnabled = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const windowOpacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);
  const theme = useThemeStore((s) => s.active);

  return (
    <div
      // w-11 (44px) icon rail. Sidebar overlay panel is 320px; vertical title
      // bar is 200px — independent chrome constants.
      className={`flex flex-col shrink-0 w-11 border-r border-border ${vibrancyEnabled ? "" : "bg-bg-secondary"}`}
      style={vibrancyEnabled ? { backgroundColor: hexToRgba(theme.ui.bgSecondary, vibrancyAlpha(windowOpacity)) } : undefined}
    >
      <div className="flex flex-col gap-0.5 py-2 px-1">
        {SECTIONS.map(({ id, icon: Icon, label }) => {
          const active = activeSidebarSection === id;
          return (
            <button
              key={id}
              title={label}
              aria-label={label}
              onClick={() => setSidebarSection(active ? null : id)}
              className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                active
                  ? "bg-accent/10 text-accent"
                  : "text-text-muted hover:bg-overlay/[0.06] hover:text-text-primary"
              }`}
            >
              {active && (
                <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-accent rounded-r-full" />
              )}
              <Icon size={17} strokeWidth={active ? 2.2 : 1.7} />
            </button>
          );
        })}
      </div>

      <div className="mt-auto py-2 px-1">
        <button
          title="Settings"
          aria-label="Settings"
          onClick={toggleSettings}
          className="flex items-center justify-center w-9 h-9 rounded-lg text-text-muted hover:bg-overlay/[0.06] hover:text-text-primary transition-colors"
        >
          <Settings size={17} strokeWidth={1.7} />
        </button>
      </div>
    </div>
  );
}
