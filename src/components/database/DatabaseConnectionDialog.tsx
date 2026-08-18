import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button, Checkbox, Dialog, DialogContent, Field, Input, Select } from "../../ui";
import {
  DATABASE_TYPES,
  changeDatabaseType,
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
  // a field submits explicitly (and only once: preventDefault stops the
  // browser's own implicit submission).
  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  };

  const text = (key: TextKey, label: string, extra = {}) => (
    <Field label={label} error={key === "password" ? undefined : errors[key]}>
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
    </Field>
  );

  return (
    <DialogContent
      size="sm"
      title="New database connection"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form={formId} loading={saving}>
            Save connection
          </Button>
        </>
      }
    >
      <form id={formId} noValidate className="flex flex-col gap-3" onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
        {text("name", "Name", { autoFocus: true, placeholder: "App database" })}
        <Field label="Type">
          {(control) => (
            <Select
              id={control.id}
              value={form.type}
              onValueChange={(value) => setForm((prev) => changeDatabaseType(prev, value as DatabaseFormState["type"]))}
              options={DATABASE_TYPES}
            />
          )}
        </Field>
        {isFileDatabase(form.type) ? (
          text("database", "File path", { placeholder: "/path/to/data.db" })
        ) : (
          <>
            <div className="grid grid-cols-[2fr_1fr] gap-2">
              {text("host", "Host")}
              {text("port", "Port", { inputMode: "numeric" })}
            </div>
            {text("database", "Database")}
            {text("username", "Username", { autoComplete: "off" })}
            {text("password", "Password", { type: "password", autoComplete: "off" })}
            <Checkbox label="Use SSL" checked={form.ssl} onCheckedChange={(checked) => set("ssl", checked === true)} />
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
