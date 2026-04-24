import { motion } from "framer-motion";
import { Terminal, Keyboard, GitBranch, Palette, Globe, FolderOpen, Zap } from "lucide-react";
import { isMac } from "../../lib/platform";

const mod = isMac ? "Cmd" : "Ctrl";

const features = [
  { icon: Terminal, title: "Split Panes", desc: `${mod}+Shift+D horizontal, ${mod}+Shift+E vertical` },
  { icon: Keyboard, title: "Command Palette", desc: `${mod}+Shift+P to access all actions` },
  { icon: Globe, title: "SSH & SFTP", desc: "Manage connections from the sidebar" },
  { icon: GitBranch, title: "Git Integration", desc: "Branch, commit, push from the sidebar" },
  { icon: Palette, title: "18 Themes", desc: "Change via command palette or settings" },
  { icon: FolderOpen, title: "Workspaces", desc: "Save and restore terminal layouts" },
  { icon: Zap, title: "Snippets", desc: "Save commands in Settings > Snippets" },
];

const shortcuts = [
  { keys: `${mod}+T`, action: "New Tab" },
  { keys: `${mod}+W`, action: "Close Tab" },
  { keys: `${mod}+B`, action: "Toggle Sidebar" },
  { keys: `${mod}+F`, action: "Search in Terminal" },
  { keys: `${mod}+Shift+Enter`, action: "Zoom Pane" },
  { keys: `${mod}+,`, action: "Settings" },
];

interface WelcomeScreenProps {
  onDismiss: () => void;
}

export function WelcomeScreen({ onDismiss }: WelcomeScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex items-center justify-center p-8"
    >
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center">
          <motion.h1
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-2xl font-semibold text-text-primary mb-2"
          >
            Welcome to Nexterm
          </motion.h1>
          <motion.p
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm text-text-muted"
          >
            A modern terminal emulator with SSH, Git, and more.
          </motion.p>
        </div>

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 gap-3"
        >
          {features.map((f, i) => (
            <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <f.icon size={16} className="text-accent mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-text-primary font-medium">{f.title}</p>
                <p className="text-xs text-text-muted">{f.desc}</p>
              </div>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Key Shortcuts</h3>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {shortcuts.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <kbd className="px-1.5 py-0.5 bg-white/[0.08] rounded text-text-muted font-mono">{s.keys}</kbd>
                <span className="text-text-secondary">{s.action}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <button
            onClick={onDismiss}
            className="px-6 py-2 bg-accent text-white text-sm rounded-lg hover:brightness-110 transition-all"
          >
            Get Started
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
