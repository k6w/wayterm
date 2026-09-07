import type { ComponentType } from "react";
import { Icons, type IconComponent } from "../../ui/icons";
import GeneralPanel from "./GeneralPanel";
import AppearancePanel from "./AppearancePanel";
import TerminalPanel from "./TerminalPanel";
import KeybindingsPanel from "./KeybindingsPanel";
import SshPanel from "./SshPanel";
import KeysPanel from "./KeysPanel";
import ProfilesPanel from "./ProfilesPanel";
import SnippetsPanel from "./SnippetsPanel";
import AuditLogPanel from "./AuditLogPanel";

/** Panel ids. `openSettings(panel)` deep links use them ("ssh" from the SFTP pane), so never rename one. */
export const PANEL_IDS = [
  "general",
  "appearance",
  "keybindings",
  "terminal",
  "profiles",
  "snippets",
  "ssh",
  "keys",
  "history",
] as const;

export type PanelId = (typeof PANEL_IDS)[number];

export function isPanelId(value: string): value is PanelId {
  return (PANEL_IDS as readonly string[]).includes(value);
}

export interface NavItem {
  id: PanelId;
  label: string;
  icon: IconComponent;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "App",
    items: [
      { id: "general", label: "General", icon: Icons.generalSettings },
      { id: "appearance", label: "Appearance", icon: Icons.appearanceSettings },
      { id: "keybindings", label: "Keybindings", icon: Icons.keyboard },
    ],
  },
  {
    title: "Terminal",
    items: [
      { id: "terminal", label: "Terminal", icon: Icons.terminalSettings },
      { id: "profiles", label: "Profiles", icon: Icons.profile },
      { id: "snippets", label: "Snippets", icon: Icons.snippets },
    ],
  },
  {
    title: "Connections",
    items: [
      { id: "ssh", label: "SSH", icon: Icons.sshSettings },
      { id: "keys", label: "Keys", icon: Icons.keysSettings },
    ],
  },
  {
    title: "Advanced",
    items: [{ id: "history", label: "History", icon: Icons.historySettings }],
  },
];

export const PANELS: Record<PanelId, ComponentType> = {
  general: GeneralPanel,
  appearance: AppearancePanel,
  terminal: TerminalPanel,
  keybindings: KeybindingsPanel,
  ssh: SshPanel,
  keys: KeysPanel,
  profiles: ProfilesPanel,
  snippets: SnippetsPanel,
  history: AuditLogPanel,
};

export const PANEL_LABEL = Object.fromEntries(
  NAV_GROUPS.flatMap((group) => group.items).map((item) => [item.id, item.label])
) as Record<PanelId, string>;
