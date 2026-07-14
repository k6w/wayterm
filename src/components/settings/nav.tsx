import type { ComponentType } from "react";
import {
  Settings,
  Palette,
  Terminal,
  Keyboard,
  Monitor,
  KeyRound,
  User,
  Code2,
  History,
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

export type PanelId =
  | "general"
  | "appearance"
  | "terminal"
  | "keybindings"
  | "ssh"
  | "keys"
  | "profiles"
  | "snippets"
  | "history";

export interface NavItem {
  id: PanelId;
  label: string;
  icon: ComponentType<{ size?: number }>;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Application",
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
    title: "Data",
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

export const PANEL_LABEL: Record<PanelId, string> = NAV_GROUPS.flatMap(
  (g) => g.items
).reduce(
  (acc, item) => {
    acc[item.id] = item.label;
    return acc;
  },
  {} as Record<PanelId, string>
);
