import { useRef, useState } from "react";
import { Icon } from "../../ui/icons";
import type { ReactNode } from "react";
import { Button, Dialog, DialogContent, FormCard, FormRow, Input, cn, focusRing } from "../../ui";
import type { HostKeyMismatch, PendingHostKey } from "../../lib/ipc";
import { confirmationCode, fingerprintParts, hostLabel } from "./host-key";

export type HostKeyPrompt =
  | { kind: "unknown"; key: PendingHostKey }
  | { kind: "changed"; mismatch: HostKeyMismatch };

interface HostKeyDialogProps {
  /** null keeps the dialog closed. */
  prompt: HostKeyPrompt | null;
  /** True while a trust or replace request is running: buttons are disabled and Escape is ignored. */
  pending?: boolean;
  /** Changed key: why the last replacement failed, shown inline (nothing was changed). */
  replaceError?: string | null;
  /** Unknown host: save the key to known_hosts and connect. */
  onTrust: () => void;
  /** Changed key, after the user typed the confirmation code: replace the saved key and connect. */
  onReplace: () => void;
  /** Changed key: open Settings on the SSH panel (known hosts). */
  onOpenSettings: () => void;
  /** Closes the dialog without trusting or changing anything (also Escape and the close button). */
  onCancel: () => void;
}

/**
 * Asks before trusting a host key. Focus starts on the safe choice, and Enter
 * only activates the focused button. A changed key is a possible
 * man-in-the-middle attack: it is styled as danger, shows the saved and the
 * presented fingerprints side by side, and only replaces the saved key after
 * the user types the last 4 characters of the new fingerprint.
 */
export default function HostKeyDialog({
  prompt,
  pending = false,
  replaceError = null,
  onTrust,
  onReplace,
  onOpenSettings,
  onCancel,
}: HostKeyDialogProps) {
  return (
    <Dialog
      open={prompt !== null}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
      }}
    >
      {prompt?.kind === "unknown" && <UnknownHost pendingKey={prompt.key} pending={pending} onTrust={onTrust} onCancel={onCancel} />}
      {prompt?.kind === "changed" && (
        <ChangedKey
          // A different key starts a fresh confirmation.
          key={prompt.mismatch.newFingerprint}
          mismatch={prompt.mismatch}
          pending={pending}
          error={replaceError}
          onReplace={onReplace}
          onOpenSettings={onOpenSettings}
          onCancel={onCancel}
        />
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
  return (
    <DialogContent
      size="md"
      title="Unknown host"
      description={`This is the first connection to ${host}. Compare the fingerprint with the one from your server administrator before you trust it.`}
      descriptionPlacement="body"
      icon={<Icon name="hostKeyUnknown" size="md" />}
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
          <Button variant="primary" disabled={pending} leadingIcon={<Icon name="hostKeyTrusted" size="sm" />} onClick={onTrust}>
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
          <Fingerprint value={pendingKey.fingerprint} />
        </DetailRow>
      </FormCard>
    </DialogContent>
  );
}

function ChangedKey({
  mismatch,
  pending,
  error,
  onReplace,
  onOpenSettings,
  onCancel,
}: {
  mismatch: HostKeyMismatch;
  pending: boolean;
  error: string | null;
  onReplace: () => void;
  onOpenSettings: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [typed, setTyped] = useState("");
  const label = hostLabel(mismatch.host, mismatch.port);
  // Case-sensitive: the user must read the new fingerprint, not just any key's.
  const confirmed = typed === confirmationCode(mismatch.newFingerprint);
  return (
    <DialogContent
      size="lg"
      title="Host key changed"
      hideClose
      description={`${label} presented a different key than the one saved in known_hosts.`}
      icon={<Icon name="hostKeyChanged" size="md" />}
      tone="danger"
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        cancelRef.current?.focus();
      }}
      footer={
        <>
          <Button ref={cancelRef} disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!confirmed || pending} onClick={onReplace}>
            Replace key and connect
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div role="alert" className="flex gap-3 rounded-md border border-danger bg-danger-subtle p-3 text-label text-fg">
          <span aria-hidden className="mt-0.5 inline-flex shrink-0 text-danger">
            <Icon name="hostKeyChanged" size="md" />
          </span>
          <p>
            Someone could be intercepting this connection (a man-in-the-middle attack), or the server was reinstalled
            or its keys were changed. The connection was not made. Only replace the saved key after you have verified
            the new fingerprint.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <KeyGroup title="Saved key">
            {mismatch.oldKeys.map((key) => (
              <KeyDetails
                key={`${key.lineNumber}-${key.fingerprint}`}
                keyType={key.keyType}
                fingerprint={key.fingerprint}
                note={`known_hosts line ${key.lineNumber}`}
              />
            ))}
          </KeyGroup>
          <KeyGroup title="Server now presents" danger>
            <KeyDetails keyType={mismatch.newKeyType} fingerprint={mismatch.newFingerprint} />
          </KeyGroup>
        </div>

        <p className="text-label text-fg-muted">
          To verify the new fingerprint, ask your server administrator for it, or run{" "}
          <code className="break-all font-mono text-fg">ssh-keygen -lf /etc/ssh/ssh_host_*_key.pub</code> on the server
          and compare.
        </p>

        <FormCard>
          <FormRow
            label="Type the last 4 characters of the new fingerprint"
            hint="Case-sensitive. The saved key is replaced only if it is still the one shown here."
            width="sm"
          >
            {(control) => (
              <Input
                {...control}
                code
                maxLength={4}
                autoComplete="off"
                value={typed}
                disabled={pending}
                onChange={(event) => setTyped(event.target.value)}
              />
            )}
          </FormRow>
        </FormCard>

        {error && (
          <p role="alert" className="text-label text-danger">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={pending}
          onClick={onOpenSettings}
          className={cn(
            "self-start rounded-sm text-label text-accent-fg hover:underline disabled:pointer-events-none disabled:opacity-50",
            focusRing
          )}
        >
          Open SSH settings
        </button>
      </div>
    </DialogContent>
  );
}

/** One side of the changed-key comparison, exposed as a group named by its title. */
function KeyGroup({ title, danger = false, children }: { title: string; danger?: boolean; children: ReactNode }) {
  return (
    <section
      role="group"
      aria-label={title}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-lg border bg-panel p-3",
        danger ? "border-danger" : "border-border"
      )}
    >
      <h3 className={cn("text-caption font-medium uppercase tracking-wide", danger ? "text-danger" : "text-fg-muted")}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function KeyDetails({ keyType, fingerprint, note }: { keyType: string; fingerprint: string; note?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 text-label">
      <span className="font-mono text-fg">{keyType}</span>
      {note && <span className="text-caption text-fg-muted">{note}</span>}
      <Fingerprint value={fingerprint} />
    </div>
  );
}

/** A fingerprint in mono, its digest grouped by 4 characters for comparing. */
function Fingerprint({ value }: { value: string }) {
  const { algorithm, groups } = fingerprintParts(value);
  return (
    <div>
      {algorithm && <span className="mb-1 block text-caption text-fg-muted">{algorithm}</span>}
      <span data-testid="fingerprint" className="flex flex-wrap gap-x-1.5 gap-y-0.5 font-mono text-body text-fg">
        {groups.map((group, i) => (
          <span key={i}>{group}</span>
        ))}
      </span>
    </div>
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
