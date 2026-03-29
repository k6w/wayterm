import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, ArrowRightLeft } from "lucide-react";
import { useSshStore } from "../../stores/ssh";
import type { PortForward } from "../../lib/ipc";

interface PortForwardsPanelProps {
  connectionId: string;
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
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary ${
        isActive ? "bg-accent" : "bg-bg-tertiary"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
          isActive ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function PortForwardsPanel({ connectionId }: PortForwardsPanelProps) {
  const portForwards = useSshStore((s) => s.portForwards);
  const loadPortForwards = useSshStore((s) => s.loadPortForwards);
  const savePortForward = useSshStore((s) => s.savePortForward);
  const deletePortForward = useSshStore((s) => s.deletePortForward);
  const togglePortForward = useSshStore((s) => s.togglePortForward);

  const [isAdding, setIsAdding] = useState(false);
  const [localPort, setLocalPort] = useState(8080);
  const [remoteHost, setRemoteHost] = useState("localhost");
  const [remotePort, setRemotePort] = useState(8000);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (connectionId) {
      loadPortForwards(connectionId);
    }
  }, [connectionId, loadPortForwards]);

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
    await togglePortForward(id, !currentActive);
  }, [togglePortForward]);

  const handleDelete = useCallback(async (id: string) => {
    await deletePortForward(id);
  }, [deletePortForward]);

  const activeForwards = portForwards.filter((f) => f.isActive);
  const inactiveForwards = portForwards.filter((f) => !f.isActive);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowRightLeft size={14} className="text-accent" />
          <h4 className="text-sm font-medium text-text-primary">Port Forwards</h4>
        </div>
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-accent hover:bg-accent-hover text-white rounded-md transition-colors"
        >
          <Plus size={12} />
          Add Forward
        </button>
      </div>

      {isAdding && (
        <div className="p-4 border border-border rounded-lg bg-bg-secondary space-y-3">
          <div className="text-xs text-text-muted font-medium">New Port Forward</div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-text-secondary block mb-1.5">Local Port</label>
              <input
                type="number"
                value={localPort}
                onChange={(e) => { setLocalPort(parseInt(e.target.value, 10) || 8080); setError(null); }}
                className="w-full bg-bg-tertiary border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:border-accent outline-none"
                min={1}
                max={65535}
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1.5">Remote Host</label>
              <input
                type="text"
                value={remoteHost}
                onChange={(e) => setRemoteHost(e.target.value)}
                className="w-full bg-bg-tertiary border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:border-accent outline-none"
                placeholder="localhost"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1.5">Remote Port</label>
              <input
                type="number"
                value={remotePort}
                onChange={(e) => setRemotePort(parseInt(e.target.value, 10) || 8000)}
                className="w-full bg-bg-tertiary border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:border-accent outline-none"
                min={1}
                max={65535}
              />
            </div>
          </div>
          {error && (
            <div className="text-xs text-error bg-error/10 px-3 py-2 rounded border border-error/30">
              {error}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setIsAdding(false); setError(null); }}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              className="px-3 py-1.5 text-xs bg-accent hover:bg-accent-hover text-white rounded-md transition-colors font-medium"
            >
              Add Forward
            </button>
          </div>
        </div>
      )}

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
                  <ToggleSwitch
                    isActive={forward.isActive}
                    onClick={() => handleToggle(forward.id, forward.isActive)}
                  />
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
                  <button
                    type="button"
                    onClick={() => handleDelete(forward.id)}
                    className="p-1.5 text-text-muted hover:text-error hover:bg-error/10 rounded-md transition-colors"
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
                  <ToggleSwitch
                    isActive={forward.isActive}
                    onClick={() => handleToggle(forward.id, forward.isActive)}
                  />
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
                  <button
                    type="button"
                    onClick={() => handleDelete(forward.id)}
                    className="p-1.5 text-text-muted hover:text-error hover:bg-error/10 rounded-md transition-colors"
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
  );
}
