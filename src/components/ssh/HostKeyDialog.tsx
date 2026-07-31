import { useRef, useState } from "react";
import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { Button, Checkbox, Dialog, DialogContent, ICON_MD, ICON_SM } from "../../ui";
import type { PendingHostKey } from "../../lib/ipc";
import { fingerprintParts, hostLabel } from "./host-key";

export type HostKeyPrompt =
  | { kind: "unknown"; key: PendingHostKey }
  | { kind: "changed"; host: string; port: number };

interface HostKeyDialogProps {
  /** null keeps the dialog closed. */
  prompt: HostKeyPrompt | null;
  /** Unknown host: save the key to known_hosts and connect. */
  onTrust: () => void;
  /** Changed key: remove the old known_hosts entry and reconnect (which asks about the new key). */
  onReplace: () => void;
  /** Closes the dialog without trusting anything (also Escape and the close button). */
  onCancel: () => void;
}

/**
 * Asks before trusting a host key. Focus starts on the safe choice, and Enter
 * only activates the focused button. A changed key is a possible
 * man-in-the-middle attack: it is styled as danger and the replace action stays
 * disabled until the user confirms they verified the new key.
 */
export default function HostKeyDialog({ prompt, onTrust, onReplace, onCancel }: HostKeyDialogProps) {
  return (
    <Dialog
      open={prompt !== null}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      {prompt?.kind === "unknown" && <UnknownHost pendingKey={prompt.key} onTrust={onTrust} onCancel={onCancel} />}
      {prompt?.kind === "changed" && (
        <ChangedKey host={prompt.host} port={prompt.port} onReplace={onReplace} onCancel={onCancel} />
      )}
    </Dialog>
  );
}

function UnknownHost({
  pendingKey,
  onTrust,
  onCancel,
}: {
  pendingKey: PendingHostKey;
  onTrust: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const host = hostLabel(pendingKey.host, pendingKey.port);
  const { algorithm, groups } = fingerprintParts(pendingKey.fingerprint);
  return (
    <DialogContent
      size="md"
      title="Unknown host"
      description={`This is the first connection to ${host}. Compare the fingerprint with the one from your server administrator before you trust it.`}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        cancelRef.current?.focus();
      }}
      footer={
        <>
          <Button ref={cancelRef} onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" leadingIcon={<ShieldCheck {...ICON_SM} />} onClick={onTrust}>
            Trust host
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <span aria-hidden className="mt-0.5 inline-flex shrink-0 text-warning">
          <ShieldQuestion {...ICON_MD} />
        </span>
        <dl className="grid min-w-0 flex-1 grid-cols-[88px_1fr] gap-x-3 gap-y-2 rounded-md border border-border bg-raised p-3 text-label">
          <dt className="text-fg-muted">Host</dt>
          <dd className="min-w-0 break-all font-mono text-fg">{host}</dd>
          <dt className="text-fg-muted">Key type</dt>
          <dd className="font-mono text-fg">{pendingKey.keyType}</dd>
          <dt className="text-fg-muted">Fingerprint</dt>
          <dd className="min-w-0">
            {algorithm && <span className="mb-1 block text-caption text-fg-muted">{algorithm}</span>}
            <span
              data-testid="fingerprint"
              className="flex flex-wrap gap-x-1.5 gap-y-0.5 font-mono text-body text-fg"
            >
              {groups.map((group, i) => (
                <span key={i}>{group}</span>
              ))}
            </span>
          </dd>
        </dl>
      </div>
    </DialogContent>
  );
}

function ChangedKey({
  host,
  port,
  onReplace,
  onCancel,
}: {
  host: string;
  port: number;
  onReplace: () => void;
  onCancel: () => void;
}) {
  const [verified, setVerified] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const label = hostLabel(host, port);
  return (
    <DialogContent
      size="md"
      title="Host key changed"
      description={`The key ${label} sent does not match the one saved in ~/.ssh/known_hosts.`}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        cancelRef.current?.focus();
      }}
      footer={
        <>
          <Button ref={cancelRef} onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" disabled={!verified} onClick={onReplace}>
            Remove old key and reconnect
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div role="alert" className="flex gap-3 rounded-md border border-danger bg-danger-subtle p-3 text-label text-fg">
          <span aria-hidden className="mt-0.5 inline-flex shrink-0 text-danger">
            <ShieldAlert {...ICON_MD} />
          </span>
          <p>
            Someone could be intercepting this connection (a man-in-the-middle attack), or the server was
            reinstalled. Do not continue unless the server administrator confirms the key changed.
          </p>
        </div>
        <p className="text-label text-fg-muted">
          Removing the old key deletes every saved key for <span className="font-mono text-fg">{host}</span>. You
          will then be asked to verify the new fingerprint.
        </p>
        <Checkbox
          label="I verified the new key with the server administrator"
          checked={verified}
          onCheckedChange={(checked) => setVerified(checked === true)}
        />
      </div>
    </DialogContent>
  );
}
