import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../ui/icons";
import { Badge, Button, Checkbox, Dialog, DialogContent, EmptyState, FormCard, FormDisclosure, MiddleTruncate } from "../../ui";
import { sshConfigHosts, sshConfigImport, type SshConfigHost, type SshConfigHosts } from "../../lib/ipc";
import { plural } from "../../lib/plural";
import { useSshStore } from "../../stores/ssh";
import { useToastStore } from "../../stores/toast";
import { hostEndpoint, identityLabel, importSummary, initialSelection } from "./ssh-config-import";

interface SshConfigImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Lists the hosts found in ~/.ssh/config and saves the ticked ones as
 * connections. The body mounts only while open, so the config is read afresh
 * and the ticks start from the defaults on every open.
 */
export default function SshConfigImportDialog({ isOpen, onClose }: SshConfigImportDialogProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {isOpen && <ImportBody onClose={onClose} />}
    </Dialog>
  );
}

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; config: SshConfigHosts };

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

function HostRow({ host, checked, onChange }: { host: SshConfigHost; checked: boolean; onChange: (checked: boolean) => void }) {
  const key = identityLabel(host);
  return (
    <li className="flex min-h-row items-center gap-3 px-row-x py-row-y hover:bg-hover">
      <Checkbox
        aria-label={host.alias}
        checked={checked}
        disabled={host.alreadyImported}
        onCheckedChange={(next) => onChange(next === true)}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-body text-fg">{host.alias}</span>
        <span className="truncate font-mono text-label text-fg-muted">{hostEndpoint(host)}</span>
      </div>
      {key && (
        <span className="inline-flex min-w-0 max-w-32 items-center gap-1 text-label text-fg-muted">
          <Icon name="keyFile" size="sm" aria-hidden className="shrink-0" />
          <MiddleTruncate text={key} className="font-mono" />
        </span>
      )}
      {host.proxyJump && (
        <Badge tone="info" size="md" className="max-w-32">
          <span className="truncate">{`via ${host.proxyJump}`}</span>
        </Badge>
      )}
      {host.alreadyImported && (
        <Badge tone="neutral" size="md">
          Saved
        </Badge>
      )}
    </li>
  );
}

function ImportBody({ onClose }: { onClose: () => void }) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    sshConfigHosts()
      .then((config) => {
        if (cancelled) return;
        setSelected(initialSelection(config.hosts));
        setLoad({ status: "ready", config });
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoad({ status: "error", message: errorMessage(e, "Could not read the SSH config") });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hosts = useMemo(() => (load.status === "ready" ? load.config.hosts : []), [load]);
  const selectable = hosts.filter((h) => !h.alreadyImported);
  const count = selected.size;

  const toggle = (alias: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(alias);
      else next.delete(alias);
      return next;
    });

  const runImport = async () => {
    if (count === 0 || importing) return;
    setImporting(true);
    setError(null);
    try {
      // Hosts in config order, so the backend sees a stable list.
      const result = await sshConfigImport(hosts.filter((h) => selected.has(h.alias)).map((h) => h.alias));
      await useSshStore.getState().load();
      const summary = importSummary(result);
      useToastStore.getState().push(summary.message, summary.variant);
      onClose();
    } catch (e) {
      setError(errorMessage(e, "Import failed"));
      setImporting(false);
    }
  };

  const warnings = load.status === "ready" ? load.config.warnings : [];
  const hasHosts = hosts.length > 0;

  return (
    <DialogContent
      size="lg"
      title="Import from ~/.ssh/config"
      description="Choose the hosts to save as connections."
      icon={<Icon name="importSshConfig" size="md" />}
      hints={[
        { shortcut: "Escape", label: "Cancel" },
        ...(hasHosts ? [{ shortcut: "Mod+Enter", label: "Import" }] : []),
      ]}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          void runImport();
        }
      }}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {hasHosts && (
            <Button variant="primary" disabled={count === 0} loading={importing} onClick={() => void runImport()}>
              {count === 0 ? "Import" : `Import ${plural(count, "host")}`}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {load.status === "loading" && (
          <p role="status" className="py-8 text-center text-label text-fg-muted">
            Reading ~/.ssh/config…
          </p>
        )}
        {load.status === "error" && (
          <p role="alert" className="rounded-md border border-danger bg-danger-subtle px-2 py-1.5 text-label text-danger">
            {load.message}
          </p>
        )}
        {load.status === "ready" && !load.config.found && (
          <EmptyState
            icon={<Icon name="file" size="md" />}
            title="No SSH config found"
            description={`There is no file at ${load.config.path || "~/.ssh/config"}. Hosts you define there can be imported from here.`}
          />
        )}
        {load.status === "ready" && load.config.found && !hasHosts && (
          <EmptyState
            icon={<Icon name="server" size="md" />}
            title="No hosts to import"
            description="The config has no named Host entries. Wildcard hosts such as Host * only supply defaults to the others."
          />
        )}
        {hasHosts && (
          <>
            <div className="flex items-center gap-2">
              <span className="flex-1 text-label text-fg-muted">
                {`${count} of ${plural(selectable.length, "host")} selected`}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setSelected(initialSelection(hosts))}>
                Select all
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                Select none
              </Button>
            </div>
            <FormCard>
              <ul aria-label="Hosts in ~/.ssh/config" className="max-h-80 divide-y divide-border overflow-y-auto">
                {hosts.map((host) => (
                  <HostRow key={host.alias} host={host} checked={selected.has(host.alias)} onChange={(c) => toggle(host.alias, c)} />
                ))}
              </ul>
            </FormCard>
          </>
        )}
        {warnings.length > 0 && (
          <FormDisclosure title={plural(warnings.length, "note")}>
            {warnings.map((warning) => (
              <p key={warning} className="px-row-x py-row-y text-label text-fg-secondary">
                {warning}
              </p>
            ))}
          </FormDisclosure>
        )}
        {error && (
          <p role="alert" className="rounded-md border border-danger bg-danger-subtle px-2 py-1.5 text-label text-danger">
            {error}
          </p>
        )}
      </div>
    </DialogContent>
  );
}
