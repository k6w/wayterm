import { useTerminalStore } from "../../stores/terminal";
import { useSidebarStore } from "../../stores/sidebar";
import { shortcutFor } from "../../lib/shortcut-hints";
import { ICON_MD, IconButton, Toolbar, ToolbarButton } from "../../ui";
import { SIDEBAR_SECTIONS } from "./sections";

/**
 * 44px rail of side-panel buttons. One tab stop; Up/Down move between the
 * buttons. The panel that is showing gets a 2px accent bar.
 */
export default function ActivityBar() {
  const section = useSidebarStore((s) => s.section);
  const collapsed = useSidebarStore((s) => s.collapsed);
  const settingsOpen = useTerminalStore((s) => s.settingsOpen);
  const activate = useSidebarStore((s) => s.activate);

  return (
    <Toolbar
      orientation="vertical"
      aria-label="Side panels"
      className="nx-blur h-full w-11 shrink-0 flex-col gap-1 border-r border-border bg-panel-glass py-2"
    >
      {SIDEBAR_SECTIONS.map(({ id, label, icon: Icon, shortcutId }) => {
        const active = !settingsOpen && !collapsed && section === id;
        return (
          <div key={id} className="relative flex w-full justify-center">
            {active && (
              <span
                aria-hidden
                data-testid="activity-indicator"
                className="absolute inset-y-1 left-0 w-0.5 rounded-r-sm bg-accent"
              />
            )}
            <ToolbarButton>
              <IconButton
                size="md"
                label={label}
                icon={<Icon {...ICON_MD} />}
                shortcut={shortcutId ? shortcutFor(shortcutId) : undefined}
                pressed={active}
                tooltipSide="right"
                onClick={() => activate(id)}
              />
            </ToolbarButton>
          </div>
        );
      })}
    </Toolbar>
  );
}
