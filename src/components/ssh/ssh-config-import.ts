import type { SshConfigHost, SshConfigImportResult } from "../../lib/ipc";
import type { ToastVariant } from "../../stores/toast";
import { plural } from "../../lib/plural";

/** Window event that opens the import dialog; the toolbar, the palette and Settings send it. */
export const OPEN_SSH_CONFIG_IMPORT = "wayterm:open-ssh-config-import";

export function openSshConfigImport(): void {
  window.dispatchEvent(new Event(OPEN_SSH_CONFIG_IMPORT));
}

/** The aliases ticked when the dialog opens: everything not saved yet. */
export function initialSelection(hosts: readonly SshConfigHost[]): Set<string> {
  return new Set(hosts.filter((h) => !h.alreadyImported).map((h) => h.alias));
}

/** `user@host:port` as it appears in the list; IPv6 hosts are bracketed. */
export function hostEndpoint(host: SshConfigHost): string {
  const name = host.hostname.includes(":") ? `[${host.hostname}]` : host.hostname;
  return `${host.user}@${name}:${host.port}`;
}

/** File name of the host's first IdentityFile, or null when it names none. */
export function identityLabel(host: SshConfigHost): string | null {
  const first = host.identityFiles[0];
  if (!first) return null;
  return first.split(/[\\/]/).pop() || first;
}

/** The toast after an import: "Imported 2 connections, skipped 1, 2 warnings". */
export function importSummary(result: SshConfigImportResult): { message: string; variant: ToastVariant } {
  const parts = [
    result.imported.length > 0
      ? `Imported ${plural(result.imported.length, "connection")}`
      : "Nothing imported",
  ];
  if (result.skipped.length > 0) parts.push(`skipped ${result.skipped.length}`);
  if (result.warnings.length > 0) parts.push(plural(result.warnings.length, "warning"));
  return { message: parts.join(", "), variant: result.imported.length > 0 ? "success" : "info" };
}
