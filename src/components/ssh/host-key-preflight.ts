import { sshCheckHostKey, type HostKeyMismatch } from "../../lib/ipc";
import { parseHostKeyMismatch } from "./host-key";

interface PreflightTarget {
  host: string;
  port?: number;
  jumpHostId: string | null;
}

/**
 * Before the terminal runs `ssh`: checks the server's host key without logging
 * in. The backend resolves the destination with `ssh -G` and skips the check
 * when ssh would use a proxy, a HostKeyAlias or another known_hosts file. A changed key is put to the user through `ask` (the changed-key dialog);
 * resolves false when they cancel, so `ssh` is not started. Anything else
 * (trusted, unknown, unreachable) goes ahead and `ssh` reports it itself.
 * Behind a jump host the target is not reachable directly, so there is no check.
 */
export async function preflightHostKey(
  target: PreflightTarget,
  ask: (mismatch: HostKeyMismatch) => Promise<boolean>
): Promise<boolean> {
  if (target.jumpHostId) return true;
  try {
    // Mirrors the terminal: ssh gets -p only for a non-default port, so a Port in ~/.ssh/config still applies.
    const port = target.port && target.port !== 22 ? target.port : null;
    await sshCheckHostKey(target.host, port);
    return true;
  } catch (err) {
    const mismatch = parseHostKeyMismatch(err instanceof Error ? err.message : String(err));
    return mismatch ? ask(mismatch) : true;
  }
}
