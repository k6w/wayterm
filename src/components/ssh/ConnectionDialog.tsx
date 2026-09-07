import { useId, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import { Icon } from "../../ui/icons";
import { Button, Dialog, DialogContent, FormDisclosure, FormGroup, FormRow, IconButton, Input, PreviewChip, SegmentedControl, Select, Switch, Textarea, cn, focusRing, type SegmentedOption } from "../../ui";
import { useSshStore } from "../../stores/ssh";
import { useTerminalStore } from "../../stores/terminal";
import { useThemeStore } from "../../stores/theme";
import { isMac } from "../../lib/platform";
import { CONNECTION_TAG_COLORS } from "../../themes/connection-tags";
import type { AuthMethod, SshConnection } from "../../types/ssh";
import {
  advancedChangeCount,
  connectionPreview,
  createFormState,
  toConnection,
  validateConnectionForm,
  type ConnectionFormErrors,
  type ConnectionFormState,
} from "./connection-form";

interface ConnectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (connection: SshConnection) => void | Promise<void>;
  editConnection?: SshConnection | null;
}

// Radix Select reserves "" for "no value", so the "none" choices get sentinels.
const KEY_PATH = "__path__";
const NO_JUMP_HOST = "__none__";
const INHERIT_THEME = "__inherit__";

const AUTH_OPTIONS: readonly SegmentedOption<AuthMethod>[] = [
  { value: "password", label: "Password", icon: <Icon name="password" size="sm" /> },
  { value: "key", label: "Key", icon: <Icon name="key" size="sm" /> },
  { value: "agent", label: "Agent", icon: <Icon name="security" size="sm" /> },
];

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error.";
}

const NO_ERRORS: ConnectionFormErrors = {};

/** New / edit SSH connection. The form mounts on every open, so it starts from `editConnection`. */
export default function ConnectionDialog({ isOpen, onClose, onSave, editConnection }: ConnectionDialogProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      {isOpen && <ConnectionForm onClose={onClose} onSave={onSave} editConnection={editConnection ?? null} />}
    </Dialog>
  );
}

interface ConnectionFormProps {
  onClose: () => void;
  onSave: (connection: SshConnection) => void | Promise<void>;
  editConnection: SshConnection | null;
}

function ConnectionForm({ onClose, onSave, editConnection }: ConnectionFormProps) {
  const [form, setForm] = useState<ConnectionFormState>(() => createFormState(editConnection));
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvVal, setNewEnvVal] = useState("");
  const storedKeys = useSshStore((s) => s.keys);
  const allConnections = useSshStore((s) => s.connections);
  const themes = useThemeStore((s) => s.themes);
  const formRef = useRef<HTMLFormElement>(null);
  // Which button submitted the form; "save" unless Save & Connect or Mod+Enter said otherwise.
  const intentRef = useRef<"save" | "connect">("save");
  const nameRef = useRef<HTMLInputElement>(null);
  const formId = useId();

  const errors = submitted ? validateConnectionForm(form) : NO_ERRORS;

  const update = <K extends keyof ConnectionFormState>(key: K, value: ConnectionFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const intent = intentRef.current;
    intentRef.current = "save";
    setSubmitted(true);
    if (Object.keys(validateConnectionForm(form)).length > 0) {
      requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
      return;
    }
    const connection = toConnection(form, editConnection, new Date().toISOString(), () => crypto.randomUUID());
    setSaveError(null);
    // The tab (Save & Connect) opens only once the connection is persisted.
    void (async () => {
      try {
        await onSave(connection);
      } catch (error) {
        setSaveError(errorMessage(error));
        return;
      }
      if (intent === "save") return;
      const { addTab, renameTab } = useTerminalStore.getState();
      addTab("ssh", undefined, connection.id);
      const { tabs } = useTerminalStore.getState();
      const newTab = tabs[tabs.length - 1];
      if (newTab) renameTab(newTab.id, connection.name);
    })();
  };

  // Mod+Enter submits from any field, including the startup commands box.
  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Enter" && (isMac ? event.metaKey : event.ctrlKey)) {
      event.preventDefault();
      intentRef.current = "connect";
      formRef.current?.requestSubmit();
    }
  };

  const addEnvVar = () => {
    const key = newEnvKey.trim();
    if (!key) return;
    setForm((prev) => ({ ...prev, envVars: { ...prev.envVars, [key]: newEnvVal.trim() } }));
    setNewEnvKey("");
    setNewEnvVal("");
  };

  const removeEnvVar = (key: string) => {
    setForm((prev) => {
      const next = { ...prev.envVars };
      delete next[key];
      return { ...prev, envVars: next };
    });
  };

  const onEnvKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      addEnvVar();
    }
  };

  const keyOptions = [
    { value: KEY_PATH, label: "Use the key path below" },
    ...storedKeys.map((k) => ({ value: k.id, label: `${k.name} (${k.algorithm})` })),
  ];
  const jumpHostOptions = [
    { value: NO_JUMP_HOST, label: "None" },
    ...allConnections
      .filter((c) => c.id !== editConnection?.id)
      .map((c) => ({ value: c.id, label: `${c.name} (${c.host}:${c.port})` })),
  ];
  const themeOptions = [
    { value: INHERIT_THEME, label: "Default (inherit)" },
    ...Object.values(themes).map((t) => ({ value: t.id, label: t.name })),
  ];

  const tag = CONNECTION_TAG_COLORS.find((color) => color.name === form.colorTag);
  const changed = advancedChangeCount(form);

  return (
    <DialogContent
      title={editConnection ? "Edit connection" : "New connection"}
      description={editConnection ? "Change how nexterm reaches this host." : "Save a host you can open in one click."}
      icon={<Icon name="server" size="md" />}
      hints={[
        { shortcut: "Escape", label: "Cancel" },
        { shortcut: "Mod+Enter", label: "Save & connect" },
      ]}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        nameRef.current?.focus();
      }}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} onClick={() => (intentRef.current = "save")}>
            Save
          </Button>
          <Button type="submit" form={formId} variant="primary" onClick={() => (intentRef.current = "connect")}>
            Save & Connect
          </Button>
        </>
      }
    >
      {saveError && (
        <p
          role="alert"
          className="mb-3 rounded-md border border-danger bg-danger-subtle px-3 py-2 text-label text-danger"
        >
          Could not save this connection: {saveError}
        </p>
      )}
      <form
        ref={formRef}
        id={formId}
        noValidate
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        className="flex flex-col gap-4"
      >
        <PreviewChip label="Connection preview" dot={tag?.value}>
          {connectionPreview(form)}
        </PreviewChip>

        <FormGroup title="Connection">
          <FormRow label="Name" error={errors.name}>
            {(control) => (
              <Input
                {...control}
                ref={nameRef}
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="My Server"
              />
            )}
          </FormRow>
          <FormRow label="Host" error={errors.host}>
            {(control) => (
              <Input
                {...control}
                value={form.host}
                onChange={(e) => update("host", e.target.value)}
                placeholder="hostname or IP"
                code
              />
            )}
          </FormRow>
          <FormRow label="Port" error={errors.port} width="sm">
            {(control) => (
              <Input
                {...control}
                code
                inputMode="numeric"
                value={form.port}
                onChange={(e) => update("port", e.target.value)}
              />
            )}
          </FormRow>
          <FormRow label="Username" error={errors.username}>
            {(control) => (
              <Input
                {...control}
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
                placeholder="root"
                code
              />
            )}
          </FormRow>
          <FormRow label="Color tag" width="auto">
            <ColorTagPicker value={form.colorTag} onChange={(next) => update("colorTag", next)} />
          </FormRow>
          <FormRow label="Startup commands" hint="Run after the connection opens (optional)" width="full">
            {(control) => (
              <Textarea
                {...control}
                code
                value={form.startupCommands}
                onChange={(e) => update("startupCommands", e.target.value)}
                placeholder="cd /srv/app"
              />
            )}
          </FormRow>
        </FormGroup>

        <FormGroup title="Authentication">
          <FormRow label="Method" width="auto">
            <SegmentedControl
              aria-label="Authentication method"
              value={form.authMethod}
              onValueChange={(method) => update("authMethod", method)}
              options={AUTH_OPTIONS}
            />
          </FormRow>
          {form.authMethod === "password" && (
            <FormRow label="Password" hint="Not saved. SSH asks for the password each time you connect.">
              {(control) => (
                <Input
                  {...control}
                  type="password"
                  autoComplete="off"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder="Enter password"
                />
              )}
            </FormRow>
          )}
          {form.authMethod === "key" && (
            <>
              {storedKeys.length > 0 && (
                <FormRow label="Stored key">
                  {({ id }) => (
                    <Select
                      id={id}
                      value={form.selectedKeyId || KEY_PATH}
                      onValueChange={(v) => update("selectedKeyId", v === KEY_PATH ? "" : v)}
                      options={keyOptions}
                    />
                  )}
                </FormRow>
              )}
              {!form.selectedKeyId && (
                <FormRow label="Private key path">
                  {(control) => (
                    <Input
                      {...control}
                      code
                      value={form.privateKeyPath}
                      onChange={(e) => update("privateKeyPath", e.target.value)}
                      placeholder="~/.ssh/id_ed25519"
                    />
                  )}
                </FormRow>
              )}
              <FormRow label="Passphrase (optional)">
                {(control) => (
                  <Input
                    {...control}
                    type="password"
                    autoComplete="off"
                    value={form.passphrase}
                    onChange={(e) => update("passphrase", e.target.value)}
                    placeholder="Key passphrase"
                  />
                )}
              </FormRow>
            </>
          )}
          {form.authMethod === "agent" && (
            <p className="px-row-x py-row-y text-label text-fg-muted">
              SSH agent forwarding will be used. Make sure your SSH agent is running and has the appropriate keys
              loaded.
            </p>
          )}
        </FormGroup>

        <FormDisclosure title="Advanced" count={changed}>
          <FormRow label="Jump host (ProxyJump)" hint="Connect through this host as a bastion/jump server">
            {({ id }) => (
              <Select
                id={id}
                value={form.jumpHostId ?? NO_JUMP_HOST}
                onValueChange={(v) => update("jumpHostId", v === NO_JUMP_HOST ? null : v)}
                options={jumpHostOptions}
              />
            )}
          </FormRow>
          <FormRow label="Terminal theme override">
            {({ id }) => (
              <Select
                id={id}
                value={form.themeOverride ?? INHERIT_THEME}
                onValueChange={(v) => update("themeOverride", v === INHERIT_THEME ? null : v)}
                options={themeOptions}
              />
            )}
          </FormRow>
          <FormRow label="Agent forwarding" hint="Forward your SSH agent to the remote host" width="auto">
            {({ id }) => (
              <Switch
                id={id}
                checked={form.agentForwarding}
                onCheckedChange={(checked) => update("agentForwarding", checked)}
              />
            )}
          </FormRow>
          <FormRow label="Environment variables" width="full">
            <div className="flex flex-col gap-1.5">
              {Object.entries(form.envVars).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-raised px-2 py-1 font-mono text-label text-fg">
                    {key}={value}
                  </code>
                  <IconButton
                    label={`Remove ${key}`}
                    icon={<Icon name="delete" size="sm" />}
                    onClick={() => removeEnvVar(key)}
                  />
                </div>
              ))}
              <div data-testid="env-add" className="grid grid-cols-2 gap-2">
                <Input
                  aria-label="Variable name"
                  code
                  value={newEnvKey}
                  onChange={(e) => setNewEnvKey(e.target.value)}
                  onKeyDown={onEnvKeyDown}
                  placeholder="KEY"
                />
                <Input
                  aria-label="Variable value"
                  code
                  value={newEnvVal}
                  onChange={(e) => setNewEnvVal(e.target.value)}
                  onKeyDown={onEnvKeyDown}
                  placeholder="value"
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="self-end"
                disabled={!newEnvKey.trim()}
                onClick={addEnvVar}
              >
                <Icon name="add" size="sm" aria-hidden />
                Add variable
              </Button>
            </div>
          </FormRow>
        </FormDisclosure>
      </form>
    </DialogContent>
  );
}

interface ColorTagPickerProps {
  value: string | null;
  onChange: (tag: string | null) => void;
}

function ColorTagPicker({ value, onChange }: ColorTagPickerProps) {
  const dot = cn(
    "inline-flex size-5 items-center justify-center rounded-full transition-shadow duration-150 ease-out",
    focusRing
  );
  const selected = "ring-2 ring-fg";
  return (
    <div role="group" aria-label="Color tag" className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="No color"
        aria-pressed={value === null}
        onClick={() => onChange(null)}
        className={cn(dot, value === null && selected)}
      >
        <span className="inline-flex size-4 items-center justify-center rounded-full border border-border-strong bg-raised text-fg-muted">
          <Icon name="remove" size={10} aria-hidden />
        </span>
      </button>
      {CONNECTION_TAG_COLORS.map((color) => (
        <button
          key={color.name}
          type="button"
          aria-label={color.label}
          aria-pressed={value === color.name}
          onClick={() => onChange(color.name)}
          className={cn(dot, value === color.name && selected)}
        >
          <span
            style={{ "--nx-dyn-tag": color.value } as CSSProperties}
            className="size-4 rounded-full bg-(--nx-dyn-tag)"
          />
        </button>
      ))}
    </div>
  );
}
