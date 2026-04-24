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

interface SidebarProps {
  onNewSsh?: () => void;
  onEditSsh?: (conn: SshConnection) => void;
}

export default function Sidebar({ onNewSsh, onEditSsh }: SidebarProps) {
  const sidebarOpen = useTerminalStore((s) => s.sidebarOpen);
  const toggleSidebar = useTerminalStore((s) => s.toggleSidebar);
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeView, setActiveView] = useState<'connections' | 'git' | 'database' | 'clipboard' | 'tunnels'>('connections');

  const handleClose = useCallback(() => {
    if (sidebarOpen) {
      toggleSidebar();
    }
  }, [sidebarOpen, toggleSidebar]);

  useEffect(() => {
    if (!sidebarOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen, handleClose]);

  useEffect(() => {
    if (!sidebarOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };

    const timer = setTimeout(() => {
      window.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [sidebarOpen, handleClose]);

  return (
    <AnimatePresence>
      {sidebarOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          <motion.div
            ref={panelRef}
            className="fixed left-0 top-0 z-50 flex h-full w-[300px] border-r border-white/[0.08]"
            style={{
              backdropFilter: "blur(var(--blur-sidebar))",
              WebkitBackdropFilter: "blur(var(--blur-sidebar))",
              backgroundColor: `rgba(10, 10, 15, var(--opacity-sidebar))`,
            }}
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 32,
              mass: 0.8,
            }}
          >
            {/* Vertical icon rail */}
            <div className={`flex flex-col items-center w-10 shrink-0 border-r border-white/[0.08] py-2 gap-0.5 ${isMac ? "pt-9" : "pt-2"}`}>
              {([
                { id: 'connections', icon: FolderTree, label: 'SSH' },
                { id: 'git', icon: GitBranch, label: 'Git' },
                { id: 'database', icon: Database, label: 'DB' },
                { id: 'clipboard', icon: Clipboard, label: 'Clipboard' },
                { id: 'tunnels', icon: Route, label: 'Tunnels' },
              ] as const).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  title={label}
                  onClick={() => setActiveView(id)}
                  className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                    activeView === id
                      ? 'bg-accent/20 text-accent'
                      : 'text-text-muted hover:bg-overlay/[0.08] hover:text-text-secondary'
                  }`}
                >
                  {activeView === id && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-accent -ml-0.5" />
                  )}
                  <Icon size={15} />
                </button>
              ))}
            </div>

            {/* Content area */}
            <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
              <div className={`flex h-10 shrink-0 items-center justify-between border-b border-white/[0.08] px-3 ${isMac ? "pl-3" : ""}`}>
                <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                  {activeView === 'connections' ? 'SSH' : activeView === 'git' ? 'Git' : activeView === 'database' ? 'Database' : activeView === 'clipboard' ? 'Clipboard' : 'Tunnels'}
                </span>
                <button
                  onClick={handleClose}
                  className="flex size-6 items-center justify-center rounded text-text-muted transition-colors hover:bg-overlay/[0.08] hover:text-text-secondary"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex flex-1 flex-col overflow-y-auto">
                {activeView === 'connections' && (
                  <>
                    <QuickActions onNewSsh={onNewSsh} />
                    <div className="mx-3 border-t border-white/[0.08]" />
                    <div className="flex-1 py-1">
                      <ConnectionTree
                        onAddConnection={onNewSsh}
                        onEditConnection={onEditSsh}
                      />
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
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
