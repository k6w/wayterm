import type { AuthMethod, SshConnection } from "../../types/ssh";

/**
 * Everything the connection dialog edits. Password, key path and passphrase
 * are typed in the dialog but are not part of SshConnection and are never
 * saved (unchanged from before the redesign).
 */
export interface ConnectionFormState {
  name: string;
  host: string;
  /** Kept as typed so a half-typed port can be shown and validated. */
  port: string;
  username: string;
  authMethod: AuthMethod;
  password: string;
  privateKeyPath: string;
  /** "" means "use the key path instead". */
  selectedKeyId: string;
  passphrase: string;
  colorTag: string | null;
  startupCommands: string;
  jumpHostId: string | null;
  themeOverride: string | null;
  agentForwarding: boolean;
  envVars: Record<string, string>;
}

export type ConnectionFormErrors = Partial<Record<"name" | "host" | "port" | "username", string>>;

export function createFormState(edit?: SshConnection | null): ConnectionFormState {
  return {
    name: edit?.name ?? "",
    host: edit?.host ?? "",
    port: String(edit?.port ?? 22),
    username: edit?.username ?? "",
    authMethod: edit?.authMethod ?? "password",
    password: "",
    privateKeyPath: "",
    selectedKeyId: edit?.privateKeyId ?? "",
    passphrase: "",
    colorTag: edit?.colorTag ?? null,
    startupCommands: edit?.startupCommands ?? "",
    jumpHostId: edit?.jumpHostId ?? null,
    themeOverride: edit?.themeOverride ?? null,
    agentForwarding: edit?.agentForwarding ?? false,
    envVars: edit?.envVars ?? {},
  };
}

/** The port as a number when it is a whole number from 1 to 65535, else null. */
export function parsePort(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const port = Number(trimmed);
  return port >= 1 && port <= 65535 ? port : null;
}

/** Inline validation messages; an empty object means the form can be saved. */
export function validateConnectionForm(form: ConnectionFormState): ConnectionFormErrors {
  const errors: ConnectionFormErrors = {};
  if (!form.name.trim()) errors.name = "Enter a name for this connection.";
  const host = form.host.trim();
  if (!host) errors.host = "Enter a host name or IP address.";
  else if (/\s/.test(host)) errors.host = "The host cannot contain spaces.";
  if (parsePort(form.port) === null) errors.port = "Use a port from 1 to 65535.";
  if (!form.username.trim()) errors.username = "Enter the user to log in as.";
  return errors;
}

/** Builds the connection to save. Call only when validateConnectionForm returned no errors. */
export function toConnection(
  form: ConnectionFormState,
  edit: SshConnection | null | undefined,
  now: string,
  newId: () => string
): SshConnection {
  return {
    id: edit?.id ?? newId(),
    name: form.name.trim(),
    host: form.host.trim(),
    port: parsePort(form.port) ?? 22,
    username: form.username.trim(),
    authMethod: form.authMethod,
    privateKeyId: form.selectedKeyId || null,
    jumpHostId: form.jumpHostId,
    startupCommands: form.startupCommands.trim() || null,
    colorTag: form.colorTag,
    folderPath: edit?.folderPath ?? "/",
    sortOrder: edit?.sortOrder ?? 0,
    themeOverride: form.themeOverride,
    agentForwarding: form.agentForwarding,
    envVars: form.envVars,
    createdAt: edit?.createdAt ?? now,
    updatedAt: now,
  };
}
