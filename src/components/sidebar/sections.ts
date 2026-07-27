import { Clipboard, Database, GitBranch, Route, Server, type LucideIcon } from "lucide-react";
import type { SidebarSection } from "../../stores/sidebar";

export interface SidebarSectionInfo {
  id: SidebarSection;
  label: string;
  icon: LucideIcon;
  /** Keybinding action id that opens this panel, if one exists. */
  shortcutId?: string;
}

/** The side panels, in activity-bar order. */
export const SIDEBAR_SECTIONS: readonly SidebarSectionInfo[] = [
  { id: "connections", label: "Connections", icon: Server },
  { id: "git", label: "Git", icon: GitBranch },
  { id: "database", label: "Database", icon: Database },
  { id: "clipboard", label: "Clipboard", icon: Clipboard, shortcutId: "clipboard-manager" },
  { id: "tunnels", label: "Port Forwards", icon: Route },
];
