import { Suspense, useRef, useState, type ChangeEvent } from "react";
import { Icon } from "../../ui/icons";
import { useSettingsStore } from "../../stores/settings";
import { useTerminalStore } from "../../stores/terminal";
import { useSshStore } from "../../stores/ssh";
import { getCachedTerminal } from "../../lib/terminal-registry";
import { resolveSnippetVars } from "../../lib/snippet-utils";
import { downloadTextFile } from "../../lib/download-file";
import { Button, EmptyState, IconButton, ListRow, Section, Toolbar, ToolbarButton, cn, ConfirmDialog } from "../../ui";
import { PanelGroup } from "../sidebar/PanelChrome";
import { lazyWithPreload, useEverTrue } from "../../lib/lazy";
import { groupSnippets, mergeImportedSnippets, saveSnippet, type SnippetDraft } from "./snippets";
import type { Snippet } from "../../types/settings";

const SnippetDialog = lazyWithPreload(() => import("./SnippetDialog"));

const EMPTY_DRAFT: SnippetDraft = { name: "", category: "", command: "" };
/** Stable fallback, so the store selector does not return a new array on every read. */
const NO_SNIPPETS: Snippet[] = [];

/** Variables for the active pane: SSH host and user when it is an SSH tab. */
function snippetContext() {
  const state = useTerminalStore.getState();
  const paneId = state.activePaneId;
  const pane = paneId ? state.panes[paneId] : undefined;
  const conn = pane?.sshConnectionId
    ? useSshStore.getState().connections.find((c) => c.id === pane.sshConnectionId)
    : undefined;
  return { hostname: conn?.host ?? "localhost", username: conn?.username ?? "", cwd: pane?.cwd ?? "", paneId: paneId ?? "" };
}

/** Types the snippet into the active terminal, one line every 50ms. */
function runSnippet(snippet: Snippet) {
  const paneId = useTerminalStore.getState().activePaneId;
  if (!paneId) return;
  const entry = getCachedTerminal(paneId);
  if (!entry) return;
  resolveSnippetVars(snippet.command, snippetContext())
    .split("\n")
    .forEach((line, i) => setTimeout(() => entry.terminal.paste(line + "\r"), i * 50));
}

/** Settings > Snippets: saved commands, grouped by category. */
export default function SnippetsPanel() {
  const snippets = useSettingsStore((s) => s.settings.snippets ?? NO_SNIPPETS);
  const update = useSettingsStore((s) => s.update);

  const [dialog, setDialog] = useState<{ draft: SnippetDraft; editingId: string | null } | null>(null);
  const dialogMounted = useEverTrue(dialog !== null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const groups = groupSnippets(snippets);
  const deleting = deletingId ? snippets.find((s) => s.id === deletingId) : undefined;

  const save = (list: Snippet[]) => void update("snippets", list);

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so the same file can be imported again.
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const merged = mergeImportedSnippets(snippets, JSON.parse(String(reader.result)), () => crypto.randomUUID());
        if (merged) save(merged);
      } catch {
        // Not JSON: nothing to import.
      }
    };
    reader.readAsText(file);
  };

  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="flex flex-col gap-6">
      <Section
        title="Snippets"
        description="Saved commands. Run them from here or from the command palette."
        actions={
          <Toolbar aria-label="Snippet actions" className="gap-1">
            <ToolbarButton>
              <Button size="sm" variant="ghost" leadingIcon={<Icon name="import" size="sm" />} onClick={() => fileInputRef.current?.click()}>
                Import
              </Button>
            </ToolbarButton>
            <ToolbarButton>
              <Button
                size="sm"
                variant="ghost"
                leadingIcon={<Icon name="export" size="sm" />}
                disabled={snippets.length === 0}
                onClick={() => downloadTextFile("wayterm-snippets.json", JSON.stringify(snippets, null, 2), "application/json")}
              >
                Export
              </Button>
            </ToolbarButton>
            <ToolbarButton>
              <Button
                size="sm"
                variant="primary"
                leadingIcon={<Icon name="add" size="sm" />}
                onClick={() => setDialog({ draft: EMPTY_DRAFT, editingId: null })}
              >
                New snippet
              </Button>
            </ToolbarButton>
          </Toolbar>
        }
      >
        {groups.length === 0 ? (
          <EmptyState
            icon={<Icon name="script" size="md" />}
            title="No snippets yet"
            description="Save commands you run often, then launch them from the command palette."
            action={
              <Button size="sm" leadingIcon={<Icon name="add" size="sm" />} onClick={() => setDialog({ draft: EMPTY_DRAFT, editingId: null })}>
                New snippet
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {groups.map((group) => {
              const key = group.category ?? "";
              const open = groups.length === 1 || !collapsed.has(key);
              return (
                <PanelGroup
                  key={key}
                  title={group.category ?? "Uncategorized"}
                  count={group.snippets.length}
                  actions={
                    groups.length > 1 && (
                      <IconButton
                        size="xs"
                        label={open ? "Collapse" : "Expand"}
                        aria-expanded={open}
                        icon={<Icon name="disclosure" size="sm" className={cn("transition-transform duration-150 ease-out", open && "rotate-90")} />}
                        onClick={() => toggleGroup(key)}
                      />
                    )
                  }
                >
                  {open &&
                    group.snippets.map((snippet) => (
                      <ListRow
                        key={snippet.id}
                        label={snippet.name}
                        description={<span className="font-mono">{snippet.command}</span>}
                        onSelect={() =>
                          setDialog({
                            draft: { name: snippet.name, category: snippet.category ?? "", command: snippet.command },
                            editingId: snippet.id,
                          })
                        }
                        actions={
                          <>
                            <IconButton size="xs" label="Run snippet" icon={<Icon name="run" size="sm" />} onClick={() => runSnippet(snippet)} />
                            <IconButton
                              size="xs"
                              label="Edit snippet"
                              icon={<Icon name="edit" size="sm" />}
                              onClick={() =>
                                setDialog({
                                  draft: { name: snippet.name, category: snippet.category ?? "", command: snippet.command },
                                  editingId: snippet.id,
                                })
                              }
                            />
                            <IconButton
                              size="xs"
                              label="Delete snippet"
                              icon={<Icon name="delete" size="sm" />}
                              onClick={() => setDeletingId(snippet.id)}
                            />
                          </>
                        }
                      />
                    ))}
                </PanelGroup>
              );
            })}
          </div>
        )}
      </Section>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        aria-label="Import snippets file"
        className="hidden"
        onChange={handleImport}
      />

      {dialogMounted && (
        <Suspense fallback={null}>
          <SnippetDialog
            draft={dialog?.draft ?? null}
            editing={dialog?.editingId != null}
            onSave={(draft) => {
              save(saveSnippet(snippets, draft, dialog?.editingId ?? null, () => crypto.randomUUID()));
              setDialog(null);
            }}
            onCancel={() => setDialog(null)}
          />
        </Suspense>
      )}

      <ConfirmDialog
        open={deletingId !== null}
        title="Delete snippet"
        message={
          deleting ? `Delete "${deleting.name}"? This can't be undone.` : "Delete this snippet? This can't be undone."
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deletingId) save(snippets.filter((s) => s.id !== deletingId));
          setDeletingId(null);
        }}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
