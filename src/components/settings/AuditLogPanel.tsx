import { useEffect, useState, useCallback } from "react";
import { Search, Download, RefreshCw } from "lucide-react";
import { historyRecent } from "../../lib/ipc";

interface HistoryEntry {
  id: number;
  command: string;
  cwd: string | null;
}

export default function AuditLogPanel() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await historyRecent(500);
      setEntries(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = filter.trim()
    ? entries.filter(
        (e) =>
          e.command.toLowerCase().includes(filter.toLowerCase()) ||
          (e.cwd && e.cwd.toLowerCase().includes(filter.toLowerCase()))
      )
    : entries;

  const handleExportCsv = () => {
    const rows = [
      ["ID", "Command", "Working Directory"],
      ...filtered.map((e) => [
        String(e.id),
        `"${e.command.replace(/"/g, '""')}"`,
        e.cwd ? `"${e.cwd.replace(/"/g, '""')}"` : "",
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "command-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">Command History</h3>
        <p className="text-xs text-text-muted">
          Recent commands executed in terminal sessions.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter commands..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-bg-tertiary border border-border rounded-md text-text-primary placeholder:text-text-muted focus:border-accent outline-none"
          />
        </div>
        <button
          onClick={handleExportCsv}
          disabled={filtered.length === 0}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-border bg-bg-tertiary text-text-secondary hover:border-accent/50 hover:text-text-primary disabled:opacity-40 transition-colors"
          title="Export CSV"
        >
          <Download size={12} />
          Export
        </button>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center justify-center w-7 h-7 rounded-md border border-border bg-bg-tertiary text-text-muted hover:text-text-secondary disabled:opacity-40 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-md bg-error/10 border border-error/30 text-xs text-error">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-auto max-h-[340px]">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="sticky top-0 bg-bg-secondary border-b border-border">
                <th className="px-3 py-2 text-left text-text-muted font-medium w-12">#</th>
                <th className="px-3 py-2 text-left text-text-muted font-medium">Command</th>
                <th className="px-3 py-2 text-left text-text-muted font-medium w-44">Directory</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-text-muted">
                    {loading ? "Loading..." : "No history entries"}
                  </td>
                </tr>
              ) : (
                filtered.map((entry) => (
                  <tr key={entry.id} className="border-b border-border/50 hover:bg-bg-tertiary/50 transition-colors">
                    <td className="px-3 py-1.5 text-text-muted font-mono tabular-nums">{entry.id}</td>
                    <td className="px-3 py-1.5 text-text-primary font-mono break-all">{entry.command}</td>
                    <td className="px-3 py-1.5 text-text-muted font-mono truncate max-w-[180px]" title={entry.cwd ?? ""}>
                      {entry.cwd ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-3 py-1.5 border-t border-border bg-bg-secondary text-[10px] text-text-muted">
            {filtered.length} entr{filtered.length !== 1 ? "ies" : "y"}
            {filter && ` (filtered from ${entries.length})`}
          </div>
        )}
      </div>
    </div>
  );
}
