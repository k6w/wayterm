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
import { GitBranch, Database, Clipboard, FolderTree, Route } from "lucide-react";

type View = 'connections' | 'git' | 'database' | 'clipboard' | 'tunnels';

const TABS: { id: View; icon: typeof FolderTree; label: string }[] = [
  { id: 'connections', icon: FolderTree, label: 'SSH' },
  { id: 'git',         icon: GitBranch,  label: 'Git' },
  { id: 'database',   icon: Database,   label: 'DB' },
  { id: 'clipboard',  icon: Clipboard,  label: 'Clips' },
  { id: 'tunnels',    icon: Route,      label: 'Ports' },
];

// On macOS with decorations:false the native traffic lights overlay the
// top ~40 px of the window. Sidebar + backdrop start below that zone.
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
            className="fixed left-0 bottom-0 z-50 flex flex-col w-[280px] border-r border-white/[0.08]"
            style={{
              top: panelTop,
              backdropFilter: "blur(var(--blur-sidebar))",
              WebkitBackdropFilter: "blur(var(--blur-sidebar))",
              backgroundColor: `rgba(10, 10, 15, var(--opacity-sidebar))`,
            }}
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "spring", stiffness: 400, damping: 32, mass: 0.8 }}
          >
            {/* Tab nav */}
            <div className="flex items-stretch border-b border-white/[0.08] shrink-0 relative">
              {TABS.map(({ id, icon: Icon, label }) => {
                const active = activeView === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveView(id)}
                    className={`relative flex-1 flex flex-col items-center justify-center py-2 gap-[3px] transition-colors ${
                      active
                        ? "text-accent"
                        : "text-text-muted hover:text-text-secondary hover:bg-white/[0.03]"
                    }`}
                  >
                    <Icon size={13} strokeWidth={active ? 2.2 : 1.8} />
                    <span className={`text-[10px] font-medium leading-none ${active ? "" : "opacity-80"}`}>
                      {label}
                    </span>
                    {active && (
                      <span className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full bg-accent" />
                    )}
                  </button>
                );
              })}

              {/* Close button separated by a border */}
              <div className="w-px bg-white/[0.06] my-1.5 shrink-0" />
              <button
                onClick={handleClose}
                className="px-3 text-text-muted hover:text-text-secondary hover:bg-white/[0.03] transition-colors shrink-0"
                title="Close sidebar"
              >
                <X size={13} />
              </button>
            </div>

            {/* Content */}
            <div className="flex flex-1 flex-col overflow-y-auto min-h-0">
              {activeView === 'connections' && (
                <>
                  <QuickActions onNewSsh={onNewSsh} />
                  <div className="mx-3 border-t border-white/[0.08]" />
                  <div className="flex-1 py-1">
                    <ConnectionTree onAddConnection={onNewSsh} onEditConnection={onEditSsh} />
                  </div>
                  <div className="mx-3 border-t border-white/[0.08]" />
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
