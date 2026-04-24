import { useState, useCallback, useEffect } from "react";
import { Server, Trash2, Fingerprint, Download, Check } from "lucide-react";
import { useSettingsStore } from "../../stores/settings";
import { useSshStore } from "../../stores/ssh";
import ConfirmDialog from "../ui/ConfirmDialog";
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
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Connection Defaults</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Default Port</label>
            <input
              type="number"
              min={1}
              max={65535}
              value={settings.defaultPort}
              onChange={(e) => update("ssh", { defaultPort: Number(e.target.value) })}
              className="bg-bg-tertiary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-28"
            />
          </div>
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Default Username</label>
            <input
              type="text"
              value={settings.defaultUsername}
              onChange={(e) => update("ssh", { defaultUsername: e.target.value })}
              placeholder="root"
              className="bg-bg-tertiary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-44"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Timeouts</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Keepalive Interval (seconds)</label>
            <input
              type="number"
              min={0}
              max={300}
              value={settings.keepaliveInterval}
              onChange={(e) => update("ssh", { keepaliveInterval: Number(e.target.value) })}
              className="bg-bg-tertiary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-28"
            />
          </div>
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Connection Timeout (seconds)</label>
            <input
              type="number"
              min={1}
              max={120}
              value={settings.connectionTimeout}
              onChange={(e) => update("ssh", { connectionTimeout: Number(e.target.value) })}
              className="bg-bg-tertiary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-28"
            />
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-text-primary">Import from SSH Config</h3>
          <button
            onClick={handleOpenImport}
            disabled={importLoading}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-border bg-bg-tertiary text-text-secondary hover:border-accent/50 hover:text-text-primary transition-colors disabled:opacity-50"
          >
            <Download size={12} />
            {importLoading ? "Reading..." : "Import ~/.ssh/config"}
          </button>
        </div>
        {importError && (
          <div className="mb-2 px-3 py-2 rounded-md bg-error/10 border border-error/30 text-xs text-error">
            {importError}
          </div>
        )}
        {importSuccess !== null && (
          <div className="mb-2 px-3 py-2 rounded-md bg-success/10 border border-success/30 text-xs text-success flex items-center gap-1.5">
            <Check size={12} />
            Imported {importSuccess} connection{importSuccess !== 1 ? "s" : ""}
          </div>
        )}
        {importedHosts && (
          <div className="space-y-2 mb-3">
            <p className="text-xs text-text-muted mb-2">Select hosts to import:</p>
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {importedHosts.map((h, i) => (
                <label
                  key={i}
                  className="flex items-center gap-3 px-3 py-2 border border-border rounded-lg bg-bg-tertiary cursor-pointer hover:border-accent/40 transition-colors"
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
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text-primary truncate">{h.name}</div>
                    <div className="text-xs text-text-muted">{h.username}@{h.host}:{h.port}</div>
                  </div>
                  {h.jumpHost && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent">via {h.jumpHost}</span>
                  )}
                </label>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleImportSelected}
                disabled={selectedHosts.size === 0}
                className="px-3 py-1.5 text-xs rounded-md bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                Import {selectedHosts.size} selected
              </button>
              <button
                onClick={() => { setImportedHosts(null); setSelectedHosts(new Set()); }}
                className="px-3 py-1.5 text-xs rounded-md border border-border text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        <p className="text-xs text-text-muted">
          Reads Host entries from <code className="text-text-primary">~/.ssh/config</code> and creates saved connections.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">
          Saved Connections ({connections.length})
        </h3>
        {connections.length === 0 ? (
          <div className="py-6 text-center text-sm text-text-muted border border-border border-dashed rounded-lg">
            No saved connections. Use the sidebar to add connections.
          </div>
        ) : (
          <div className="space-y-2">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center gap-3 px-4 py-2.5 border border-border rounded-lg bg-bg-tertiary"
              >
                <Server size={14} className="shrink-0 text-text-muted" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary truncate">{conn.name}</div>
                  <div className="text-xs text-text-muted truncate">
                    {conn.username}@{conn.host}:{conn.port} ({conn.authMethod})
                  </div>
                </div>
                <button
                  onClick={() => setDeleteTarget({ id: conn.id, name: conn.name })}
                  className="p-1 text-text-muted hover:text-error transition-colors shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-text-primary">
            Known Hosts ({knownHosts.length})
          </h3>
          {knownHosts.length > 0 && (
            <button
              onClick={() => setClearAllConfirm(true)}
              className="text-xs text-error hover:text-error/80 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
        {knownHosts.length === 0 ? (
          <div className="py-6 text-center text-sm text-text-muted border border-border border-dashed rounded-lg">
            No known hosts found.
          </div>
        ) : (
          <div className="space-y-2">
            {knownHosts.map((host) => (
              <div
                key={`${host.hostname}-${host.lineNumber}`}
                className="flex items-center gap-3 px-4 py-2.5 border border-border rounded-lg bg-bg-tertiary"
              >
                <Fingerprint size={14} className="shrink-0 text-text-muted" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary truncate">{host.hostname}</div>
                  <div className="text-xs text-text-muted truncate flex items-center gap-2">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-bg-secondary text-text-muted text-[10px] font-medium">
                      {host.keyType}
                    </span>
                    <span className="truncate">{host.fingerprintPreview}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveHost(host.hostname)}
                  className="p-1 text-text-muted hover:text-error transition-colors shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

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
