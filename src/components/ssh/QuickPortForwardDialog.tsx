import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRightLeft, Plus, Trash2 } from "lucide-react";
import { useSshStore } from "../../stores/ssh";
import { useThemeStore } from "../../stores/theme";
import { useSettingsStore } from "../../stores/settings";
import { hexToRgba } from "../../lib/color";
import { vibrancyAlpha } from "../../lib/platform";
import type { PortForward } from "../../lib/ipc";

interface QuickPortForwardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  sessionId?: string;
}

// Custom toggle switch component
function ToggleSwitch({
  isActive,
  onClick,
}: {
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary ${
        isActive ? "bg-accent" : "bg-bg-tertiary"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
          isActive ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function QuickPortForwardDialog({
  isOpen,
  onClose,
  connectionId,
  sessionId,
}: QuickPortForwardDialogProps) {
  const [localPort, setLocalPort] = useState(8080);
  const [remoteHost, setRemoteHost] = useState("localhost");
  const [remotePort, setRemotePort] = useState(8000);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const portForwards = useSshStore((s) => s.portForwards);
  const loadPortForwards = useSshStore((s) => s.loadPortForwards);
  const savePortForward = useSshStore((s) => s.savePortForward);
  const deletePortForward = useSshStore((s) => s.deletePortForward);
  const togglePortForward = useSshStore((s) => s.togglePortForward);
  const theme = useThemeStore((s) => s.active);
  const vibrancy = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const windowOpacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);

  const cardBg = vibrancy
    ? hexToRgba(theme.ui.bgPrimary, vibrancyAlpha(windowOpacity) * 0.92)
    : theme.ui.bgPrimary;

  useEffect(() => {
    if (isOpen && connectionId) {
      loadPortForwards(connectionId);
    }
  }, [isOpen, connectionId, loadPortForwards]);

  const handleAdd = useCallback(async () => {
    setError(null);
    const forward: PortForward = {
      id: "",
      connectionId,
      portForwardType: "local",
      localPort,
      remoteHost,
      remotePort,
      isActive: false,
      createdAt: "",
      updatedAt: "",
    };
    try {
      await savePortForward(forward);
      setIsAdding(false);
      setLocalPort(8080);
      setRemoteHost("localhost");
      setRemotePort(8000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add port forward");
    }
  }, [connectionId, localPort, remoteHost, remotePort, savePortForward]);

  const handleToggle = useCallback(async (id: string, currentActive: boolean) => {
    try {
      await togglePortForward(id, !currentActive, sessionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to toggle port forward");
    }
  }, [togglePortForward, sessionId]);

  const handleDelete = useCallback(async (id: string) => {
    await deletePortForward(id);
  }, [deletePortForward]);

  const activeForwards = portForwards.filter((f) => f.isActive);
  const inactiveForwards = portForwards.filter((f) => !f.isActive);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-md rounded-xl border border-border overflow-hidden"
            style={{
              backgroundColor: cardBg,
              backdropFilter: vibrancy ? "blur(24px) saturate(1.4)" : undefined,
              WebkitBackdropFilter: vibrancy ? "blur(24px) saturate(1.4)" : undefined,
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <ArrowRightLeft size={14} className="text-accent" />
                <h3 className="text-sm font-medium text-text-primary">
                  Port Forwards
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-text-muted hover:text-text-primary transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Add new forward section */}
              {isAdding ? (
                <div className="p-3 border border-border rounded-lg bg-bg-secondary space-y-3">
                  <div className="text-xs text-text-muted font-medium">New Port Forward</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-text-secondary block mb-1">Local</label>
                      <input
                        type="number"
                        value={localPort}
                        onChange={(e) => { setLocalPort(parseInt(e.target.value, 10) || 8080); setError(null); }}
                        className="w-full bg-bg-tertiary border border-border rounded-md px-2 py-1.5 text-xs text-text-primary focus:border-accent outline-none"
                        min={1}
                        max={65535}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-text-secondary block mb-1">Remote Host</label>
                      <input
                        type="text"
                        value={remoteHost}
                        onChange={(e) => setRemoteHost(e.target.value)}
                        className="w-full bg-bg-tertiary border border-border rounded-md px-2 py-1.5 text-xs text-text-primary focus:border-accent outline-none"
                        placeholder="localhost"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-text-secondary block mb-1">Remote Port</label>
                      <input
                        type="number"
                        value={remotePort}
                        onChange={(e) => setRemotePort(parseInt(e.target.value, 10) || 8000)}
                        className="w-full bg-bg-tertiary border border-border rounded-md px-2 py-1.5 text-xs text-text-primary focus:border-accent outline-none"
                        min={1}
                        max={65535}
                      />
                    </div>
                  </div>
                  {error && (
                    <div className="text-xs text-error bg-error/10 px-2 py-1.5 rounded border border-error/30">
                      {error}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => { setIsAdding(false); setError(null); }}
                      className="px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAdd}
                      className="px-2 py-1 text-xs bg-accent hover:bg-accent-hover text-white rounded-md"
                    >
                      Add
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAdding(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-bg-tertiary hover:bg-bg-secondary border border-border rounded-md transition-colors text-text-secondary"
                >
                  <Plus size={12} />
                  Add Port Forward
                </button>
              )}

              {/* Port forwards list */}
              {portForwards.length === 0 && !isAdding ? (
                <div className="py-6 text-center text-xs text-text-muted border border-dashed border-border rounded-lg">
                  <ArrowRightLeft size={20} className="mx-auto mb-2 opacity-50" />
                  <p>No port forwards configured.</p>
                  <p className="mt-1">Add one to forward a remote port to your local machine.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeForwards.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs text-text-muted font-medium px-1">Active</div>
                      {activeForwards.map((forward) => (
                        <div
                          key={forward.id}
                          className="flex items-center gap-3 px-3 py-2.5 border border-accent/40 bg-accent/10 rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-accent">localhost</span>
                              <span className="text-xs font-mono text-text-primary font-medium">:{forward.localPort}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <ArrowRightLeft size={10} className="text-text-muted" />
                              <span className="text-xs font-mono text-text-secondary">{forward.remoteHost}:{forward.remotePort}</span>
                            </div>
                          </div>
                          <ToggleSwitch
                            isActive={forward.isActive}
                            onClick={() => handleToggle(forward.id, forward.isActive)}
                          />
                          <button
                            type="button"
                            onClick={() => handleDelete(forward.id)}
                            className="p-1 text-text-muted hover:text-error hover:bg-error/10 rounded-md transition-colors"
                            title="Remove"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {inactiveForwards.length > 0 && (
                    <div className="space-y-2">
                      {(activeForwards.length > 0) && (
                        <div className="text-xs text-text-muted font-medium px-1">Inactive</div>
                      )}
                      {inactiveForwards.map((forward) => (
                        <div
                          key={forward.id}
                          className="flex items-center gap-3 px-3 py-2.5 border border-border bg-bg-tertiary/50 rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-text-secondary">localhost</span>
                              <span className="text-xs font-mono text-text-primary font-medium">:{forward.localPort}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <ArrowRightLeft size={10} className="text-text-muted" />
                              <span className="text-xs font-mono text-text-muted">{forward.remoteHost}:{forward.remotePort}</span>
                            </div>
                          </div>
                          <ToggleSwitch
                            isActive={forward.isActive}
                            onClick={() => handleToggle(forward.id, forward.isActive)}
                          />
                          <button
                            type="button"
                            onClick={() => handleDelete(forward.id)}
                            className="p-1 text-text-muted hover:text-error hover:bg-error/10 rounded-md transition-colors"
                            title="Remove"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}