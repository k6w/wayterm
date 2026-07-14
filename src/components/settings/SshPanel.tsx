import { useState, useCallback, useEffect } from "react";
import { Server, Trash2, Fingerprint, Download, Check } from "lucide-react";
import { useSettingsStore } from "../../stores/settings";
import { useSshStore } from "../../stores/ssh";
import ConfirmDialog from "../ui/ConfirmDialog";
import { Button, IconButton } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { SettingsSection, SettingRow, NumberField, TextField } from "./ui";
import { sshKnownHostsList, sshKnownHostsRemove, sshKnownHostsClear, sshImportConfig, type KnownHost } from "../../lib/ipc";

interface ImportedHost {
  name: string;
  host: string;
  port: number;
  username: string;
  identityFile: string | null;
  jumpHost: string | null;
}

export default function SshPanel() {
  const settings = useSettingsStore((s) => s.settings.ssh);
  const update = useSettingsStore((s) => s.update);
  const connections = useSshStore((s) => s.connections);
  const deleteConnection = useSshStore((s) => s.deleteConnection);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [knownHosts, setKnownHosts] = useState<KnownHost[]>([]);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [importedHosts, setImportedHosts] = useState<ImportedHost[] | null>(null);
  const [selectedHosts, setSelectedHosts] = useState<Set<number>>(new Set());
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<number | null>(null);
  const saveConnection = useSshStore((s) => s.saveConnection);

  const loadKnownHosts = useCallback(async () => {
    try {
      const hosts = await sshKnownHostsList();
      setKnownHosts(hosts);
    } catch {
      setKnownHosts([]);
    }
  }, []);

  useEffect(() => {
    loadKnownHosts();
  }, [loadKnownHosts]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteConnection(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, deleteConnection]);

  const handleRemoveHost = useCallback(async (hostname: string) => {
    await sshKnownHostsRemove(hostname);
    await loadKnownHosts();
  }, [loadKnownHosts]);

  const handleClearAll = useCallback(async () => {
    await sshKnownHostsClear();
    setClearAllConfirm(false);
    await loadKnownHosts();
  }, [loadKnownHosts]);

  const handleOpenImport = useCallback(async () => {
    setImportError(null);
    setImportSuccess(null);
    setImportLoading(true);
    try {
      const hosts = await sshImportConfig();
      setImportedHosts(hosts);
      setSelectedHosts(new Set(hosts.map((_, i) => i)));
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to read SSH config");
    } finally {
      setImportLoading(false);
    }
  }, []);

  const handleImportSelected = useCallback(async () => {
    if (!importedHosts) return;
    const existing = useSshStore.getState().connections;
    let count = 0;
    for (const idx of selectedHosts) {
      const h = importedHosts[idx];
      if (!h) continue;
      const alreadyExists = existing.some(
        (c) => c.host === h.host && c.username === h.username && c.port === h.port
      );
      if (alreadyExists) continue;
      const now = new Date().toISOString();
      const conn: import("../../types/ssh").SshConnection = {
        id: crypto.randomUUID(),
        name: h.name,
        host: h.host,
        port: h.port,
        username: h.username,
        authMethod: h.identityFile ? "key" : "password",
        privateKeyId: null,
        sortOrder: 0,
        startupCommands: null,
        jumpHostId: null,
        colorTag: null,
        folderPath: "",
        createdAt: now,
        updatedAt: now,
        themeOverride: null,
        agentForwarding: false,
        envVars: {},
      };
      await saveConnection(conn);
      count++;
    }
    setImportedHosts(null);
    setSelectedHosts(new Set());
    setImportSuccess(count);
  }, [importedHosts, selectedHosts, saveConnection]);

  return (
    <div className="space-y-8">
      <SettingsSection title="Connection Defaults">
        <SettingRow
          label="Default port"
          htmlFor="ssh-default-port"
        >
          <NumberField
            id="ssh-default-port"
            value={settings.defaultPort}
            min={1}
            max={65535}
            onChange={(v) => update("ssh", { defaultPort: v })}
          />
        </SettingRow>
        <SettingRow
          label="Default username"
          htmlFor="ssh-default-username"
        >
          <TextField
            id="ssh-default-username"
            value={settings.defaultUsername}
            onChange={(v) => update("ssh", { defaultUsername: v })}
            placeholder="root"
            className="w-44"
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="Timeouts">
        <SettingRow
          label="Keepalive interval"
          description="0 to disable"
          htmlFor="ssh-keepalive"
        >
          <NumberField
            id="ssh-keepalive"
            value={settings.keepaliveInterval}
            min={0}
            max={300}
            unit="s"
            onChange={(v) => update("ssh", { keepaliveInterval: v })}
          />
        </SettingRow>
        <SettingRow
          label="Connection timeout"
          htmlFor="ssh-timeout"
        >
          <NumberField
            id="ssh-timeout"
            value={settings.connectionTimeout}
            min={1}
            max={120}
            unit="s"
            onChange={(v) => update("ssh", { connectionTimeout: v })}
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection
        title="Import from SSH Config"
        description="Reads Host entries from ~/.ssh/config"
        card={false}
        action={
          <Button
            variant="ghost"
            className="border border-border"
            onClick={handleOpenImport}
            disabled={importLoading}
          >
            <Download size={13} />
            {importLoading ? "Reading…" : "Import ~/.ssh/config"}
          </Button>
        }
      >
        {importError && (
          <div className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
            {importError}
          </div>
        )}
        {importSuccess !== null && (
          <div className="flex items-center gap-1.5 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
            <Check size={12} />
            Imported {importSuccess} connection{importSuccess !== 1 ? "s" : ""}
          </div>
        )}
        {importedHosts && (
          <div className="space-y-2">
            <p className="text-xs text-text-muted">Select hosts to import:</p>
            <div className="max-h-48 space-y-1.5 overflow-y-auto">
              {importedHosts.map((h, i) => (
                <label
                  key={i}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-overlay/[0.03] px-3 py-2 transition-colors hover:border-accent/40"
                >
                  <input
                    type="checkbox"
                    checked={selectedHosts.has(i)}
                    onChange={(e) => {
                      setSelectedHosts((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(i);
                        else next.delete(i);
                        return next;
                      });
                    }}
                    className="accent-accent"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-text-primary">{h.name}</div>
                    <div className="text-xs text-text-muted">
                      {h.username}@{h.host}:{h.port}
                    </div>
                  </div>
                  {h.jumpHost && (
                    <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent">
                      via {h.jumpHost}
                    </span>
                  )}
                </label>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                variant="primary"
                onClick={handleImportSelected}
                disabled={selectedHosts.size === 0}
              >
                Import {selectedHosts.size} selected
              </Button>
              <Button
                variant="ghost"
                className="border border-border"
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
      </SettingsSection>

      <SettingsSection title={`Saved Connections (${connections.length})`} card={false}>
        {connections.length === 0 ? (
          <EmptyState
            icon={Server}
            title="No saved connections"
            hint="Use the sidebar to add connections."
          />
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {connections.map((conn) => (
              <div key={conn.id} className="flex items-center gap-3 px-4 py-2.5">
                <Server size={14} className="shrink-0 text-text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-text-primary">{conn.name}</div>
                  <div className="truncate text-xs text-text-muted">
                    {conn.username}@{conn.host}:{conn.port} ({conn.authMethod})
                  </div>
                </div>
                <IconButton
                  title="Delete connection"
                  onClick={() => setDeleteTarget({ id: conn.id, name: conn.name })}
                >
                  <Trash2 size={14} />
                </IconButton>
              </div>
            ))}
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title={`Known Hosts (${knownHosts.length})`}
        card={false}
        action={
          knownHosts.length > 0 ? (
            <Button variant="danger" onClick={() => setClearAllConfirm(true)}>
              Clear All
            </Button>
          ) : undefined
        }
      >
        {knownHosts.length === 0 ? (
          <EmptyState icon={Fingerprint} title="No known hosts found" />
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {knownHosts.map((host) => (
              <div
                key={`${host.hostname}-${host.lineNumber}`}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <Fingerprint size={14} className="shrink-0 text-text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-text-primary">{host.hostname}</div>
                  <div className="flex items-center gap-2 truncate text-xs text-text-muted">
                    <span className="inline-block rounded bg-overlay/[0.08] px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                      {host.keyType}
                    </span>
                    <span className="truncate">{host.fingerprintPreview}</span>
                  </div>
                </div>
                <IconButton
                  title="Remove host"
                  onClick={() => handleRemoveHost(host.hostname)}
                >
                  <Trash2 size={14} />
                </IconButton>
              </div>
            ))}
          </div>
        )}
      </SettingsSection>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Connection"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={clearAllConfirm}
        title="Clear All Known Hosts"
        message="Are you sure you want to remove all entries from your known_hosts file? You will be prompted to verify host keys again on next connection."
        confirmLabel="Clear All"
        variant="danger"
        onConfirm={handleClearAll}
        onCancel={() => setClearAllConfirm(false)}
      />
    </div>
  );
}
