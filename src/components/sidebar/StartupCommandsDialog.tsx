import { useId, useState, type KeyboardEvent } from "react";
import { Icon } from "../../ui/icons";
import { Button, Dialog, DialogContent, FormGroup, FormRow, Textarea } from "../../ui";
import { isMac } from "../../lib/platform";
import type { StartupTarget } from "../../lib/workspace-snapshot";

interface StartupCommandsDialogProps {
  open: boolean;
  /** Workspace name, for the header. */
  name: string;
  targets: StartupTarget[];
  /** Total panes in the workspace; the saved list has one entry per pane. */
  paneCount: number;
  /** One list of commands per pane, in snapshot order. */
  onSave: (commands: string[][]) => void;
  onCancel: () => void;
}

/** Edits the commands each pane of a workspace types once its shell is ready. Mounts its form on open. */
export default function StartupCommandsDialog({ open, onCancel, ...props }: StartupCommandsDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      {open && <StartupCommandsForm onCancel={onCancel} {...props} />}
    </Dialog>
  );
}

function StartupCommandsForm({ name, targets, paneCount, onSave, onCancel }: Omit<StartupCommandsDialogProps, "open">) {
  const formId = useId();
  const [text, setText] = useState(() => Object.fromEntries(targets.map((t) => [t.index, t.commands.join("\n")])));

  const submit = () => {
    const commands: string[][] = Array.from({ length: paneCount }, () => []);
    for (const target of targets) {
      commands[target.index] = (text[target.index] ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
    }
    onSave(commands);
  };

  // The Save button sits in the footer, outside the form: Mod+Enter saves from any box (Enter adds a line).
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && (isMac ? event.metaKey : event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  };

  const tabs = targets.reduce<{ tabIndex: number; title: string; items: StartupTarget[] }[]>((groups, target) => {
    const last = groups[groups.length - 1];
    if (last && last.tabIndex === target.tabIndex) last.items.push(target);
    else groups.push({ tabIndex: target.tabIndex, title: target.tab, items: [target] });
    return groups;
  }, []);

  return (
    <DialogContent
      size="md"
      title="Startup commands"
      description={`${name}: typed into each pane once it is ready, one command per line.`}
      icon={<Icon name="run" size="md" />}
      hints={[
        { shortcut: "Escape", label: "Cancel" },
        { shortcut: "Mod+Enter", label: "Save" },
      ]}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} disabled={targets.length === 0}>
            Save
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        onKeyDown={handleKeyDown}
      >
        {targets.length === 0 ? (
          <p className="text-body text-fg-muted">This workspace has no shell or SSH panes to run commands in.</p>
        ) : (
          tabs.map((group) => (
            <FormGroup key={group.tabIndex} title={group.title}>
              {group.items.map((target) => (
                <FormRow key={target.index} label={`Pane ${target.number}`} hint={target.description} width="full">
                  {(control) => (
                    <Textarea
                      {...control}
                      code
                      rows={3}
                      placeholder="npm run dev"
                      value={text[target.index] ?? ""}
                      onChange={(e) => setText((prev) => ({ ...prev, [target.index]: e.target.value }))}
                    />
                  )}
                </FormRow>
              ))}
            </FormGroup>
          ))
        )}
      </form>
    </DialogContent>
  );
}
