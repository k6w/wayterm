import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Database } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  FormGroup,
  FormRow,
  ICON_MD,
  Input,
  PreviewChip,
  Select,
  Switch,
} from "../../ui";
import {
  DATABASE_TYPES,
  changeDatabaseType,
  connectionString,
  isFileDatabase,
  EMPTY_DATABASE_FORM,
  toDatabaseConnection,
  validateDatabaseForm,
  type DatabaseFormState,
} from "./database-form";
import type { DatabaseConnection } from "../../types/database";

interface DatabaseConnectionDialogProps {
  open: boolean;
  /** Resolves once saved; a rejection keeps the dialog open and shows the message. */
  onSave: (connection: DatabaseConnection) => Promise<void>;
  onClose: () => void;
}

/** New database connection. The form mounts on open, so it always starts empty. */
export default function DatabaseConnectionDialog({ open, onSave, onClose }: DatabaseConnectionDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      {open && <ConnectionForm onSave={onSave} onClose={onClose} />}
    </Dialog>
  );
}

type TextKey = "name" | "host" | "port" | "database" | "username" | "password";

function ConnectionForm({ onSave, onClose }: Omit<DatabaseConnectionDialogProps, "open">) {
  const formId = useId();
  const inputs = useRef<Partial<Record<TextKey, HTMLInputElement | null>>>({});
  const [form, setForm] = useState<DatabaseFormState>(EMPTY_DATABASE_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const errors = submitted ? validateDatabaseForm(form) : {};

  const set = <K extends keyof DatabaseFormState>(key: K, value: DatabaseFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    const found = validateDatabaseForm(form);
    if (Object.keys(found).length > 0) {
      const first = (["name", "host", "port", "database", "username"] as const).find((key) => found[key]);
      if (first) inputs.current[first]?.focus();
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(toDatabaseConnection(form, () => crypto.randomUUID()));
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  // The Save button sits in the dialog footer, outside the <form>, so Enter in
  // a field (or Mod+Enter anywhere) submits explicitly (and only once: preventDefault stops the
  // browser's own implicit submission).
  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    const inField = (event.target as HTMLElement).tagName === "INPUT";
    if (event.key === "Enter" && (inField || event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  };

  const text = (key: TextKey, label: string, extra = {}, width: "sm" | "md" = "md") => (
    <FormRow label={label} error={key === "password" ? undefined : errors[key]} width={width}>
      {(control) => (
        <Input
          {...control}
          code={key !== "name"}
          ref={(el) => {
            inputs.current[key] = el;
          }}
          value={form[key]}
          onChange={(e) => set(key, e.target.value)}
          {...extra}
        />
      )}
    </FormRow>
  );

  return (
    <DialogContent
      size="md"
      title="New database connection"
      description="Query a database from a tab next to your terminals."
      icon={<Database {...ICON_MD} />}
      hints={[
        { shortcut: "Escape", label: "Cancel" },
        { shortcut: "Mod+Enter", label: "Save" },
      ]}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} loading={saving}>
            Save connection
          </Button>
        </>
      }
    >
      <form id={formId} noValidate className="flex flex-col gap-4" onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
        <PreviewChip label="Connection string preview">{connectionString(form)}</PreviewChip>
        <FormGroup title="Connection">
          {text("name", "Name", { autoFocus: true, placeholder: "App database" })}
          <FormRow label="Type">
            {(control) => (
              <Select
                id={control.id}
                value={form.type}
                onValueChange={(value) => setForm((prev) => changeDatabaseType(prev, value as DatabaseFormState["type"]))}
                options={DATABASE_TYPES}
              />
            )}
          </FormRow>
          {isFileDatabase(form.type) && text("database", "File path", { placeholder: "/path/to/data.db" })}
        </FormGroup>
        {!isFileDatabase(form.type) && (
          <>
            <FormGroup title="Server">
              {text("host", "Host")}
              {text("port", "Port", { inputMode: "numeric" }, "sm")}
              {text("database", "Database")}
              <FormRow label="Use SSL" width="auto">
                {(control) => (
                  <Switch id={control.id} checked={form.ssl} onCheckedChange={(checked) => set("ssl", checked)} />
                )}
              </FormRow>
            </FormGroup>
            <FormGroup title="Credentials">
              {text("username", "Username", { autoComplete: "off" })}
              {text("password", "Password", { type: "password", autoComplete: "off" })}
            </FormGroup>
          </>
        )}
        {saveError && (
          <p role="alert" className="rounded-md border border-danger bg-danger-subtle px-2 py-1.5 text-label text-danger">
            {saveError}
          </p>
        )}
      </form>
    </DialogContent>
  );
}
