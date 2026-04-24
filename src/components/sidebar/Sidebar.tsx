import { useEffect, useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useTerminalStore } from "../../stores/terminal";
import { isMac } from "../../lib/platform";
import QuickActions from "./QuickActions";
import ConnectionTree from "./ConnectionTree";
import WorkspaceList from "./WorkspaceList";
import TunnelsPanel from "./TunnelsPanel";
import { GitPanel } from "../git/GitPanel";
import { DatabasePanel } from "../database/DatabasePanel";
import { ClipboardPanel } from "../ui/ClipboardPanel";
import type { SshConnection } from "../../types/ssh";
import { GitBranch, Database, Clipboard, Server, Route } from "lucide-react";

type View = 'connections' | 'git' | 'database' | 'clipboard' | 'tunnels';

const NAV: { id: View; icon: typeof Server; label: string }[] = [
  { id: 'connections', icon: Server,    label: 'Connections' },
  { id: 'git',        icon: GitBranch, label: 'Git' },
  { id: 'database',  icon: Database,  label: 'Database' },
  { id: 'clipboard', icon: Clipboard, label: 'Clipboard' },
  { id: 'tunnels',   icon: Route,     label: 'Port Forwards' },
];

// macOS: native traffic lights overlay the top 40 px of the window.
const MAC_TOP = "40px";

interface SidebarProps {
  onNewSsh?: () => void;
  onEditSsh?: (conn: SshConnection) => void;
}

export default function Sidebar({ onNewSsh, onEditSsh }: SidebarProps) {
  const sidebarOpen = useTerminalStore((s) => s.sidebarOpen);
  const toggleSidebar = useTerminalStore((s) => s.toggleSidebar);
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeView, setActiveView] = useState<View>('connections');

  const handleClose = useCallback(() => {
    if (sidebarOpen) toggleSidebar();
  }, [sidebarOpen, toggleSidebar]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); handleClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen, handleClose]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) handleClose();
    };
    const t = setTimeout(() => window.addEventListener("mousedown", onDown), 0);
    return () => { clearTimeout(t); window.removeEventListener("mousedown", onDown); };
  }, [sidebarOpen, handleClose]);

  const panelTop = isMac ? MAC_TOP : "0px";

  return (
    <AnimatePresence>
      {sidebarOpen && (
        <>
          <motion.div
            className="fixed inset-x-0 bottom-0 z-40 bg-black/40"
            style={{ top: panelTop }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />

          <motion.div
            ref={panelRef}
            className="fixed left-0 bottom-0 z-50 flex flex-col w-[260px] border-r border-border"
            style={{
              top: panelTop,
              backdropFilter: "blur(var(--blur-sidebar))",
              WebkitBackdropFilter: "blur(var(--blur-sidebar))",
              backgroundColor: `rgba(10, 10, 15, var(--opacity-sidebar))`,
            }}
            initial={{ x: -260 }}
            animate={{ x: 0 }}
            exit={{ x: -260 }}
            transition={{ type: "spring", stiffness: 400, damping: 32, mass: 0.8 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <span className="text-sm font-semibold text-text-primary tracking-tight">
                NexTerm
              </span>
              <button
                onClick={handleClose}
                className="flex items-center justify-center w-6 h-6 rounded-md text-text-muted hover:bg-bg-tertiary hover:text-text-primary transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Nav — same pattern as Settings modal */}
            <nav className="p-3 space-y-0.5 border-b border-border shrink-0">
              {NAV.map(({ id, icon: Icon, label }) => {
                const active = activeView === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveView(id)}
                    className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                      active
                        ? "bg-accent/15 text-accent"
                        : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
                    }`}
                  >
                    <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
                    <span className={active ? "font-medium" : ""}>{label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Content */}
            <div className="flex flex-1 flex-col overflow-y-auto min-h-0">
              {activeView === 'connections' && (
                <>
                  <QuickActions onNewSsh={onNewSsh} />
                  <div className="mx-3 border-t border-border" />
                  <div className="flex-1 py-1">
                    <ConnectionTree onAddConnection={onNewSsh} onEditConnection={onEditSsh} />
                  </div>
                  <div className="mx-3 border-t border-border" />
                  <div className="py-1">
                    <WorkspaceList />
                  </div>
                </>
              )}
              {activeView === 'git' && <GitPanel />}
              {activeView === 'database' && <DatabasePanel />}
              {activeView === 'clipboard' && <ClipboardPanel />}
              {activeView === 'tunnels' && <TunnelsPanel />}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
