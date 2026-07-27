import { PanelLeftClose } from "lucide-react";
import { useSidebarStore } from "../../stores/sidebar";
import { shortcutFor } from "../../lib/shortcut-hints";
import { ICON_SM, IconButton, Toolbar, ToolbarButton } from "../../ui";
import QuickActions from "./QuickActions";
import ConnectionTree from "./ConnectionTree";
import WorkspaceList from "./WorkspaceList";
import TunnelsPanel from "./TunnelsPanel";
import { GitPanel } from "../git/GitPanel";
import { DatabasePanel } from "../database/DatabasePanel";
import { ClipboardPanel } from "../ui/ClipboardPanel";
import { SIDEBAR_SECTIONS } from "./sections";
import type { SshConnection } from "../../types/ssh";

interface SidebarProps {
  onNewSsh?: () => void;
  onEditSsh?: (conn: SshConnection) => void;
}

/**
 * Docked side panel: a header with the panel name and a hide button, then the
 * panel content. The content components are restyled in Phase 4.
 */
export default function Sidebar({ onNewSsh, onEditSsh }: SidebarProps) {
  const section = useSidebarStore((s) => s.section);
  const toggle = useSidebarStore((s) => s.toggle);
  const info = SIDEBAR_SECTIONS.find((s) => s.id === section) ?? SIDEBAR_SECTIONS[0];

  return (
    <aside aria-label={info.label} className="nx-blur flex h-full flex-col bg-panel-glass">
      <Toolbar
        aria-label={`${info.label} panel`}
        className="h-9 shrink-0 gap-1 border-b border-border pl-3 pr-1.5"
      >
        <h2 className="min-w-0 flex-1 truncate text-caption font-medium uppercase tracking-wide text-fg-muted">
          {info.label}
        </h2>
        <ToolbarButton>
          <IconButton
            label="Hide sidebar"
            icon={<PanelLeftClose {...ICON_SM} />}
            shortcut={shortcutFor("toggle-sidebar")}
            tooltipSide="bottom"
            onClick={toggle}
          />
        </ToolbarButton>
      </Toolbar>
      <div className="flex min-h-0 flex-1 flex-col">
        {section === "connections" && (
          <>
            <QuickActions onNewSsh={onNewSsh} />
            <div className="mx-3 shrink-0 border-t border-border" />
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              <ConnectionTree onAddConnection={onNewSsh} onEditConnection={onEditSsh} />
            </div>
            <div className="mx-3 shrink-0 border-t border-border" />
            <div className="shrink-0 py-1">
              <WorkspaceList />
            </div>
          </>
        )}
        {section === "git" && <GitPanel />}
        {section === "database" && <DatabasePanel />}
        {section === "clipboard" && <ClipboardPanel />}
        {section === "tunnels" && <TunnelsPanel />}
      </div>
    </aside>
  );
}
