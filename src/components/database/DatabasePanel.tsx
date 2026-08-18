import { useEffect, useState } from "react";
import { Database, Plus, Trash2, Unplug } from "lucide-react";
import { useDatabaseStore } from "../../stores/database";
import {
  Badge,
  Button,
  EmptyState,
  ICON_MD,
  ICON_SM,
  IconButton,
  ListRow,
  ToolbarButton,
  ToolbarSpacer,
} from "../../ui";
import { PanelContent, PanelGroup, PanelToolbar } from "../sidebar/PanelChrome";
import DatabaseConnectionDialog from "./DatabaseConnectionDialog";
import QueryEditor from "./QueryEditor";
import ResultsGrid from "./ResultsGrid";
import type { QueryResult } from "../../types/database";

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
  } = useDatabaseStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  const run = async () => {
    if (!query.trim() || !activeConnection) return;
    setQueryError(null);
    setRunning(true);
    try {
      setResult(await executeQuery(query));
    } catch (e) {
      setResult(null);
      setQueryError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    setResult(null);
    setQueryError(null);
  };

  const dialog = (
    <DatabaseConnectionDialog open={dialogOpen} onSave={saveConnection} onClose={() => setDialogOpen(false)} />
  );

  if (!isConnected) {
    return (
      <>
        <PanelToolbar aria-label="Database actions">
          <ToolbarButton>
            <Button size="sm" variant="ghost" leadingIcon={<Plus {...ICON_SM} />} onClick={() => setDialogOpen(true)}>
              New connection
            </Button>
          </ToolbarButton>
        </PanelToolbar>
        <PanelContent>
          {connections.length === 0 ? (
            <EmptyState
              icon={<Database {...ICON_MD} />}
              title="No saved connections"
              description="Add a PostgreSQL, MySQL, SQLite or MongoDB connection to query it here."
            />
          ) : (
            connections.map((conn) => (
              <ListRow
                key={conn.id}
                icon={<Database {...ICON_SM} />}
                label={conn.name}
                description={`${conn.type} · ${conn.host}:${conn.port} · ${conn.database}`}
                disabled={isLoading}
                onSelect={() => void connect(conn.id)}
                actions={
                  <IconButton
                    size="xs"
                    label={`Delete ${conn.name}`}
                    icon={<Trash2 {...ICON_SM} />}
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
        <Database {...ICON_SM} aria-hidden className="shrink-0 text-fg-muted" />
        <span className="min-w-0 truncate text-label font-medium text-fg">{activeConnection?.name}</span>
        {activeConnection && <Badge>{activeConnection.type}</Badge>}
        <ToolbarSpacer />
        <ToolbarButton>
          <Button size="xs" variant="danger" leadingIcon={<Unplug {...ICON_SM} />} onClick={() => void handleDisconnect()}>
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
                  item.error ? <Badge tone="danger">Error</Badge> : <Badge tone="success">{item.rowCount} rows</Badge>
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
