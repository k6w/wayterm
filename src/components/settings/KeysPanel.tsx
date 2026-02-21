import { useState, useCallback, useEffect } from "react";
import { KeyRound, Plus, Trash2, Upload, Copy, Check, FileKey } from "lucide-react";
import { useSshStore } from "../../stores/ssh";
import ConfirmDialog from "../ui/ConfirmDialog";
import type { SshKey } from "../../types/ssh";

type ImportMode = "paste" | null;

export default function KeysPanel() {
  const keys = useSshStore((s) => s.keys);
  const loadKeys = useSshStore((s) => s.loadKeys);
  const importKey = useSshStore((s) => s.importKey);
  const removeKey = useSshStore((s) => s.removeKey);

  const [importMode, setImportMode] = useState<ImportMode>(null);
  const [name, setName] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [algorithm, setAlgorithm] = useState<"ed25519" | "rsa">("ed25519");
  const [importing, setImporting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const resetForm = useCallback(() => {
    setName("");
    setPublicKey("");
    setPrivateKey("");
    setAlgorithm("ed25519");
    setImportMode(null);
    setImporting(false);
  }, []);

  const handleImport = useCallback(async () => {
    if (!name.trim() || !privateKey.trim()) return;
    setImporting(true);
    try {
      await importKey({
        name: name.trim(),
        publicKey: publicKey.trim(),
        privateKeyPem: privateKey.trim(),
        algorithm,
      });
      resetForm();
    } catch {
      setImporting(false);
    }
  }, [name, publicKey, privateKey, algorithm, importKey, resetForm]);

  const handleCopy = useCallback((key: SshKey) => {
    if (!key.publicKey) return;
    navigator.clipboard.writeText(key.publicKey);
    setCopiedId(key.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await removeKey(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, removeKey]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-text-primary">
            SSH Keys ({keys.length})
          </h3>
          {!importMode && (
            <button
              onClick={() => setImportMode("paste")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-bg-tertiary border border-border rounded-md text-text-secondary hover:text-text-primary hover:border-accent transition-colors"
            >
              <Upload size={12} />
              Import Key
            </button>
          )}
        </div>

        {importMode === "paste" && (
          <div className="space-y-3 p-4 border border-border rounded-lg bg-bg-tertiary mb-4">
            <div>
              <label className="text-sm text-text-secondary mb-1.5 block">
                Key Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-bg-primary border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:border-accent outline-none w-full transition-colors"
                placeholder="My SSH Key"
              />
            </div>

            <div>
              <label className="text-sm text-text-secondary mb-1.5 block">
                Algorithm
              </label>
              <div className="flex gap-2">
                {(["ed25519", "rsa"] as const).map((alg) => (
                  <button
                    key={alg}
                    type="button"
                    onClick={() => setAlgorithm(alg)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors flex-1 justify-center ${
                      algorithm === alg
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-border bg-bg-primary text-text-secondary hover:text-text-primary hover:border-border-focus"
                    }`}
                  >
                    {alg === "ed25519" ? "Ed25519" : "RSA"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-text-secondary mb-1.5 block">
                Public Key <span className="text-text-muted">(optional)</span>
              </label>
              <textarea
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                className="bg-bg-primary border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:border-accent outline-none w-full transition-colors resize-none font-mono text-xs"
                placeholder="ssh-ed25519 AAAA..."
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm text-text-secondary mb-1.5 block">
                Private Key (PEM)
              </label>
              <textarea
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                className="bg-bg-primary border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:border-accent outline-none w-full transition-colors resize-none font-mono text-xs"
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                rows={4}
              />
              <p className="mt-1 text-xs text-text-muted">
                Private key is stored encrypted in the local database
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={resetForm}
                className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importing || !name.trim() || !privateKey.trim()}
                className="px-4 py-1.5 text-sm bg-accent hover:bg-accent-hover text-white rounded-md transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
        )}

        {keys.length === 0 && !importMode ? (
          <div className="py-8 text-center border border-border border-dashed rounded-lg">
            <FileKey size={24} className="mx-auto mb-2 text-text-muted" />
            <p className="text-sm text-text-muted mb-3">No SSH keys stored</p>
            <button
              onClick={() => setImportMode("paste")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/[0.08] rounded-md text-text-secondary hover:text-text-primary hover:bg-white/[0.14] transition-colors"
            >
              <Plus size={12} />
              Import your first key
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center gap-3 px-4 py-3 border border-border rounded-lg bg-bg-tertiary"
              >
                <KeyRound size={14} className="shrink-0 text-text-muted" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary truncate">
                    {key.name}
                  </div>
                  <div className="text-xs text-text-muted truncate font-mono">
                    {key.algorithm} &middot; {key.fingerprint.slice(0, 23)}...
                  </div>
                </div>
                <button
                  onClick={() => handleCopy(key)}
                  className="p-1.5 text-text-muted hover:text-text-primary transition-colors shrink-0"
                  title="Copy public key"
                >
                  {copiedId === key.id ? (
                    <Check size={14} className="text-green-400" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
                <button
                  onClick={() => setDeleteTarget({ id: key.id, name: key.name })}
                  className="p-1.5 text-text-muted hover:text-error transition-colors shrink-0"
                  title="Delete key"
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
        title="Delete SSH Key"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? Any connections using this key will no longer be able to authenticate.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
