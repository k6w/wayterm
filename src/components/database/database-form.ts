import type { DatabaseConnection } from "../../types/database";
import { parsePort } from "../ssh/connection-form";

/** The new-connection form. The port stays typed text so a bad value shows an error instead of becoming NaN. */
export interface DatabaseFormState {
  name: string;
  type: DatabaseConnection["type"];
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

export type DatabaseFormErrors = Partial<Record<"name" | "host" | "port" | "database" | "username", string>>;

export const DATABASE_TYPES: readonly { value: DatabaseConnection["type"]; label: string }[] = [
  { value: "postgresql", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
  { value: "sqlite", label: "SQLite" },
  { value: "mongodb", label: "MongoDB" },
];

export const EMPTY_DATABASE_FORM: DatabaseFormState = {
  name: "",
  type: "postgresql",
  host: "localhost",
  port: "5432",
  database: "",
  username: "",
  password: "",
  ssl: false,
};

export function validateDatabaseForm(form: DatabaseFormState): DatabaseFormErrors {
  const errors: DatabaseFormErrors = {};
  if (!form.name.trim()) errors.name = "Enter a name.";
  if (!form.host.trim()) errors.host = "Enter a host.";
  if (parsePort(form.port) === null) errors.port = "Use a port from 1 to 65535.";
  if (!form.database.trim()) errors.database = "Enter a database.";
  if (!form.username.trim()) errors.username = "Enter a username.";
  return errors;
}

/**
 * The connection to save. The backend stores the id as the primary key and
 * requires it, so a new connection gets one here. Call only on a valid form.
 */
export function toDatabaseConnection(form: DatabaseFormState, newId: () => string): DatabaseConnection {
  return {
    id: newId(),
    name: form.name.trim(),
    type: form.type,
    host: form.host.trim(),
    port: parsePort(form.port) ?? 0,
    database: form.database.trim(),
    username: form.username.trim(),
    password: form.password,
    ssl: form.ssl,
  };
}

/** One CSV/JSON cell: null and undefined are empty, everything else is its string form. */
export function cellText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

/** RFC 4180 CSV: a header row, then one row per result row; fields with , " or a newline are quoted. */
export function resultsToCsv(columns: readonly string[], rows: readonly Record<string, unknown>[]): string {
  const field = (text: string) => (/[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
  return [columns.map(field).join(","), ...rows.map((row) => columns.map((col) => field(cellText(row[col]))).join(","))].join(
    "\n"
  );
}

/**
 * Query-history recall in the editor. `index` -1 is the user's own draft;
 * ArrowUp walks to older queries, ArrowDown back towards the draft.
 */
export function historyStep(index: number, key: "ArrowUp" | "ArrowDown", length: number): number {
  if (key === "ArrowUp") return Math.min(index + 1, length - 1);
  return index <= 0 ? -1 : index - 1;
}
