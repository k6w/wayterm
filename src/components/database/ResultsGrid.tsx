import { FileJson, FileText } from "lucide-react";
import { downloadTextFile } from "../../lib/download-file";
import { Button, ICON_SM, Toolbar, ToolbarButton, ToolbarSpacer } from "../../ui";
import { cellText, resultsToCsv } from "./database-form";
import type { QueryResult } from "../../types/database";

/** Dense, mono, zebra-striped result table with CSV / JSON export. Scrolls both ways inside a fixed height. */
export default function ResultsGrid({ result }: { result: QueryResult }) {
  if (result.rows.length === 0) {
    return <p className="px-3 py-2 text-label text-fg-muted">The query returned no rows.</p>;
  }
  return (
    <section aria-label="Query results" className="flex max-h-64 flex-col border-y border-border">
      <Toolbar aria-label="Result actions" className="h-7 shrink-0 gap-1 border-b border-border px-2">
        <span className="text-caption text-fg-muted">
          {result.rowCount} {result.rowCount === 1 ? "row" : "rows"}
        </span>
        <ToolbarSpacer />
        <ToolbarButton>
          <Button
            size="xs"
            variant="ghost"
            leadingIcon={<FileText {...ICON_SM} />}
            onClick={() => downloadTextFile("query-results.csv", resultsToCsv(result.columns, result.rows), "text/csv")}
          >
            CSV
          </Button>
        </ToolbarButton>
        <ToolbarButton>
          <Button
            size="xs"
            variant="ghost"
            leadingIcon={<FileJson {...ICON_SM} />}
            onClick={() => downloadTextFile("query-results.json", JSON.stringify(result.rows, null, 2), "application/json")}
          >
            JSON
          </Button>
        </ToolbarButton>
      </Toolbar>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse font-mono text-label">
          <thead>
            <tr>
              {result.columns.map((col) => (
                <th
                  key={col}
                  scope="col"
                  className="sticky top-0 whitespace-nowrap border-b border-border bg-panel px-2 py-1 text-left font-medium text-fg-muted"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, i) => (
              <tr key={i} className="even:bg-raised hover:bg-hover">
                {result.columns.map((col) => {
                  const text = cellText(row[col]);
                  return (
                    <td key={col} title={text} className="max-w-40 truncate whitespace-nowrap px-2 py-0.5 text-fg-secondary">
                      {text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
