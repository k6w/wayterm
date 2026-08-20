import type { ComponentType } from "react";
import {
  Code2,
  History,
  KeyRound,
  Keyboard,
  Monitor,
  Palette,
  Settings,
  Terminal,
  User,
  type LucideIcon,
} from "lucide-react";
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
  icon: LucideIcon;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "App",
    items: [
      { id: "general", label: "General", icon: Settings },
      { id: "appearance", label: "Appearance", icon: Palette },
      { id: "keybindings", label: "Keybindings", icon: Keyboard },
    ],
  },
  {
    title: "Terminal",
    items: [
      { id: "terminal", label: "Terminal", icon: Terminal },
      { id: "profiles", label: "Profiles", icon: User },
      { id: "snippets", label: "Snippets", icon: Code2 },
    ],
  },
  {
    title: "Connections",
    items: [
      { id: "ssh", label: "SSH", icon: Monitor },
      { id: "keys", label: "Keys", icon: KeyRound },
    ],
  },
  {
    title: "Advanced",
    items: [{ id: "history", label: "History", icon: History }],
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
