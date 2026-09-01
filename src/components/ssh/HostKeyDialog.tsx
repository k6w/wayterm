import { useRef } from "react";
import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import type { ReactNode } from "react";
import { Button, Dialog, DialogContent, FormCard, ICON_MD, ICON_SM } from "../../ui";
import type { PendingHostKey } from "../../lib/ipc";
import { fingerprintParts, hostLabel } from "./host-key";

export type HostKeyPrompt =
  | { kind: "unknown"; key: PendingHostKey }
  | { kind: "changed"; host: string; port: number };

interface HostKeyDialogProps {
  /** null keeps the dialog closed. */
  prompt: HostKeyPrompt | null;
  /** True while a trust request is running: buttons are disabled and Escape is ignored. */
  pending?: boolean;
  /** Unknown host: save the key to known_hosts and connect. */
  onTrust: () => void;
  /** Changed key: open Settings on the SSH panel (known hosts). Nothing is trusted or removed here. */
  onOpenSettings: () => void;
  /** Closes the dialog without trusting anything (also Escape and the close button). */
  onCancel: () => void;
}

/**
 * Asks before trusting a host key. Focus starts on the safe choice, and Enter
 * only activates the focused button. A changed key is a possible
 * man-in-the-middle attack: it is styled as danger and offers no way to trust
 * or remove a key, only to close or to review known hosts in SSH settings.
 */
export default function HostKeyDialog({ prompt, pending = false, onTrust, onOpenSettings, onCancel }: HostKeyDialogProps) {
  return (
    <Dialog
      open={prompt !== null}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
      }}
    >
      {prompt?.kind === "unknown" && <UnknownHost pendingKey={prompt.key} pending={pending} onTrust={onTrust} onCancel={onCancel} />}
      {prompt?.kind === "changed" && (
        <ChangedKey host={prompt.host} port={prompt.port} onOpenSettings={onOpenSettings} onCancel={onCancel} />
      )}
    </Dialog>
  );
}

function UnknownHost({
  pendingKey,
  pending,
  onTrust,
  onCancel,
}: {
  pendingKey: PendingHostKey;
  pending: boolean;
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
      descriptionPlacement="body"
      icon={<ShieldQuestion {...ICON_MD} />}
      tone="warning"
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        cancelRef.current?.focus();
      }}
      footer={
        <>
          <Button ref={cancelRef} disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" disabled={pending} leadingIcon={<ShieldCheck {...ICON_SM} />} onClick={onTrust}>
            Trust host
          </Button>
        </>
      }
    >
      <FormCard>
        <DetailRow label="Host">
          <span className="break-all font-mono text-fg">{host}</span>
        </DetailRow>
        <DetailRow label="Key type">
          <span className="font-mono text-fg">{pendingKey.keyType}</span>
        </DetailRow>
        <DetailRow label="Fingerprint">
          {algorithm && <span className="mb-1 block text-caption text-fg-muted">{algorithm}</span>}
          <span data-testid="fingerprint" className="flex flex-wrap gap-x-1.5 gap-y-0.5 font-mono text-body text-fg">
            {groups.map((group, i) => (
              <span key={i}>{group}</span>
            ))}
          </span>
        </DetailRow>
      </FormCard>
    </DialogContent>
  );
}

function ChangedKey({
  host,
  port,
  onOpenSettings,
  onCancel,
}: {
  host: string;
  port: number;
  onOpenSettings: () => void;
  onCancel: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const label = hostLabel(host, port);
  return (
    <DialogContent
      size="md"
      title="Host key changed"
      hideClose
      description={`The key ${label} sent differs from the one saved in ~/.ssh/known_hosts.`}
      icon={<ShieldAlert {...ICON_MD} />}
      tone="danger"
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        closeRef.current?.focus();
      }}
      footer={
        <>
          <Button onClick={onOpenSettings}>Open SSH settings</Button>
          <Button ref={closeRef} variant="primary" onClick={onCancel}>
            Close
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
            reinstalled. The connection was not made. Do not continue unless the server administrator confirms the
            key changed.
          </p>
        </div>
        <FormCard>
          <DetailRow label="Host">
            <span className="break-all font-mono text-fg">{label}</span>
          </DetailRow>
        </FormCard>
        <p className="text-label text-fg-muted">
          To use this server again, review its saved key in SSH settings under known hosts. Nothing is changed from
          this dialog.
        </p>
      </div>
    </DialogContent>
  );
}

/** One labelled fact inside a FormCard: muted label left, value right. */
function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-3 px-row-x py-row-y text-label">
      <span className="text-fg-muted">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
