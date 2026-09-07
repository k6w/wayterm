import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "../../ui/icons";
import { useSshStore } from "../../stores/ssh";
import { toast } from "../../stores/toast";
import { Badge, EmptyState, IconButton, ListRow, Spinner, ToolbarButton, ToolbarSpacer, Tooltip } from "../../ui";
import { forwardRoute, forwardType } from "../ssh/port-forward-form";
import { PanelContent, PanelGroup, PanelToolbar } from "./PanelChrome";
import type { PortForward } from "../../lib/ipc";

/** Every saved port forward, grouped by connection. Selecting a row starts or stops it. */
export default function TunnelsPanel() {
  const connections = useSshStore((s) => s.connections);
  const sessions = useSshStore((s) => s.sessions);
  const portForwards = useSshStore((s) => s.portForwards);
  const loadAllPortForwards = useSshStore((s) => s.loadAllPortForwards);
  const deletePortForward = useSshStore((s) => s.deletePortForward);
  const togglePortForward = useSshStore((s) => s.togglePortForward);

  const [loading, setLoading] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await loadAllPortForwards(connections.map((c) => c.id));
    } finally {
      setLoading(false);
    }
  }, [connections, loadAllPortForwards]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleToggle = useCallback(
    async (forward: PortForward) => {
      setTogglingIds((prev) => new Set(prev).add(forward.id));
      try {
        const session = sessions.find((s) => s.connectionId === forward.connectionId);
        await togglePortForward(forward.id, !forward.isActive, session?.sessionId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        setTogglingIds((prev) => {
          const next = new Set(prev);
          next.delete(forward.id);
          return next;
        });
      }
    },
    [sessions, togglePortForward]
  );

  const handleDelete = useCallback(
    async (forward: PortForward) => {
      try {
        await deletePortForward(forward.id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    },
    [deletePortForward]
  );

  const groups = useMemo(() => {
    const byConnection = new Map<string, PortForward[]>();
    for (const forward of portForwards) {
      const list = byConnection.get(forward.connectionId) ?? [];
      list.push(forward);
      byConnection.set(forward.connectionId, list);
    }
    return [...byConnection.entries()].map(([connectionId, forwards]) => ({
      connectionId,
      name: connections.find((c) => c.id === connectionId)?.name ?? connectionId.slice(0, 8),
      forwards,
    }));
  }, [portForwards, connections]);

  return (
    <>
      <PanelToolbar aria-label="Port forward actions">
        <ToolbarSpacer />
        <ToolbarButton>
          <IconButton
            label="Refresh"
            icon={loading ? <Spinner size={14} label="Refreshing" /> : <Icon name="refresh" size="sm" />}
            disabled={loading}
            onClick={() => void reload()}
          />
        </ToolbarButton>
      </PanelToolbar>
      <PanelContent>
        {groups.length === 0 ? (
          <EmptyState
            icon={<Icon name="portForward" size="md" />}
            title="No port forwards"
            description="Open an SSH tab and add one with the port forward button in the status bar."
          />
        ) : (
          groups.map((group) => (
            <PanelGroup key={group.connectionId} title={group.name} count={group.forwards.length}>
              {group.forwards.map((forward) => {
                const type = forwardType(forward.portForwardType);
                const busy = togglingIds.has(forward.id);
                return (
                  <ListRow
                    key={forward.id}
                    icon={
                      <Badge tone={forward.isActive ? "success" : "neutral"} title={type.long}>
                        {type.short}
                      </Badge>
                    }
                    label={
                      <Tooltip content={forwardRoute(forward)}>
                        <span className="font-mono">{forwardRoute(forward)}</span>
                      </Tooltip>
                    }
                    description={`${type.long} forward`}
                    trailing={
                      busy ? (
                        <Spinner size={14} label="Switching" />
                      ) : (
                        <Badge tone={forward.isActive ? "success" : "neutral"}>
                          {forward.isActive ? "Active" : "Stopped"}
                        </Badge>
                      )
                    }
                    aria-label={`${forwardRoute(forward)}, ${forward.isActive ? "active, select to stop" : "stopped, select to start"}`}
                    disabled={busy}
                    onSelect={() => void handleToggle(forward)}
                    actions={
                      <IconButton
                        size="xs"
                        label="Delete forward"
                        icon={<Icon name="delete" size="sm" />}
                        onClick={() => void handleDelete(forward)}
                      />
                    }
                  />
                );
              })}
            </PanelGroup>
          ))
        )}
      </PanelContent>
    </>
  );
}
