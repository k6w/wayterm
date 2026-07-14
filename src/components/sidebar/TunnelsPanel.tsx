import { useEffect, useState, useCallback } from "react";
import { Route, RefreshCw, Play, Square, Trash2 } from "lucide-react";
import { useSshStore } from "../../stores/ssh";
import { toast } from "../../stores/toast";
import type { PortForward } from "../../lib/ipc";

export default function TunnelsPanel() {
  const connections = useSshStore((s) => s.connections);
  const sessions = useSshStore((s) => s.sessions);
  const portForwards = useSshStore((s) => s.portForwards);
  const loadPortForwards = useSshStore((s) => s.loadPortForwards);
  const deletePortForward = useSshStore((s) => s.deletePortForward);
  const togglePortForward = useSshStore((s) => s.togglePortForward);

  const [loading, setLoading] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  // Load forwards for all connections that have active sessions
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      // Load for all known connections
      for (const conn of connections) {
        await loadPortForwards(conn.id).catch(() => {});
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [connections, loadPortForwards]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleToggle = useCallback(async (fwd: PortForward) => {
    setTogglingIds((prev) => new Set([...prev, fwd.id]));
    try {
      // Find active session for this connection
      const session = sessions.find((s) => s.connectionId === fwd.connectionId);
      await togglePortForward(fwd.id, !fwd.isActive, session?.sessionId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(fwd.id);
        return next;
      });
    }
  }, [sessions, togglePortForward]);

  const handleDelete = useCallback(async (fwd: PortForward) => {
    try {
      await deletePortForward(fwd.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }, [deletePortForward]);

  // Group by connection
  const grouped = new Map<string, PortForward[]>();
  for (const fwd of portForwards) {
    if (!grouped.has(fwd.connectionId)) grouped.set(fwd.connectionId, []);
    grouped.get(fwd.connectionId)!.push(fwd);
  }

  const getConnName = (connectionId: string) =>
    connections.find((c) => c.id === connectionId)?.name ?? connectionId.slice(0, 8);

  const formatType = (t: string) => {
    if (t === "local") return "L";
    if (t === "remote") return "R";
    if (t === "dynamic") return "D";
    return t.toUpperCase().slice(0, 1);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Route size={14} className="text-text-muted" />
          <span className="text-xs font-medium text-text-secondary">Port Forwards</span>
        </div>
        <button
          onClick={reload}
          disabled={loading}
          className="flex size-5 items-center justify-center rounded text-text-muted hover:bg-overlay/[0.08] hover:text-text-secondary transition-colors disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {portForwards.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
            <Route size={20} className="text-text-muted" />
            <span className="text-xs text-text-muted">No port forwards configured</span>
            <span className="text-[10px] text-text-muted">
              Open an SSH connection and add tunnels from the connection settings.
            </span>
          </div>
        ) : (
          <div className="flex flex-col">
            {Array.from(grouped.entries()).map(([connId, fwds]) => (
              <div key={connId}>
                <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-text-muted bg-overlay/[0.02] border-b border-border">
                  {getConnName(connId)}
                </div>
                {fwds.map((fwd) => (
                  <div
                    key={fwd.id}
                    className="flex items-center gap-2 px-3 py-2 border-b border-border hover:bg-overlay/[0.03] group"
                  >
                    <span
                      className={`shrink-0 w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold ${
                        fwd.isActive
                          ? "bg-success/20 text-success"
                          : "bg-bg-tertiary text-text-muted"
                      }`}
                      title={fwd.portForwardType}
                    >
                      {formatType(fwd.portForwardType)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-text-primary font-mono truncate">
                        {fwd.localPort} → {fwd.remoteHost}:{fwd.remotePort}
                      </div>
                      <div className="text-[10px] text-text-muted capitalize">{fwd.portForwardType}</div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleToggle(fwd)}
                        disabled={togglingIds.has(fwd.id)}
                        className={`flex size-5 items-center justify-center rounded transition-colors ${
                          fwd.isActive
                            ? "text-text-muted hover:text-warning"
                            : "text-text-muted hover:text-success"
                        } disabled:opacity-40`}
                        title={fwd.isActive ? "Stop" : "Start"}
                      >
                        {togglingIds.has(fwd.id) ? (
                          <RefreshCw size={11} className="animate-spin" />
                        ) : fwd.isActive ? (
                          <Square size={11} />
                        ) : (
                          <Play size={11} />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(fwd)}
                        className="flex size-5 items-center justify-center rounded text-text-muted hover:text-error transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                    {fwd.isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
