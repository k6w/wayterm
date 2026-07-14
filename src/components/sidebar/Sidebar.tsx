import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTerminalStore } from "../../stores/terminal";
import { useSettingsStore } from "../../stores/settings";
import { useThemeStore } from "../../stores/theme";
import { hexToRgba } from "../../lib/color";
import { vibrancyAlpha } from "../../lib/platform";
import QuickActions from "./QuickActions";
import ConnectionTree from "./ConnectionTree";
import WorkspaceList from "./WorkspaceList";
import TunnelsPanel from "./TunnelsPanel";
import { GitPanel } from "../git/GitPanel";
import { DatabasePanel } from "../database/DatabasePanel";
import { ClipboardPanel } from "../ui/ClipboardPanel";
import type { SshConnection } from "../../types/ssh";

// Sidebar overlay panel width. Chrome reference: ActivityBar rail = 44px (w-11),
// vertical title bar = 200px — independent constants, not derived from each other.
const PANEL_WIDTH = 320;
const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

interface SidebarProps {
  onNewSsh?: () => void;
  onEditSsh?: (conn: SshConnection) => void;
}

export default function Sidebar({ onNewSsh, onEditSsh }: SidebarProps) {
  const activeSidebarSection = useTerminalStore((s) => s.activeSidebarSection);
  const setSidebarSection = useTerminalStore((s) => s.setSidebarSection);
  const vibrancyEnabled = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const windowOpacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);
  const theme = useThemeStore((s) => s.active);

  const handleClose = useCallback(() => setSidebarSection(null), [setSidebarSection]);

  useEffect(() => {
    if (!activeSidebarSection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); handleClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeSidebarSection, handleClose]);

  // Match the app chrome (bgSecondary) but slightly more opaque than the
  // titlebar so text inside the panel is clearly readable.
  const baseAlpha = vibrancyEnabled
    ? Math.min(vibrancyAlpha(windowOpacity) + 0.2, 0.88)
    : 0.96;
  const panelBg = hexToRgba(theme.ui.bgSecondary, baseAlpha);

  return (
    <AnimatePresence initial={false}>
      {activeSidebarSection && (
        <>
          <motion.div
            className="absolute inset-0 z-[var(--z-sidebar-backdrop)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={handleClose}
          />

          <motion.div
            className="absolute left-0 top-0 bottom-0 z-[var(--z-sidebar-panel)] flex flex-col border-r border-border"
            style={{
              width: PANEL_WIDTH,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              backgroundColor: panelBg,
            }}
            initial={{ x: -PANEL_WIDTH }}
            animate={{ x: 0 }}
            exit={{ x: -PANEL_WIDTH }}
            transition={{ type: "tween", duration: 0.2, ease: EASE }}
          >
            {activeSidebarSection === 'connections' && (
              <>
                <QuickActions onNewSsh={onNewSsh} />
                <div className="mx-3 border-t border-border shrink-0" />
                <div className="flex-1 py-1 min-h-0 overflow-y-auto">
                  <ConnectionTree onAddConnection={onNewSsh} onEditConnection={onEditSsh} />
                </div>
                <div className="mx-3 border-t border-border shrink-0" />
                <div className="py-1 shrink-0">
                  <WorkspaceList />
                </div>
              </>
            )}
            {activeSidebarSection === 'git' && <GitPanel />}
            {activeSidebarSection === 'database' && <DatabasePanel />}
            {activeSidebarSection === 'clipboard' && <ClipboardPanel />}
            {activeSidebarSection === 'tunnels' && <TunnelsPanel />}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
