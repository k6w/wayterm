import { useCallback, useEffect, useState } from "react";
import { Icon } from "../../ui/icons";
import { useSettingsStore } from "../../stores/settings";
import { useSshStore } from "../../stores/ssh";
import { sshImportConfig, sshKnownHostsClear, sshKnownHostsList, sshKnownHostsRemove, type KnownHost } from "../../lib/ipc";
import { Badge, Button, Checkbox, EmptyState, IconButton, Input, Section, ConfirmDialog } from "../../ui";
import { NumberInput, SettingRow, SettingsCard } from "./SettingRow";
import { connectionsFromConfig, type ImportedHost } from "./ssh-import";

const listRow = "flex min-h-row items-center gap-3 px-row-x py-row-y";

export default function SshPanel() {
  const settings = useSettingsStore((s) => s.settings.ssh);
  const update = useSettingsStore((s) => s.update);
  const connections = useSshStore((s) => s.connections);
  const deleteConnection = useSshStore((s) => s.deleteConnection);
  const saveConnection = useSshStore((s) => s.saveConnection);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [knownHosts, setKnownHosts] = useState<KnownHost[]>([]);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [importedHosts, setImportedHosts] = useState<ImportedHost[] | null>(null);
  const [selectedHosts, setSelectedHosts] = useState<Set<number>>(new Set());
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<number | null>(null);

  const loadKnownHosts = useCallback(async () => {
    try {
      setKnownHosts((await sshKnownHostsList()) ?? []);
    } catch {
      setKnownHosts([]);
    }
  }, []);

  useEffect(() => {
    void loadKnownHosts();
  }, [loadKnownHosts]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteConnection(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleRemoveHost = async (hostname: string) => {
    await sshKnownHostsRemove(hostname);
    await loadKnownHosts();
  };

  const handleClearAll = async () => {
    await sshKnownHostsClear();
    setClearAllConfirm(false);
    await loadKnownHosts();
  };

  const handleOpenImport = async () => {
    setImportError(null);
    setImportSuccess(null);
    setImportLoading(true);
    try {
      const hosts = (await sshImportConfig()) ?? [];
      setImportedHosts(hosts);
      setSelectedHosts(new Set(hosts.map((_, i) => i)));
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to read SSH config");
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportSelected = async () => {
    if (!importedHosts) return;
    const added = connectionsFromConfig(
      importedHosts,
      selectedHosts,
      useSshStore.getState().connections,
      new Date().toISOString(),
      () => crypto.randomUUID()
    );
    for (const connection of added) await saveConnection(connection);
    setImportedHosts(null);
    setSelectedHosts(new Set());
    setImportSuccess(added.length);
  };

  const toggleHost = (index: number, checked: boolean) =>
    setSelectedHosts((prev) => {
      const next = new Set(prev);
      if (checked) next.add(index);
      else next.delete(index);
      return next;
    });

  return (
    <div className="flex flex-col gap-6">
      <Section title="Connection defaults">
        <SettingsCard>
          <SettingRow label="Default port">
            {(control) => (
              <NumberInput
                {...control}
                value={settings.defaultPort}
                min={1}
                max={65535}
                onValueChange={(v) => update("ssh", { defaultPort: v })}
              />
            )}
          </SettingRow>
          <SettingRow label="Default username">
            {(control) => (
              <Input
                {...control}
                value={settings.defaultUsername}
                placeholder="root"
                code
                onChange={(e) => update("ssh", { defaultUsername: e.target.value })}
                className="w-44"
              />
            )}
          </SettingRow>
        </SettingsCard>
      </Section>

      <Section title="Timeouts">
        <SettingsCard>
          <SettingRow label="Keepalive interval" description="0 to disable">
            {(control) => (
              <NumberInput
                {...control}
                value={settings.keepaliveInterval}
                min={0}
                max={300}
                unit="s"
                onValueChange={(v) => update("ssh", { keepaliveInterval: v })}
              />
            )}
          </SettingRow>
          <SettingRow label="Connection timeout">
            {(control) => (
              <NumberInput
                {...control}
                value={settings.connectionTimeout}
                min={1}
                max={120}
                unit="s"
                onValueChange={(v) => update("ssh", { connectionTimeout: v })}
              />
            )}
          </SettingRow>
        </SettingsCard>
      </Section>

      <Section
        title="Import from SSH config"
        description="Reads Host entries from ~/.ssh/config"
        actions={
          <Button
            size="sm"
            leadingIcon={<Icon name="importSshConfig" size="sm" />}
            loading={importLoading}
            onClick={() => void handleOpenImport()}
          >
            Import ~/.ssh/config
          </Button>
        }
      >
        {importError && (
          <p role="alert" className="rounded-md border border-danger bg-danger-subtle px-3 py-2 text-label text-danger">
            {importError}
          </p>
        )}
        {importSuccess !== null && (
          <p
            role="status"
            className="flex items-center gap-1.5 rounded-md bg-success-subtle px-3 py-2 text-label text-success"
          >
            <Icon name="confirm" size="sm" aria-hidden />
            Imported {importSuccess} connection{importSuccess === 1 ? "" : "s"}
          </p>
        )}
        {importedHosts && (
          <div className="flex flex-col gap-2">
            <p className="text-label text-fg-muted">Select hosts to import:</p>
            <SettingsCard className="max-h-48 overflow-y-auto">
              {importedHosts.map((h, i) => (
                <div key={i} className={listRow}>
                  <Checkbox
                    checked={selectedHosts.has(i)}
                    onCheckedChange={(checked) => toggleHost(i, checked === true)}
                    label={
                      <span className="flex flex-col">
                        <span className="text-body text-fg">{h.name}</span>
                        <span className="font-mono text-label text-fg-muted">
                          {h.username}@{h.host}:{h.port}
                        </span>
                      </span>
                    }
                  />
                  {h.jumpHost && <Badge className="ml-auto">via {h.jumpHost}</Badge>}
                </div>
              ))}
            </SettingsCard>
            <div className="flex gap-2">
              <Button
                variant="primary"
                disabled={selectedHosts.size === 0}
                onClick={() => void handleImportSelected()}
              >
                Import {selectedHosts.size} selected
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setImportedHosts(null);
                  setSelectedHosts(new Set());
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Section>

      <Section title={`Saved connections (${connections.length})`}>
        {connections.length === 0 ? (
          <EmptyState
            icon={<Icon name="server" size="md" />}
            title="No saved connections"
            description="Add connections from the Connections panel."
          />
        ) : (
          <SettingsCard>
            {connections.map((conn) => (
              <div key={conn.id} className={listRow}>
                <Icon name="server" size="sm" aria-hidden className="shrink-0 text-fg-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body text-fg">{conn.name}</p>
                  <p className="truncate font-mono text-label text-fg-muted">
                    {conn.username}@{conn.host}:{conn.port} ({conn.authMethod})
                  </p>
                </div>
                <IconButton
                  label={`Delete ${conn.name}`}
                  icon={<Icon name="delete" size="sm" />}
                  onClick={() => setDeleteTarget({ id: conn.id, name: conn.name })}
                />
              </div>
            ))}
          </SettingsCard>
        )}
      </Section>

      <Section
        title={`Known hosts (${knownHosts.length})`}
        actions={
          knownHosts.length > 0 ? (
            <Button size="sm" variant="danger" onClick={() => setClearAllConfirm(true)}>
              Clear all
            </Button>
          ) : undefined
        }
      >
        {knownHosts.length === 0 ? (
          <EmptyState icon={<Icon name="fingerprint" size="md" />} title="No known hosts found" />
        ) : (
          <SettingsCard>
            {knownHosts.map((host) => (
              <div key={`${host.hostname}-${host.lineNumber}`} className={listRow}>
                <Icon name="fingerprint" size="sm" aria-hidden className="shrink-0 text-fg-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-body text-fg">{host.hostname}</p>
                  <p className="flex items-center gap-2 text-label text-fg-muted">
                    <Badge>{host.keyType}</Badge>
                    <span className="truncate font-mono">{host.fingerprintPreview}</span>
                  </p>
                </div>
                <IconButton
                  label={`Remove ${host.hostname}`}
                  icon={<Icon name="delete" size="sm" />}
                  onClick={() => void handleRemoveHost(host.hostname)}
                />
              </div>
            ))}
          </SettingsCard>
        )}
      </Section>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete connection"
        message={`Delete "${deleteTarget?.name ?? ""}"? This cannot be undone.`}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmDialog
        open={clearAllConfirm}
        title="Clear all known hosts"
        message="Remove every entry from your known_hosts file? You will be asked to verify host keys again on the next connection."
        confirmLabel="Clear all"
        variant="danger"
        onConfirm={() => void handleClearAll()}
        onCancel={() => setClearAllConfirm(false)}
      />
    </div>
  );
}
