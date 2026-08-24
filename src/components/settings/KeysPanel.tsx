import { useEffect, useState } from "react";
import { Check, Copy, FileKey, KeyRound, Pencil, Trash2, Upload } from "lucide-react";
import { useSshStore } from "../../stores/ssh";
import { Button, EmptyState, IconButton, Input, Section, SegmentedControl, Textarea, ICON_MD, ICON_SM, ConfirmDialog } from "../../ui";
import { SettingRow, SettingsCard } from "./SettingRow";
import type { SshKey } from "../../types/ssh";

type Algorithm = SshKey["algorithm"];

const ALGORITHM_OPTIONS: { value: Algorithm; label: string }[] = [
  { value: "ed25519", label: "Ed25519" },
  { value: "rsa", label: "RSA" },
];

/** Paste-in form for an existing key pair. Mounted only while open, so it starts empty each time. */
function ImportKeyForm({ onDone }: { onDone: () => void }) {
  const importKey = useSshStore((s) => s.importKey);
  const [name, setName] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [algorithm, setAlgorithm] = useState<Algorithm>("ed25519");
  const [importing, setImporting] = useState(false);
  const valid = name.trim() !== "" && privateKey.trim() !== "";

  const handleImport = async () => {
    if (!valid) return;
    setImporting(true);
    try {
      await importKey({
        name: name.trim(),
        publicKey: publicKey.trim(),
        privateKeyPem: privateKey.trim(),
        algorithm,
      });
      onDone();
    } catch {
      setImporting(false);
    }
  };

  return (
    <SettingsCard>
      <SettingRow label="Key name" stacked>
        {(control) => (
          <Input {...control} autoFocus value={name} placeholder="My SSH key" onChange={(e) => setName(e.target.value)} />
        )}
      </SettingRow>
      <SettingRow label="Algorithm" stacked>
        <SegmentedControl aria-label="Algorithm" value={algorithm} onValueChange={setAlgorithm} options={ALGORITHM_OPTIONS} />
      </SettingRow>
      <SettingRow label="Public key" description="Optional" stacked>
        {(control) => (
          <Textarea
            {...control}
            value={publicKey}
            placeholder="ssh-ed25519 AAAA..."
            onChange={(e) => setPublicKey(e.target.value)}
            code
          />
        )}
      </SettingRow>
      <SettingRow label="Private key (PEM)" description="Stored encrypted locally" stacked>
        {(control) => (
          <Textarea
            {...control}
            rows={4}
            value={privateKey}
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            onChange={(e) => setPrivateKey(e.target.value)}
            code
          />
        )}
      </SettingRow>
      <div className="flex justify-end gap-2 px-3 py-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="primary" loading={importing} disabled={!valid} onClick={() => void handleImport()}>
          Import
        </Button>
      </div>
    </SettingsCard>
  );
}

/** Rename a key or replace its public part. */
function EditKeyForm({ sshKey, onDone }: { sshKey: SshKey; onDone: () => void }) {
  const updateKey = useSshStore((s) => s.updateKey);
  const [name, setName] = useState(sshKey.name);
  const [publicKey, setPublicKey] = useState(sshKey.publicKey);
  return (
    <div className="divide-y divide-border">
      <SettingRow label="Key name" stacked>
        {(control) => <Input {...control} value={name} onChange={(e) => setName(e.target.value)} />}
      </SettingRow>
      <SettingRow label="Public key" stacked>
        {(control) => (
          <Textarea
            {...control}
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            code
          />
        )}
      </SettingRow>
      <div className="flex justify-end gap-2 px-3 py-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!name.trim()}
          onClick={async () => {
            await updateKey(sshKey.id, name, publicKey);
            onDone();
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

export default function KeysPanel() {
  const keys = useSshStore((s) => s.keys);
  const loadKeys = useSshStore((s) => s.loadKeys);
  const removeKey = useSshStore((s) => s.removeKey);
  const [importing, setImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  const handleCopy = async (key: SshKey) => {
    if (!key.publicKey) return;
    await navigator.clipboard.writeText(key.publicKey);
    setCopiedId(key.id);
    setTimeout(() => setCopiedId((current) => (current === key.id ? null : current)), 2000);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await removeKey(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <Section
      title="SSH keys"
      description={`${keys.length} ${keys.length === 1 ? "key" : "keys"} stored`}
      actions={
        !importing && (
          <Button size="sm" leadingIcon={<Upload {...ICON_SM} />} onClick={() => setImporting(true)}>
            Import key
          </Button>
        )
      }
    >
      {importing && <ImportKeyForm onDone={() => setImporting(false)} />}

      {keys.length === 0 && !importing ? (
        <EmptyState
          icon={<FileKey {...ICON_MD} />}
          title="No SSH keys"
          description="Import an existing key to authenticate your SSH connections."
          action={
            <Button size="sm" onClick={() => setImporting(true)}>
              Import your first key
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {keys.map((key) => (
            <SettingsCard key={key.id}>
              <div className="flex min-h-row items-center gap-3 px-3 py-2">
                <KeyRound {...ICON_SM} aria-hidden className="shrink-0 text-fg-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body text-fg">{key.name}</p>
                  <p className="truncate font-mono text-label text-fg-muted">
                    {key.algorithm} · {key.fingerprint.slice(0, 23)}…
                  </p>
                </div>
                <IconButton
                  label={copiedId === key.id ? "Copied" : `Copy public key of ${key.name}`}
                  icon={copiedId === key.id ? <Check {...ICON_SM} className="text-success" /> : <Copy {...ICON_SM} />}
                  disabled={!key.publicKey}
                  onClick={() => void handleCopy(key)}
                />
                <IconButton
                  label={`Edit ${key.name}`}
                  icon={<Pencil {...ICON_SM} />}
                  pressed={editingId === key.id}
                  onClick={() => setEditingId(editingId === key.id ? null : key.id)}
                />
                <IconButton
                  label={`Delete ${key.name}`}
                  icon={<Trash2 {...ICON_SM} />}
                  onClick={() => setDeleteTarget({ id: key.id, name: key.name })}
                />
              </div>
              {editingId === key.id && <EditKeyForm sshKey={key} onDone={() => setEditingId(null)} />}
            </SettingsCard>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete SSH key"
        message={`Delete "${deleteTarget?.name ?? ""}"? Connections that use this key will no longer be able to authenticate.`}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </Section>
  );
}
