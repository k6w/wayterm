import { Icons, type IconComponent } from "../../ui/icons";
import type { SidebarSection } from "../../stores/sidebar";

export interface SidebarSectionInfo {
  id: SidebarSection;
  label: string;
  icon: IconComponent;
  /** Keybinding action id that opens this panel, if one exists. */
  shortcutId?: string;
}

/** The side panels, in activity-bar order. */
export const SIDEBAR_SECTIONS: readonly SidebarSectionInfo[] = [
  { id: "connections", label: "Connections", icon: Icons.server },
  { id: "git", label: "Git", icon: Icons.gitBranch },
  { id: "database", label: "Database", icon: Icons.database },
  { id: "clipboard", label: "Clipboard", icon: Icons.clipboard, shortcutId: "clipboard-manager" },
  { id: "tunnels", label: "Port Forwards", icon: Icons.portForward },
];
