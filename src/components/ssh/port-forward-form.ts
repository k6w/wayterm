import type { PortForward } from "../../lib/ipc";
import { parsePort } from "./connection-form";

/** The add-forward form, kept as typed text so a half-typed port is never snapped to a default. */
export interface PortForwardFormState {
  localPort: string;
  remoteHost: string;
  remotePort: string;
}

export type PortForwardFormErrors = Partial<Record<keyof PortForwardFormState, string>>;

export const EMPTY_PORT_FORWARD_FORM: PortForwardFormState = {
  localPort: "8080",
  remoteHost: "localhost",
  remotePort: "8000",
};

export function validatePortForward(form: PortForwardFormState): PortForwardFormErrors {
  const errors: PortForwardFormErrors = {};
  if (parsePort(form.localPort) === null) errors.localPort = "Use a port from 1 to 65535.";
  if (!form.remoteHost.trim()) errors.remoteHost = "Enter a host.";
  else if (/\s/.test(form.remoteHost.trim())) errors.remoteHost = "A host has no spaces.";
  if (parsePort(form.remotePort) === null) errors.remotePort = "Use a port from 1 to 65535.";
  return errors;
}

/** A new local forward for the backend to save (it assigns id and timestamps). Call only on a valid form. */
export function toPortForward(form: PortForwardFormState, connectionId: string): PortForward {
  return {
    id: "",
    connectionId,
    portForwardType: "local",
    localPort: parsePort(form.localPort) ?? 0,
    remoteHost: form.remoteHost.trim(),
    remotePort: parsePort(form.remotePort) ?? 0,
    isActive: false,
    createdAt: "",
    updatedAt: "",
  };
}

const TYPE_LABELS: Record<string, { short: string; long: string }> = {
  local: { short: "L", long: "Local" },
  remote: { short: "R", long: "Remote" },
  dynamic: { short: "D", long: "Dynamic" },
};

/** "L" / "Local" for the known types; the first letter and the raw name otherwise. */
export function forwardType(type: string): { short: string; long: string } {
  return TYPE_LABELS[type] ?? { short: type.slice(0, 1).toUpperCase(), long: type };
}

/** "8080 → db.internal:5432" */
export function forwardRoute(forward: Pick<PortForward, "localPort" | "remoteHost" | "remotePort">): string {
  return `${forward.localPort} → ${forward.remoteHost}:${forward.remotePort}`;
}
