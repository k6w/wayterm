import { Icons } from "../../ui/icons";
import type { SshConfigHost } from "../../lib/ipc";
import { toast } from "../../stores/toast";
import type { SshConnection } from "../../types/ssh";
import { openConfigHost, openQuickTarget, openSavedConnection } from "../ssh/open-connection";
import { parseQuickConnect, quickConnectLabel, type QuickConnectTarget } from "../ssh/quick-connect";
import type { PaletteAction } from "./actions";

/** At most this many saved connections, and this many ssh config aliases, are listed. */
const MAX_PER_KIND = 5;

export interface ConnectContext {
  /** Login for a target typed without a user: the configured default, else the OS user. */
  defaultUser: string;
  /** Saved connections only. */
  connections: readonly SshConnection[];
  configHosts: readonly SshConfigHost[];
}

const includes = (text: string, needle: string) => text.toLowerCase().includes(needle);

function isSaved(target: QuickConnectTarget, connections: readonly SshConnection[]): boolean {
  return connections.some(
    (c) => c.host.toLowerCase() === target.host.toLowerCase() && c.username === target.user && c.port === target.port
  );
}

/**
 * The connection results for a palette query, in display order: a quick
 * connect when the text parses as a target (plus "Save and connect" unless it
 * is already saved), then matching saved connections, then matching
 * ~/.ssh/config aliases that are not saved yet. They are not run through the
 * command filter, so they are listed even when the label would not match.
 */
export function buildConnectActions(query: string, ctx: ConnectContext): PaletteAction[] {
  const text = query.trim();
  if (!text) return [];
  const needle = text.toLowerCase();
  const actions: PaletteAction[] = [];

  const target = parseQuickConnect(text, { defaultUser: ctx.defaultUser });
  if (target) {
    const label = quickConnectLabel(target);
    actions.push({
      id: "quick-connect",
      label: `Connect to ${label}`,
      category: "Connect",
      icon: Icons.server,
      handler: () => {
        void openQuickTarget(target, false).catch((e: unknown) => toast.error(`Could not connect: ${String(e)}`));
      },
    });
    if (!isSaved(target, ctx.connections)) {
      actions.push({
        id: "quick-connect-save",
        label: `Save and connect to ${label}`,
        category: "Connect",
        icon: Icons.save,
        handler: () => {
          void openQuickTarget(target, true).catch((e: unknown) => toast.error(`Could not save the connection: ${String(e)}`));
        },
      });
    }
  }

  ctx.connections
    .filter(
      (c) =>
        includes(c.name, needle) || includes(c.host, needle) || includes(c.username, needle) || includes(`${c.username}@${c.host}`, needle)
    )
    .slice(0, MAX_PER_KIND)
    .forEach((conn) =>
      actions.push({
        id: `connection-${conn.id}`,
        label: conn.name,
        detail: `${conn.username}@${conn.host}${conn.port === 22 ? "" : `:${conn.port}`}`,
        category: "Connections",
        icon: Icons.server,
        handler: () => openSavedConnection(conn),
      })
    );

  ctx.configHosts
    .filter((h) => !h.alreadyImported && (includes(h.alias, needle) || includes(h.hostname, needle)))
    .slice(0, MAX_PER_KIND)
    .forEach((host) =>
      actions.push({
        id: `ssh-config-${host.alias}`,
        label: host.alias,
        detail: `${host.user}@${host.hostname}:${host.port}`,
        category: "SSH config",
        icon: Icons.server,
        handler: () => openConfigHost(host),
      })
    );

  return actions;
}
