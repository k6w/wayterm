import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { SNIPPET_VARIABLE_HINTS } from "../../lib/snippet-utils";
import { isMac } from "../../lib/platform";
import { Button, Dialog, DialogContent, Field, Input, Textarea, Tooltip } from "../../ui";
import { isDraftValid, type SnippetDraft } from "./snippets";

interface SnippetDialogProps {
  /** null keeps the dialog closed. */
  draft: SnippetDraft | null;
  /** True when editing an existing snippet (changes the title). */
  editing: boolean;
  onSave: (draft: SnippetDraft) => void;
  onCancel: () => void;
}

/** Add or edit a snippet. The form mounts on open, so it always starts from `draft`. */
export default function SnippetDialog({ draft, editing, onSave, onCancel }: SnippetDialogProps) {
  return (
    <Dialog
      open={draft !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      {draft && <SnippetForm initial={draft} editing={editing} onSave={onSave} onCancel={onCancel} />}
    </Dialog>
  );
}

function SnippetForm({
  initial,
  editing,
  onSave,
  onCancel,
}: {
  initial: SnippetDraft;
  editing: boolean;
  onSave: (draft: SnippetDraft) => void;
  onCancel: () => void;
}) {
  const formId = useId();
  const [draft, setDraft] = useState(initial);
  const valid = isDraftValid(draft);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (valid) onSave(draft);
  };

  // Enter in a one-line field and Mod+Enter anywhere (the command box takes
  // plain Enter as a newline) save. Handled here because the Save button sits
  // in the dialog footer, outside the <form>.
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    const mod = isMac ? event.metaKey : event.ctrlKey;
    if (mod || (event.target as HTMLElement).tagName === "INPUT") {
      event.preventDefault();
      submit();
    }
  };

  const set = (key: keyof SnippetDraft) => (value: string) => setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <DialogContent
      size="md"
      title={editing ? "Edit snippet" : "New snippet"}
      description="Saved commands run in the active terminal."
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" type="submit" form={formId} disabled={!valid} shortcut="Mod+Enter">
            Save
          </Button>
        </>
      }
    >
      <form id={formId} className="flex flex-col gap-3" onSubmit={submit} onKeyDown={handleKeyDown}>
        <Field label="Name">
          {(control) => (
            <Input {...control} autoFocus placeholder="Tail the app log" value={draft.name} onChange={(e) => set("name")(e.target.value)} />
          )}
        </Field>
        <Field label="Category" hint="Optional. Snippets with the same category are listed together.">
          {(control) => <Input {...control} placeholder="ops" value={draft.category} onChange={(e) => set("category")(e.target.value)} />}
        </Field>
        <Field label="Command">
          {(control) => (
            <Textarea
              {...control}
              rows={4}
              className="font-mono"
              placeholder="tail -f /var/log/app.log"
              value={draft.command}
              onChange={(e) => set("command")(e.target.value)}
            />
          )}
        </Field>
        <div className="flex flex-wrap gap-1" aria-label="Insert a variable" role="group">
          {SNIPPET_VARIABLE_HINTS.map((hint) => (
            <Tooltip key={hint.variable} content={hint.description}>
              <Button
                size="xs"
                variant="secondary"
                className="font-mono"
                onClick={() => set("command")(draft.command + hint.variable)}
              >
                {hint.variable}
              </Button>
            </Tooltip>
          ))}
        </div>
      </form>
    </DialogContent>
  );
}
