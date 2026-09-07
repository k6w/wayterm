import { useEffect, useState } from "react";
import { Icon } from "../../ui/icons";
import { plural } from "../../lib/plural";
import { EMPTY_WORKSPACE, useDatabaseStore, type QueryWorkspace } from "../../stores/database";
import { Badge, Button, EmptyState, IconButton, ListRow, ToolbarButton, ToolbarSpacer } from "../../ui";
import { PanelContent, PanelGroup, PanelToolbar } from "../sidebar/PanelChrome";
import DatabaseConnectionDialog from "./DatabaseConnectionDialog";
import QueryEditor from "./QueryEditor";
import ResultsGrid from "./ResultsGrid";

/** Database client: saved connections, then (once connected) a query editor, results and history. */
export function DatabasePanel() {
  const {
    connections,
    activeConnection,
    queryHistory,
    isConnected,
    isLoading,
    connect,
    disconnect,
    executeQuery,
    loadConnections,
    saveConnection,
    deleteConnection,
    workspaces,
    updateWorkspace,
  } = useDatabaseStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  // Query text and last results live in the store per connection, so they survive switching sidebar panels.
  const connectionId = activeConnection?.id ?? null;
  const { query, result, error: queryError } = (connectionId && workspaces[connectionId]) || EMPTY_WORKSPACE;
  const patch = (next: Partial<QueryWorkspace>) => {
    if (connectionId) updateWorkspace(connectionId, next);
  };
  const setQuery = (value: string) => patch({ query: value });
  const [running, setRunning] = useState(false);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  const run = async () => {
    if (!query.trim() || !activeConnection) return;
    patch({ error: null });
    setRunning(true);
    try {
      patch({ result: await executeQuery(query) });
    } catch (e) {
      patch({ result: null, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setRunning(false);
    }
  };

  const handleDisconnect = async () => {
    patch({ result: null, error: null });
    await disconnect();
  };

  const dialog = (
    <DatabaseConnectionDialog open={dialogOpen} onSave={saveConnection} onClose={() => setDialogOpen(false)} />
  );

  if (!isConnected) {
    return (
      <>
        <PanelToolbar aria-label="Database actions">
          <ToolbarButton>
            <Button size="sm" variant="ghost" leadingIcon={<Icon name="add" size="sm" />} onClick={() => setDialogOpen(true)}>
              New connection
            </Button>
          </ToolbarButton>
        </PanelToolbar>
        <PanelContent>
          {connections.length === 0 ? (
            <EmptyState
              icon={<Icon name="database" size="md" />}
              title="No saved connections"
              description="Add a PostgreSQL, MySQL, SQLite or MongoDB connection to query it here."
            />
          ) : (
            connections.map((conn) => (
              <ListRow
                key={conn.id}
                icon={<Icon name="database" size="sm" />}
                label={conn.name}
                description={`${conn.type} · ${conn.host}:${conn.port} · ${conn.database}`}
                disabled={isLoading}
                onSelect={() => void connect(conn.id)}
                actions={
                  <IconButton
                    size="xs"
                    label={`Delete ${conn.name}`}
                    icon={<Icon name="delete" size="sm" />}
                    onClick={() => void deleteConnection(conn.id).then(loadConnections)}
                  />
                }
              />
            ))
          )}
        </PanelContent>
        {dialog}
      </>
    );
  }

  return (
    <>
      <PanelToolbar aria-label="Connection">
        <Icon name="database" size="sm" aria-hidden className="shrink-0 text-fg-muted" />
        <span className="min-w-0 truncate text-label font-medium text-fg">{activeConnection?.name}</span>
        {activeConnection && <Badge>{activeConnection.type}</Badge>}
        <ToolbarSpacer />
        <ToolbarButton>
          <Button size="xs" variant="danger" leadingIcon={<Icon name="disconnect" size="sm" />} onClick={() => void handleDisconnect()}>
            Disconnect
          </Button>
        </ToolbarButton>
      </PanelToolbar>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-1">
        <QueryEditor query={query} onQueryChange={setQuery} history={queryHistory} running={running} onRun={() => void run()} />
        {queryError && (
          <p role="alert" className="mx-2 mb-2 shrink-0 rounded-md border border-danger bg-danger-subtle px-2 py-1.5 font-mono text-label text-danger">
            {queryError}
          </p>
        )}
        {result && !result.error && <ResultsGrid result={result} />}
        {queryHistory.length > 0 && (
          <PanelGroup title="History" count={queryHistory.length} className="shrink-0 p-1">
            {queryHistory.map((item) => (
              <ListRow
                key={item.id}
                label={<span className="font-mono">{item.query}</span>}
                description={`${new Date(item.timestamp).toLocaleString()} · ${item.duration}ms`}
                trailing={
                  item.error ? <Badge tone="danger">Error</Badge> : <Badge tone="success">{plural(item.rowCount, "row")}</Badge>
                }
                onSelect={() => setQuery(item.query)}
              />
            ))}
          </PanelGroup>
        )}
      </div>
    </>
  );
}
