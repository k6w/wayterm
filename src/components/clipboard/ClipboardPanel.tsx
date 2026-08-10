import { useState } from "react";
import { ClipboardList, Copy, Star, Trash2 } from "lucide-react";
import { useClipboardStore } from "../../stores/clipboard";
import { useTerminalStore } from "../../stores/terminal";
import { pasteToTerminal } from "../../lib/terminal-registry";
import { Badge, EmptyState, ICON_MD, ICON_SM, IconButton, Input, ListRow, ToolbarButton } from "../../ui";
import { PanelContent, PanelToolbar } from "../sidebar/PanelChrome";
import { clipboardPreview, filterClipboard } from "./clipboard-list";

/** Clipboard history. Selecting an entry pastes it into the active terminal. */
export function ClipboardPanel() {
  const entries = useClipboardStore((s) => s.entries);
  const removeEntry = useClipboardStore((s) => s.removeEntry);
  const toggleFavorite = useClipboardStore((s) => s.toggleFavorite);
  const clearHistory = useClipboardStore((s) => s.clearHistory);
  const activePaneId = useTerminalStore((s) => s.activePaneId);
  const [query, setQuery] = useState("");

  const visible = filterClipboard(entries, query);

  // Paste goes through the system clipboard (the terminal reads it back), so
  // the write must finish before the paste reads.
  const handlePaste = async (content: string) => {
    if (!activePaneId) return;
    await navigator.clipboard.writeText(content);
    await pasteToTerminal(activePaneId);
  };

  return (
    <>
      <PanelToolbar aria-label="Clipboard actions">
        <Input
          size="sm"
          type="search"
          aria-label="Search clipboard history"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {entries.length > 0 && (
          <ToolbarButton>
            <IconButton label="Clear history" icon={<Trash2 {...ICON_SM} />} onClick={clearHistory} />
          </ToolbarButton>
        )}
      </PanelToolbar>
      <PanelContent>
        {visible.length === 0 ? (
          query.trim() ? (
            <EmptyState title="No matches" description={`Nothing in the history contains "${query.trim()}".`} />
          ) : (
            <EmptyState
              icon={<ClipboardList {...ICON_MD} />}
              title="Clipboard history is empty"
              description="Text you copy in the terminal shows up here."
            />
          )
        ) : (
          visible.map((entry) => (
            <ListRow
              key={entry.id}
              icon={entry.favorite ? <Star {...ICON_SM} fill="currentColor" className="text-warning" /> : undefined}
              label={<span className="font-mono">{clipboardPreview(entry.content)}</span>}
              description={new Date(entry.timestamp).toLocaleTimeString()}
              trailing={entry.favorite ? <Badge tone="warning">Starred</Badge> : undefined}
              disabled={!activePaneId}
              onSelect={() => void handlePaste(entry.content)}
              actions={
                <>
                  <IconButton
                    size="xs"
                    label={entry.favorite ? "Unstar" : "Star"}
                    pressed={entry.favorite}
                    icon={<Star {...ICON_SM} />}
                    onClick={() => toggleFavorite(entry.id)}
                  />
                  <IconButton
                    size="xs"
                    label="Copy"
                    icon={<Copy {...ICON_SM} />}
                    onClick={() => void navigator.clipboard.writeText(entry.content)}
                  />
                  <IconButton size="xs" label="Delete" icon={<Trash2 {...ICON_SM} />} onClick={() => removeEntry(entry.id)} />
                </>
              }
            />
          ))
        )}
      </PanelContent>
      {visible.length > 0 && (
        <div className="shrink-0 border-t border-border px-3 py-1 text-caption text-fg-muted">
          {visible.length} {visible.length === 1 ? "item" : "items"}
        </div>
      )}
    </>
  );
}
