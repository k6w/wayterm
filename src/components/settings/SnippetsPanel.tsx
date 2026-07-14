import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Play,
  Edit2,
  Download,
  Upload,
  Tag,
  ChevronDown,
  ChevronRight,
  ScrollText,
} from "lucide-react";
import { useSettingsStore } from "../../stores/settings";
import { useTerminalStore } from "../../stores/terminal";
import { getCachedTerminal } from "../../lib/terminal-registry";
import type { Snippet } from "../../types/settings";
import { resolveSnippetVars, SNIPPET_VARIABLE_HINTS } from "../../lib/snippet-utils";
import { useSshStore } from "../../stores/ssh";
import { SettingsSection, TextField, TextArea } from "./ui";
import { Button, IconButton } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import ConfirmDialog from "../ui/ConfirmDialog";

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["__none__"])
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Focus the name field whenever the add/edit form opens.
  useEffect(() => {
    if (isAdding || editingId) {
      const el = document.getElementById("snippet-name-field") as HTMLInputElement | null;
      el?.focus();
    }
  }, [isAdding, editingId]);

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

  const deletingSnippet = deletingId
    ? snippets.find((s) => s.id === deletingId)
    : undefined;

  const editForm = (onSave: () => void, onCancel: () => void) => (
    <div className="space-y-2 rounded-lg border border-border bg-bg-tertiary p-3">
      <TextField
        id="snippet-name-field"
        value={name}
        onChange={setName}
        placeholder="Snippet name"
        className="w-full"
      />
      <TextField
        value={category}
        onChange={setCategory}
        placeholder="Category (optional)"
        className="w-full"
      />
      <TextArea
        value={command}
        onChange={setCommand}
        placeholder="Command (use {{hostname}}, {{user}}, {{cwd}}, {{date}})"
        rows={3}
        mono
        className="w-full"
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
            type="button"
            title={hint.description}
            onClick={() => setCommand((c) => c + hint.variable)}
            className="rounded border border-border bg-bg-secondary px-1.5 py-0.5 font-mono text-xs text-text-muted transition-colors hover:border-border-focus hover:text-text-secondary"
          >
            {hint.variable}
          </button>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onSave}
          disabled={!name.trim() || !command.trim()}
        >
          Save
        </Button>
      </div>
    </div>
  );

  const toolbar = (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="border border-border"
        title="Import snippets from JSON"
        onClick={handleImportClick}
      >
        <Upload size={12} />
        Import
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="border border-border"
        title="Export snippets to JSON"
        disabled={snippets.length === 0}
        onClick={handleExport}
      >
        <Download size={12} />
        Export
      </Button>
      <Button variant="primary" size="sm" onClick={startAdd}>
        <Plus size={12} />
        New
      </Button>
    </div>
  );

  return (
    <div className="space-y-8">
      <SettingsSection
        title="Snippets"
        description="Run from the command palette or sidebar"
        action={toolbar}
        card={false}
      >
        {isAdding && editForm(saveNew, cancelEdit)}

        {categories.length === 0 && !isAdding ? (
          <EmptyState
            icon={ScrollText}
            title="No snippets yet"
            hint="Save commands you run often, then launch them from the palette or sidebar."
            action={{ label: "New snippet", onClick: startAdd }}
          />
        ) : (
          categories.map((cat) => {
            const isExpanded = expandedCategories.has(cat);
            const label = cat === "__none__" ? "Uncategorized" : cat;
            return (
              <div key={cat} className="space-y-1">
                {categories.length > 1 && (
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className="flex w-full items-center gap-1.5 py-0.5 text-xs text-text-muted transition-colors hover:text-text-secondary"
                  >
                    <Tag size={11} />
                    <span className="font-medium uppercase tracking-wide">{label}</span>
                    <span className="ml-1 text-text-muted">({grouped[cat].length})</span>
                    <span className="ml-auto">
                      {isExpanded ? (
                        <ChevronDown size={13} />
                      ) : (
                        <ChevronRight size={13} />
                      )}
                    </span>
                  </button>
                )}
                {(isExpanded || categories.length === 1) &&
                  grouped[cat].map((s) => (
                    <div key={s.id}>
                      {editingId === s.id ? (
                        editForm(saveEdit, cancelEdit)
                      ) : (
                        <div className="group flex items-start gap-2 rounded-lg border border-border bg-bg-secondary p-2.5 transition-colors hover:border-border-focus">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-text-primary">
                              {s.name}
                            </div>
                            <div className="mt-0.5 truncate font-mono text-xs text-text-muted">
                              {s.command.slice(0, 80)}
                              {s.command.length > 80 ? "…" : ""}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <IconButton
                              title="Run snippet"
                              onClick={() => runSnippet(s)}
                              className="hover:text-success"
                            >
                              <Play size={13} />
                            </IconButton>
                            <IconButton title="Edit snippet" onClick={() => startEdit(s)}>
                              <Edit2 size={13} />
                            </IconButton>
                            <IconButton
                              title="Delete snippet"
                              onClick={() => setDeletingId(s.id)}
                              className="hover:text-error"
                            >
                              <Trash2 size={13} />
                            </IconButton>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            );
          })
        )}
      </SettingsSection>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      <ConfirmDialog
        open={deletingId !== null}
        title="Delete snippet"
        message={
          deletingSnippet
            ? `Delete "${deletingSnippet.name}"? This can't be undone.`
            : "Delete this snippet? This can't be undone."
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deletingId) deleteSnippet(deletingId);
          setDeletingId(null);
        }}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
