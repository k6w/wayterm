import { useCallback, useEffect, useRef, useState } from "react";
import { sshKnownHostsReplace, type HostKeyMismatch } from "../../lib/ipc";
import { expectedOldKey } from "./host-key";

export interface ChangedHostKey {
  /** The changed key being asked about; null keeps the dialog closed. */
  mismatch: HostKeyMismatch | null;
  /** True while the replacement request runs. */
  replacing: boolean;
  /** Why the last replacement failed (known_hosts is unchanged then). */
  error: string | null;
  /** Shows the changed-key prompt. Resolves true once the key was replaced, false when cancelled. */
  ask: (mismatch: HostKeyMismatch) => Promise<boolean>;
  /** Replaces the saved key whose fingerprint the user was shown with the server's new key. */
  replace: () => void;
  /** Closes the prompt without changing anything (ignored while replacing). */
  cancel: () => void;
}

/**
 * State for the changed-host-key prompt shared by the terminal and SFTP. The
 * replacement only goes through when known_hosts still holds the old key the
 * user saw (the backend checks the expected fingerprint); on any error the
 * prompt stays open with the message and nothing is changed.
 */
export function useChangedHostKey(): ChangedHostKey {
  const [mismatch, setMismatch] = useState<HostKeyMismatch | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mismatchRef = useRef<HostKeyMismatch | null>(null);
  const resolveRef = useRef<((replaced: boolean) => void) | null>(null);
  // The ref blocks a second request before the disabled state renders (double click).
  const replacingRef = useRef(false);

  const settle = useCallback((replaced: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    mismatchRef.current = null;
    setMismatch(null);
    setError(null);
    resolve?.(replaced);
  }, []);

  const ask = useCallback(
    (next: HostKeyMismatch) =>
      new Promise<boolean>((resolve) => {
        // A newer prompt replaces an unanswered one, which counts as cancelled.
        resolveRef.current?.(false);
        resolveRef.current = resolve;
        mismatchRef.current = next;
        setMismatch(next);
        setError(null);
      }),
    []
  );

  const replace = useCallback(async () => {
    const current = mismatchRef.current;
    if (!current || replacingRef.current) return;
    replacingRef.current = true;
    setReplacing(true);
    setError(null);
    try {
      await sshKnownHostsReplace(
        current.host,
        current.port,
        expectedOldKey(current).fingerprint,
        current.newKeyType,
        current.newKeyB64
      );
      settle(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      replacingRef.current = false;
      setReplacing(false);
    }
  }, [settle]);

  const cancel = useCallback(() => {
    if (replacingRef.current) return;
    settle(false);
  }, [settle]);

  // An unanswered prompt counts as cancelled when the owner unmounts.
  useEffect(() => () => resolveRef.current?.(false), []);

  return { mismatch, replacing, error, ask, replace: () => void replace(), cancel };
}
