import { useState } from "react";
import { Plus, Trash2, Play } from "lucide-react";
import { useSettingsStore } from "../../stores/settings";
import { useTerminalStore } from "../../stores/terminal";
import { writeToTerminal } from "../../lib/terminal-registry";
import type { Snippet } from "../../types/settings";

export default function SnippetsPanel() {
  const snippets = useSettingsStore((s) => s.settings.snippets || []);
  const update = useSettingsStore((s) => s.update);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");

  const save = () => {
    if (!name.trim() || !command.trim()) return;
    const snippet: Snippet = {
      id: editingId || crypto.randomUUID(),
      name: name.trim(),
      command: command.trim(),
    };
    const updated = editingId
      ? snippets.map((s) => (s.id === editingId ? snippet : s))
      : [...snippets, snippet];
    update("snippets" as keyof typeof useSettingsStore extends never ? never : "snippets", updated as never);
    setEditingId(null);
    setName("");
    setCommand("");
  };

  const remove = (id: string) => {
    update("snippets" as never, snippets.filter((s) => s.id !== id) as never);
  };

  const run = (snippet: Snippet) => {
    const paneId = useTerminalStore.getState().activePaneId;
    if (paneId) {
      writeToTerminal(paneId, snippet.command + "\r");
      useTerminalStore.getState().toggleSettings();
    }
  };

  const startEdit = (snippet: Snippet) => {
    setEditingId(snippet.id);
    setName(snippet.name);
    setCommand(snippet.command);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Saved Commands</h3>
        <p className="text-xs text-text-muted mb-4">
          Snippets appear in the command palette for quick execution.
        </p>

        <div className="space-y-2 mb-4">
          {snippets.map((snippet) => (
            <div
              key={snippet.id}
              className="flex items-center gap-2 px-3 py-2 bg-bg-tertiary rounded-lg group"
            >
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => startEdit(snippet)}>
                <p className="text-sm text-text-primary truncate">{snippet.name}</p>
                <p className="text-xs text-text-muted font-mono truncate">{snippet.command}</p>
              </div>
              <button
                onClick={() => run(snippet)}
                className="p-1 text-text-muted hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity"
                title="Run"
              >
                <Play size={14} />
              </button>
              <button
                onClick={() => remove(snippet.id)}
                className="p-1 text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {snippets.length === 0 && (
            <p className="text-sm text-text-muted py-4 text-center">No snippets yet</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">
          {editingId ? "Edit Snippet" : "Add Snippet"}
        </h3>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Name (e.g. Docker PS)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-bg-tertiary border border-border rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <input
            type="text"
            placeholder="Command (e.g. docker ps -a)"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            className="w-full px-3 py-2 text-sm bg-bg-tertiary border border-border rounded-md text-text-primary placeholder:text-text-muted font-mono focus:outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={!name.trim() || !command.trim()}
              className="px-3 py-1.5 text-sm rounded-md bg-accent text-white disabled:opacity-50 transition-colors"
            >
              <Plus size={14} className="inline mr-1" />
              {editingId ? "Update" : "Add"}
            </button>
            {editingId && (
              <button
                onClick={() => { setEditingId(null); setName(""); setCommand(""); }}
                className="px-3 py-1.5 text-sm rounded-md bg-bg-tertiary text-text-secondary border border-border"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
