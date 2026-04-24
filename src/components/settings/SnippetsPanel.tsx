import { useRef, useState } from "react";
import { Plus, Trash2, Play, Edit2, Download, Upload, Tag } from "lucide-react";
import { useSettingsStore } from "../../stores/settings";
import { useTerminalStore } from "../../stores/terminal";
import { getCachedTerminal } from "../../lib/terminal-registry";
import type { Snippet } from "../../types/settings";
import { resolveSnippetVars, SNIPPET_VARIABLE_HINTS } from "../../lib/snippet-utils";
import { useSshStore } from "../../stores/ssh";

function saveSnippetsToFile(snippets: Snippet[]) {
  const blob = new Blob([JSON.stringify(snippets, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "nexterm-snippets.json";
  a.click();
  URL.revokeObjectURL(url);
}

export default function SnippetsPanel() {
  const { settings, update } = useSettingsStore();
  const snippets: Snippet[] = settings.snippets || [];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [category, setCategory] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["__none__"])
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  function getContext() {
    const state = useTerminalStore.getState();
    const paneId = state.activePaneId;
    const pane = paneId ? state.panes[paneId] : undefined;
    const conn = pane?.sshConnectionId
      ? useSshStore.getState().connections.find((c) => c.id === pane.sshConnectionId)
      : undefined;
    return {
      hostname: conn?.host ?? "localhost",
      username: conn?.username ?? "",
      cwd: pane?.cwd ?? "",
      paneId: paneId ?? "",
    };
  }

  function runSnippet(snippet: Snippet) {
    const paneId = useTerminalStore.getState().activePaneId;
    if (!paneId) return;
    const resolved = resolveSnippetVars(snippet.command, getContext());
    const entry = getCachedTerminal(paneId);
    if (!entry) return;
    const lines = resolved.split("\n");
    lines.forEach((line, i) => {
      setTimeout(() => {
        entry.terminal.paste(line + "\r");
      }, i * 50);
    });
  }

  function startEdit(s: Snippet) {
    setEditingId(s.id);
    setName(s.name);
    setCommand(s.command);
    setCategory(s.category ?? "");
    setIsAdding(false);
  }

  function startAdd() {
    setIsAdding(true);
    setEditingId(null);
    setName("");
    setCommand("");
    setCategory("");
  }

  function cancelEdit() {
    setEditingId(null);
    setIsAdding(false);
  }

  function saveEdit() {
    if (!name.trim() || !command.trim()) return;
    const updated = snippets.map((s) =>
      s.id === editingId
        ? {
            ...s,
            name: name.trim(),
            command: command.trim(),
            category: category.trim() || undefined,
          }
        : s
    );
    update("snippets" as never, updated as never);
    setEditingId(null);
  }

  function saveNew() {
    if (!name.trim() || !command.trim()) return;
    const newSnippet: Snippet = {
      id: crypto.randomUUID(),
      name: name.trim(),
      command: command.trim(),
      category: category.trim() || undefined,
    };
    update("snippets" as never, [...snippets, newSnippet] as never);
    setIsAdding(false);
  }

  function deleteSnippet(id: string) {
    update(
      "snippets" as never,
      snippets.filter((s) => s.id !== id) as never
    );
  }

  function handleExport() {
    saveSnippetsToFile(snippets);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(parsed)) return;
        const imported = parsed as Snippet[];
        const existing = new Set(snippets.map((s) => s.id));
        const merged = [
          ...snippets,
          ...imported
            .filter((s) => !existing.has(s.id))
            .map((s) => ({ ...s, id: s.id || crypto.randomUUID() })),
        ];
        update("snippets" as never, merged as never);
      } catch {
        // ignore malformed JSON
      }
    };
    reader.readAsText(file);
    // reset so the same file can be re-imported
    e.target.value = "";
  }

  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  // Group snippets by category
  const grouped: Record<string, Snippet[]> = {};
  for (const s of snippets) {
    const cat = s.category || "__none__";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  }
  const categories = Object.keys(grouped).sort((a, b) => {
    if (a === "__none__") return 1;
    if (b === "__none__") return -1;
    return a.localeCompare(b);
  });

  const editForm = (onSave: () => void, onCancel: () => void) => (
    <div className="p-3 bg-bg-tertiary rounded-lg border border-border space-y-2">
      <input
        className="w-full px-2 py-1.5 text-sm bg-bg-secondary border border-border rounded text-text-primary placeholder-text-muted focus:outline-none focus:border-border-focus"
        placeholder="Snippet name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <input
        className="w-full px-2 py-1.5 text-sm bg-bg-secondary border border-border rounded text-text-primary placeholder-text-muted focus:outline-none focus:border-border-focus"
        placeholder="Category (optional)"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      />
      <textarea
        className="w-full px-2 py-1.5 text-sm bg-bg-secondary border border-border rounded text-text-primary placeholder-text-muted font-mono focus:outline-none focus:border-border-focus resize-none"
        placeholder="Command (use {{hostname}}, {{user}}, {{cwd}}, {{date}})"
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        rows={3}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.ctrlKey) {
            e.preventDefault();
            onSave();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      <div className="flex flex-wrap gap-1">
        {SNIPPET_VARIABLE_HINTS.map((hint) => (
          <button
            key={hint.variable}
            className="text-xs px-1.5 py-0.5 rounded bg-bg-secondary border border-border text-text-muted hover:text-text-secondary hover:border-border-focus transition-colors"
            title={hint.description}
            onClick={() => setCommand((c) => c + hint.variable)}
            type="button"
          >
            {hint.variable}
          </button>
        ))}
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button
          onClick={onCancel}
          className="px-3 py-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!name.trim() || !command.trim()}
          className="px-3 py-1 text-sm bg-accent text-white rounded hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          Saved commands — run from the command palette or sidebar.
        </p>
        <div className="flex gap-1">
          <button
            onClick={handleImportClick}
            className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-text-primary border border-border rounded hover:border-border-focus transition-colors"
            title="Import snippets from JSON"
          >
            <Upload size={12} />
            Import
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-text-primary border border-border rounded hover:border-border-focus transition-colors"
            title="Export snippets to JSON"
            disabled={snippets.length === 0}
          >
            <Download size={12} />
            Export
          </button>
          <button
            onClick={startAdd}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-accent text-white rounded hover:bg-accent-hover transition-colors"
          >
            <Plus size={12} />
            New
          </button>
        </div>
      </div>

      {isAdding && editForm(saveNew, cancelEdit)}

      {categories.length === 0 && !isAdding && (
        <p className="text-sm text-text-muted text-center py-6">
          No snippets yet. Click &ldquo;New&rdquo; to create one.
        </p>
      )}

      {categories.map((cat) => {
        const isExpanded = expandedCategories.has(cat);
        const label = cat === "__none__" ? "Uncategorized" : cat;
        return (
          <div key={cat} className="space-y-1">
            {categories.length > 1 && (
              <button
                onClick={() => toggleCategory(cat)}
                className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary w-full py-0.5 transition-colors"
              >
                <Tag size={11} />
                <span className="font-medium uppercase tracking-wide">{label}</span>
                <span className="ml-1 text-text-muted">({grouped[cat].length})</span>
                <span className="ml-auto">{isExpanded ? "▾" : "▸"}</span>
              </button>
            )}
            {(isExpanded || categories.length === 1) &&
              grouped[cat].map((s) => (
                <div key={s.id}>
                  {editingId === s.id ? (
                    editForm(saveEdit, cancelEdit)
                  ) : (
                    <div className="group flex items-start gap-2 p-2.5 rounded-lg bg-bg-secondary border border-border hover:border-border-focus transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-text-primary truncate">
                          {s.name}
                        </div>
                        <div className="text-xs text-text-muted font-mono truncate mt-0.5">
                          {s.command.slice(0, 80)}
                          {s.command.length > 80 ? "…" : ""}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => runSnippet(s)}
                          className="p-1 text-text-muted hover:text-success transition-colors"
                          title="Run snippet"
                        >
                          <Play size={13} />
                        </button>
                        <button
                          onClick={() => startEdit(s)}
                          className="p-1 text-text-muted hover:text-text-primary transition-colors"
                          title="Edit snippet"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => deleteSnippet(s.id)}
                          className="p-1 text-text-muted hover:text-error transition-colors"
                          title="Delete snippet"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}
