import { useCallback, useEffect, useState } from "react";
import { Download, History, RefreshCw } from "lucide-react";
import { historyRecent } from "../../lib/ipc";
import { downloadTextFile } from "../../lib/download-file";
import { Button, EmptyState, IconButton, Input, Section, cn, ICON_MD, ICON_SM } from "../../ui";

export interface HistoryEntry {
  id: number;
  command: string;
  cwd: string | null;
}

const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;

/** CSV with an ID, Command, Working Directory header; text fields are quoted, quotes doubled. */
export function historyCsv(entries: readonly HistoryEntry[]): string {
  const rows = [
    ["ID", "Command", "Working Directory"],
    ...entries.map((e) => [String(e.id), quote(e.command), e.cwd ? quote(e.cwd) : ""]),
  ];
  return rows.map((row) => row.join(",")).join("\n");
}

const headerCell = "sticky top-0 h-8 bg-panel px-3 text-left text-caption font-medium uppercase tracking-wide text-fg-muted";

export default function AuditLogPanel() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries((await historyRecent(500)) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const q = filter.trim().toLowerCase();
  const filtered = q
    ? entries.filter((e) => e.command.toLowerCase().includes(q) || Boolean(e.cwd?.toLowerCase().includes(q)))
    : entries;

  return (
    <Section
      title="Command history"
      actions={
        <>
          <Button
            size="sm"
            leadingIcon={<Download {...ICON_SM} />}
            disabled={filtered.length === 0}
            onClick={() => downloadTextFile("command-history.csv", historyCsv(filtered), "text/csv")}
          >
            Export CSV
          </Button>
          <IconButton
            label="Refresh"
            icon={<RefreshCw {...ICON_SM} className={cn(loading && "animate-spin")} />}
            disabled={loading}
            onClick={() => void load()}
          />
        </>
      }
    >
      <Input
        type="search"
        aria-label="Filter commands"
        placeholder="Filter commands…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {error && (
        <p role="alert" className="rounded-md border border-danger bg-danger-subtle px-3 py-2 text-label text-danger">
          {error}
        </p>
      )}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<History {...ICON_MD} />}
          title={loading ? "Loading history…" : q ? "No matching commands" : "No history entries"}
          description={
            loading ? undefined : q ? "Try a different search term." : "Commands you run in the terminal appear here."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-panel">
          <div className="max-h-[340px] overflow-auto">
            <table className="w-full border-collapse text-label">
              <thead>
                <tr>
                  <th scope="col" className={cn(headerCell, "w-14")}>
                    #
                  </th>
                  <th scope="col" className={headerCell}>
                    Command
                  </th>
                  <th scope="col" className={cn(headerCell, "w-44")}>
                    Directory
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry.id} className="border-t border-border hover:bg-hover">
                    <td className="px-3 py-1.5 font-mono tabular-nums text-fg-muted">{entry.id}</td>
                    <td className="break-all px-3 py-1.5 font-mono text-fg">{entry.command}</td>
                    <td className="max-w-44 truncate px-3 py-1.5 font-mono text-fg-muted" title={entry.cwd ?? ""}>
                      {entry.cwd ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-3 py-1.5 text-caption text-fg-muted">
            {filtered.length} entr{filtered.length === 1 ? "y" : "ies"}
            {q && ` (filtered from ${entries.length})`}
          </p>
        </div>
      )}
    </Section>
  );
}
