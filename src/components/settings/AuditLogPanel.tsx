import { useEffect, useState, useCallback } from "react";
import { Search, Download, RefreshCw, History } from "lucide-react";
import { historyRecent } from "../../lib/ipc";
import { Button, IconButton } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { SettingsSection, TextField } from "./ui";

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
    <div className="space-y-8">
      <SettingsSection
        title="Command history"
        card={false}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="border border-border"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
              title="Export CSV"
            >
              <Download size={12} />
              Export
            </Button>
            <IconButton
              title="Refresh"
              onClick={load}
              disabled={loading}
              className="border border-border"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </IconButton>
          </div>
        }
      >
        <div className="relative">
          <Search
            size={13}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <TextField
            value={filter}
            onChange={setFilter}
            placeholder="Filter commands…"
            className="w-full pl-9"
          />
        </div>

        {error && (
          <div className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-border">
          {filtered.length === 0 ? (
            <EmptyState
              icon={History}
              title={
                loading
                  ? "Loading history…"
                  : filter
                    ? "No matching commands"
                    : "No history entries"
              }
              hint={
                loading
                  ? undefined
                  : filter
                    ? "Try a different search term."
                    : "Commands you run in the terminal will appear here."
              }
            />
          ) : (
            <>
              <div className="max-h-[340px] overflow-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="sticky top-0 border-b border-border bg-bg-secondary">
                      <th className="w-12 px-3 py-2 text-left font-medium text-text-muted">
                        #
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-text-muted">
                        Command
                      </th>
                      <th className="w-44 px-3 py-2 text-left font-medium text-text-muted">
                        Directory
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-b border-border/50 transition-colors hover:bg-bg-tertiary/50"
                      >
                        <td className="px-3 py-1.5 font-mono tabular-nums text-text-muted">
                          {entry.id}
                        </td>
                        <td className="break-all px-3 py-1.5 font-mono text-text-primary">
                          {entry.command}
                        </td>
                        <td
                          className="max-w-[180px] truncate px-3 py-1.5 font-mono text-text-muted"
                          title={entry.cwd ?? ""}
                        >
                          {entry.cwd ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-border bg-bg-secondary px-3 py-1.5 text-[10px] text-text-muted">
                {filtered.length} entr{filtered.length !== 1 ? "ies" : "y"}
                {filter && ` (filtered from ${entries.length})`}
              </div>
            </>
          )}
        </div>
      </SettingsSection>
    </div>
  );
}
