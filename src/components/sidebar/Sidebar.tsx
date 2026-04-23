import { useEffect, useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useTerminalStore } from "../../stores/terminal";
import { isMac } from "../../lib/platform";
import QuickActions from "./QuickActions";
import ConnectionTree from "./ConnectionTree";
import WorkspaceList from "./WorkspaceList";
import { GitPanel } from "../git/GitPanel";
import { ClipboardPanel } from "../ui/ClipboardPanel";
import type { SshConnection } from "../../types/ssh";
import { GitBranch, Clipboard, FolderTree } from "lucide-react";

interface SidebarProps {
  onNewSsh?: () => void;
  onEditSsh?: (conn: SshConnection) => void;
}

export default function Sidebar({ onNewSsh, onEditSsh }: SidebarProps) {
  const sidebarOpen = useTerminalStore((s) => s.sidebarOpen);
  const toggleSidebar = useTerminalStore((s) => s.toggleSidebar);
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeView, setActiveView] = useState<'connections' | 'git' | 'clipboard'>('connections');

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
            className="fixed left-0 top-0 z-50 flex h-full w-[280px] flex-col border-r border-white/[0.08]"
            style={{
              backdropFilter: "blur(var(--blur-sidebar))",
              WebkitBackdropFilter: "blur(var(--blur-sidebar))",
              backgroundColor: `rgba(10, 10, 15, var(--opacity-sidebar))`,
            }}
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 32,
              mass: 0.8,
            }}
          >
            <div className={`flex h-10 shrink-0 items-center justify-between border-b border-white/[0.08] px-3 ${isMac ? "pl-[84px]" : ""}`}>
              <span className="text-sm font-medium text-text-primary">
                Nexterm
              </span>
              <button
                onClick={handleClose}
                className="flex size-6 items-center justify-center rounded text-text-muted transition-colors hover:bg-white/[0.08] hover:text-text-secondary"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex flex-col gap-2 p-2 border-b border-white/[0.08]">
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveView('connections')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors ${
                    activeView === 'connections' ? 'bg-white/[0.12] text-text-primary' : 'text-text-muted hover:bg-white/[0.08]'
                  }`}
                >
                  <FolderTree size={14} />
                  <span>SSH</span>
                </button>
                <button
                  onClick={() => setActiveView('git')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors ${
                    activeView === 'git' ? 'bg-white/[0.12] text-text-primary' : 'text-text-muted hover:bg-white/[0.08]'
                  }`}
                >
                  <GitBranch size={14} />
                  <span>Git</span>
                </button>
                <button
                  onClick={() => setActiveView('clipboard')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors ${
                    activeView === 'clipboard' ? 'bg-white/[0.12] text-text-primary' : 'text-text-muted hover:bg-white/[0.08]'
                  }`}
                >
                  <Clipboard size={14} />
                  <span>Clip</span>
                </button>
              </div>
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
              {activeView === 'clipboard' && <ClipboardPanel />}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
