import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Settings,
  Palette,
  Terminal,
  Keyboard,
  Monitor,
  User,
  KeyRound,
} from "lucide-react";
import { useTerminalStore } from "../../stores/terminal";
import GeneralPanel from "./GeneralPanel";
import AppearancePanel from "./AppearancePanel";
import TerminalPanel from "./TerminalPanel";
import KeybindingsPanel from "./KeybindingsPanel";
import SshPanel from "./SshPanel";
import KeysPanel from "./KeysPanel";
import ProfilesPanel from "./ProfilesPanel";

type PanelId = "general" | "appearance" | "terminal" | "keybindings" | "ssh" | "keys" | "profiles";

interface NavItem {
  id: PanelId;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}

const navItems: NavItem[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "terminal", label: "Terminal", icon: Terminal },
  { id: "keybindings", label: "Keybindings", icon: Keyboard },
  { id: "ssh", label: "SSH", icon: Monitor },
  { id: "keys", label: "Keys", icon: KeyRound },
  { id: "profiles", label: "Profiles", icon: User },
];

const panels: Record<PanelId, React.ComponentType> = {
  general: GeneralPanel,
  appearance: AppearancePanel,
  terminal: TerminalPanel,
  keybindings: KeybindingsPanel,
  ssh: SshPanel,
  keys: KeysPanel,
  profiles: ProfilesPanel,
};

export default function SettingsModal() {
  const settingsOpen = useTerminalStore((s) => s.settingsOpen);
  const toggleSettings = useTerminalStore((s) => s.toggleSettings);
  const [activePanel, setActivePanel] = useState<PanelId>("general");

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && settingsOpen) {
        toggleSettings();
      }
    },
    [settingsOpen, toggleSettings]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  const ActivePanel = panels[activePanel];

  return (
    <AnimatePresence>
      {settingsOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={toggleSettings}
        >
          <motion.div
            className="relative flex w-[768px] h-[540px] rounded-xl bg-bg-primary border border-border overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="w-[200px] shrink-0 border-r border-border bg-bg-secondary p-3 flex flex-col gap-1">
              <div className="text-xs font-medium text-text-muted uppercase tracking-wider px-3 py-2">
                Settings
              </div>
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActivePanel(item.id)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors w-full text-left ${
                      activePanel === item.id
                        ? "bg-accent/15 text-accent"
                        : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
                    }`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="flex-1 min-w-0 flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                <h2 className="text-base font-medium text-text-primary">
                  {navItems.find((n) => n.id === activePanel)?.label}
                </h2>
                <button
                  onClick={toggleSettings}
                  className="p-1 text-text-muted hover:text-text-primary transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activePanel}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15, ease: "easeInOut" }}
                    className="p-6"
                  >
                    <ActivePanel />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
