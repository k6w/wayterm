import { useState, useCallback, useEffect } from "react";
import { KeyRound, Trash2, Upload, Copy, Check, FileKey, Pencil } from "lucide-react";
import { useSshStore } from "../../stores/ssh";
import ConfirmDialog from "../ui/ConfirmDialog";
import { Button, IconButton } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { SettingsSection, SettingRow, SegmentedControl, TextField, TextArea } from "./ui";
import type { SshKey } from "../../types/ssh";

type ImportMode = "paste" | null;

export default function KeysPanel() {
  const keys = useSshStore((s) => s.keys);
  const loadKeys = useSshStore((s) => s.loadKeys);
  const importKey = useSshStore((s) => s.importKey);
  const removeKey = useSshStore((s) => s.removeKey);
  const updateKey = useSshStore((s) => s.updateKey);

  const [importMode, setImportMode] = useState<ImportMode>(null);
  const [editingKey, setEditingKey] = useState<{ id: string; name: string; publicKey: string } | null>(null);
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
    <div className="space-y-8">
      <SettingsSection
        title="SSH Keys"
        description={`${keys.length} ${keys.length === 1 ? "key" : "keys"} stored`}
        card={false}
        action={
          !importMode && (
            <Button variant="ghost" className="border border-border" onClick={() => setImportMode("paste")}>
              <Upload size={12} />
              Import Key
            </Button>
          )
        }
      >
        {importMode === "paste" && (
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            <SettingRow label="Key Name" htmlFor="key-name" stacked>
              <TextField
                id="key-name"
                value={name}
                onChange={setName}
                placeholder="My SSH Key"
                className="w-full"
              />
            </SettingRow>

            <SettingRow label="Algorithm" stacked>
              <SegmentedControl
                value={algorithm}
                onChange={setAlgorithm}
                options={[
                  { value: "ed25519", label: "Ed25519" },
                  { value: "rsa", label: "RSA" },
                ]}
              />
            </SettingRow>

            <SettingRow label="Public Key" description="Optional" htmlFor="public-key" stacked>
              <TextArea
                id="public-key"
                value={publicKey}
                onChange={setPublicKey}
                placeholder="ssh-ed25519 AAAA..."
                rows={3}
                mono
              />
            </SettingRow>

            <SettingRow
              label="Private Key (PEM)"
              description="Stored encrypted locally"
              htmlFor="private-key"
              stacked
            >
              <TextArea
                id="private-key"
                value={privateKey}
                onChange={setPrivateKey}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                rows={4}
                mono
              />
            </SettingRow>

            <div className="flex items-center justify-end gap-2 px-4 py-3">
              <Button variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleImport}
                disabled={importing || !name.trim() || !privateKey.trim()}
              >
                {importing ? "Importing..." : "Import"}
              </Button>
            </div>
          </div>
        )}

        {keys.length === 0 && !importMode ? (
          <EmptyState
            icon={FileKey}
            title="No SSH keys"
            hint="Import an existing key to authenticate your SSH connections."
            action={{
              label: "Import your first key",
              onClick: () => setImportMode("paste"),
            }}
          />
        ) : (
          <div className="space-y-2">
            {keys.map((key) => (
              <div
                key={key.id}
                className="overflow-hidden rounded-lg border border-border bg-overlay/[0.02]"
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <KeyRound size={14} className="shrink-0 text-text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-text-primary">
                      {key.name}
                    </div>
                    <div className="truncate font-mono text-xs text-text-muted">
                      {key.algorithm} &middot; {key.fingerprint.slice(0, 23)}...
                    </div>
                  </div>
                  <IconButton title="Copy public key" onClick={() => handleCopy(key)}>
                    {copiedId === key.id ? (
                      <Check size={14} className="text-success" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </IconButton>
                  <IconButton
                    title="Edit key"
                    active={editingKey?.id === key.id}
                    onClick={() =>
                      setEditingKey(
                        editingKey?.id === key.id
                          ? null
                          : { id: key.id, name: key.name, publicKey: key.publicKey }
                      )
                    }
                  >
                    <Pencil size={14} />
                  </IconButton>
                  <IconButton
                    title="Delete key"
                    className="hover:!text-error"
                    onClick={() => setDeleteTarget({ id: key.id, name: key.name })}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </div>
                {editingKey?.id === key.id && (
                  <div className="divide-y divide-border border-t border-border">
                    <SettingRow label="Key Name" htmlFor={`edit-name-${key.id}`} stacked>
                      <TextField
                        id={`edit-name-${key.id}`}
                        value={editingKey.name}
                        onChange={(v) => setEditingKey({ ...editingKey, name: v })}
                        className="w-full"
                      />
                    </SettingRow>
                    <SettingRow label="Public Key" htmlFor={`edit-pub-${key.id}`} stacked>
                      <TextArea
                        id={`edit-pub-${key.id}`}
                        value={editingKey.publicKey}
                        onChange={(v) => setEditingKey({ ...editingKey, publicKey: v })}
                        rows={3}
                        mono
                      />
                    </SettingRow>
                    <div className="flex items-center justify-end gap-2 px-4 py-3">
                      <Button variant="ghost" onClick={() => setEditingKey(null)}>
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        disabled={!editingKey.name.trim()}
                        onClick={async () => {
                          await updateKey(
                            editingKey.id,
                            editingKey.name,
                            editingKey.publicKey
                          );
                          setEditingKey(null);
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SettingsSection>

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
