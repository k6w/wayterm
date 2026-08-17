import { useId, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import { ChevronRight, KeyRound, Lock, Plus, Shield, Trash2, X } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  Field,
  IconButton,
  Input,
  Section,
  SegmentedControl,
  Select,
  Switch,
  Textarea,
  cn,
  focusRing,
  ICON_SM,
  type SegmentedOption,
} from "../../ui";
import { useSshStore } from "../../stores/ssh";
import { useTerminalStore } from "../../stores/terminal";
import { useThemeStore } from "../../stores/theme";
import { isMac } from "../../lib/platform";
import { CONNECTION_TAG_COLORS } from "../../themes/connection-tags";
import type { AuthMethod, SshConnection } from "../../types/ssh";
import {
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
  { value: "password", label: "Password", icon: <Lock {...ICON_SM} /> },
  { value: "key", label: "Key", icon: <KeyRound {...ICON_SM} /> },
  { value: "agent", label: "Agent", icon: <Shield {...ICON_SM} /> },
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
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
  const advancedId = useId();
  const agentForwardingId = useId();

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

  return (
    <DialogContent
      title={editConnection ? "Edit connection" : "New connection"}
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
          <Button
            type="submit"
            form={formId}
            variant="primary"
            shortcut="Mod+Enter"
            onClick={() => (intentRef.current = "connect")}
          >
            Save & Connect
          </Button>
        </>
      }
    >
      {saveError && (
        <p
          role="alert"
          className="mb-3 rounded-md border border-danger bg-raised px-3 py-2 text-label text-danger"
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
        className="flex flex-col gap-6 py-1"
      >
        <Section title="Connection">
          <Field label="Name" error={errors.name}>
            {(control) => (
              <Input
                {...control}
                ref={nameRef}
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="My Server"
              />
            )}
          </Field>
          <div className="grid grid-cols-[1fr_96px] items-start gap-3">
            <Field label="Host" error={errors.host}>
              {(control) => (
                <Input
                  {...control}
                  value={form.host}
                  onChange={(e) => update("host", e.target.value)}
                  placeholder="hostname or IP"
                  code
                />
              )}
            </Field>
            <Field label="Port" error={errors.port}>
              {(control) => (
                <Input
                  {...control}
                  code
                  inputMode="numeric"
                  value={form.port}
                  onChange={(e) => update("port", e.target.value)}
                />
              )}
            </Field>
          </div>
          <Field label="Username" error={errors.username}>
            {(control) => (
              <Input
                {...control}
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
                placeholder="root"
                code
              />
            )}
          </Field>
          <ColorTagPicker value={form.colorTag} onChange={(tag) => update("colorTag", tag)} />
          <Field label="Startup commands" hint="Run after the connection opens (optional)">
            {(control) => (
              <Textarea
                {...control}
                code
                value={form.startupCommands}
                onChange={(e) => update("startupCommands", e.target.value)}
                placeholder="cd /srv/app"
              />
            )}
          </Field>
        </Section>

        <Section title="Authentication">
          <SegmentedControl
            aria-label="Authentication method"
            value={form.authMethod}
            onValueChange={(method) => update("authMethod", method)}
            options={AUTH_OPTIONS}
            className="self-start"
          />
          {form.authMethod === "password" && (
            <Field label="Password" hint="Not saved. SSH asks for the password each time you connect.">
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
            </Field>
          )}
          {form.authMethod === "key" && (
            <>
              {storedKeys.length > 0 && (
                <Field label="Stored key">
                  {({ id }) => (
                    <Select
                      id={id}
                      value={form.selectedKeyId || KEY_PATH}
                      onValueChange={(v) => update("selectedKeyId", v === KEY_PATH ? "" : v)}
                      options={keyOptions}
                    />
                  )}
                </Field>
              )}
              {!form.selectedKeyId && (
                <Field label="Private key path">
                  {(control) => (
                    <Input
                      {...control}
                      code
                      value={form.privateKeyPath}
                      onChange={(e) => update("privateKeyPath", e.target.value)}
                      placeholder="~/.ssh/id_ed25519"
                    />
                  )}
                </Field>
              )}
              <Field label="Passphrase (optional)">
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
              </Field>
            </>
          )}
          {form.authMethod === "agent" && (
            <p className="rounded-md border border-border bg-raised px-3 py-2 text-label text-fg-secondary">
              SSH agent forwarding will be used. Make sure your SSH agent is running and has the appropriate keys
              loaded.
            </p>
          )}
        </Section>

        <section aria-labelledby={`${advancedId}-heading`} className="flex flex-col gap-3">
          <h3 id={`${advancedId}-heading`}>
            <button
              type="button"
              aria-expanded={advancedOpen}
              aria-controls={advancedId}
              onClick={() => setAdvancedOpen((open) => !open)}
              className={cn(
                "flex items-center gap-1 rounded-sm text-caption font-semibold uppercase tracking-wide text-fg-muted hover:text-fg",
                focusRing
              )}
            >
              <ChevronRight
                {...ICON_SM}
                aria-hidden
                className={cn("transition-transform duration-150 ease-out", advancedOpen && "rotate-90")}
              />
              Advanced
            </button>
          </h3>
          {advancedOpen && (
            <div id={advancedId} className="flex flex-col gap-3">
              <Field label="Jump host (ProxyJump)" hint="Connect through this host as a bastion/jump server">
                {({ id }) => (
                  <Select
                    id={id}
                    value={form.jumpHostId ?? NO_JUMP_HOST}
                    onValueChange={(v) => update("jumpHostId", v === NO_JUMP_HOST ? null : v)}
                    options={jumpHostOptions}
                  />
                )}
              </Field>
              <Field label="Terminal theme override">
                {({ id }) => (
                  <Select
                    id={id}
                    value={form.themeOverride ?? INHERIT_THEME}
                    onValueChange={(v) => update("themeOverride", v === INHERIT_THEME ? null : v)}
                    options={themeOptions}
                  />
                )}
              </Field>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <label htmlFor={agentForwardingId} className="text-body text-fg">
                    Agent forwarding
                  </label>
                  <p className="text-label text-fg-muted">Forward your SSH agent to the remote host</p>
                </div>
                <Switch
                  id={agentForwardingId}
                  checked={form.agentForwarding}
                  onCheckedChange={(checked) => update("agentForwarding", checked)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-label font-medium text-fg-secondary">Environment variables</span>
                {Object.entries(form.envVars).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-raised px-2 py-1 font-mono text-label text-fg">
                      {key}={value}
                    </code>
                    <IconButton
                      label={`Remove ${key}`}
                      icon={<Trash2 {...ICON_SM} />}
                      onClick={() => removeEnvVar(key)}
                    />
                  </div>
                ))}
                <div className="flex items-center gap-2">
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
                  <IconButton
                    label="Add variable"
                    size="md"
                    icon={<Plus {...ICON_SM} />}
                    disabled={!newEnvKey.trim()}
                    onClick={addEnvVar}
                  />
                </div>
              </div>
            </div>
          )}
        </section>
      </form>
    </DialogContent>
  );
}

interface ColorTagPickerProps {
  value: string | null;
  onChange: (tag: string | null) => void;
}

function ColorTagPicker({ value, onChange }: ColorTagPickerProps) {
  const labelId = useId();
  const swatch = cn(
    "inline-flex size-6 items-center justify-center rounded-full border border-border transition-colors duration-150 ease-out",
    focusRing
  );
  return (
    <div className="flex flex-col gap-1">
      <span id={labelId} className="text-label font-medium text-fg-secondary">
        Color tag
      </span>
      <div role="group" aria-labelledby={labelId} className="flex items-center gap-2">
        <button
          type="button"
          aria-label="No color"
          aria-pressed={value === null}
          onClick={() => onChange(null)}
          className={cn(swatch, "bg-raised text-fg-muted", value === null && "outline-solid outline-2 outline-offset-1 outline-fg")}
        >
          <X {...ICON_SM} aria-hidden />
        </button>
        {CONNECTION_TAG_COLORS.map((color) => (
          <button
            key={color.name}
            type="button"
            aria-label={color.label}
            aria-pressed={value === color.name}
            onClick={() => onChange(color.name)}
            style={{ "--nx-dyn-tag": color.value } as CSSProperties}
            className={cn(
              swatch,
              "bg-(--nx-dyn-tag)",
              value === color.name && "outline-solid outline-2 outline-offset-1 outline-fg"
            )}
          />
        ))}
      </div>
    </div>
  );
}

