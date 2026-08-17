import { useCallback, useEffect, useRef, useState } from "react";
import { useTerminalStore } from "../../stores/terminal";
import { useSshStore } from "../../stores/ssh";
import { useSftpStore } from "../../stores/sftp";
import { sshClearPendingHostKey, sshGetPendingHostKey, sshKnownHostsAdd, type PendingHostKey } from "../../lib/ipc";
import { isHostKeyChanged } from "../ssh/host-key";
import type { HostKeyPrompt } from "../ssh/HostKeyDialog";

export interface SftpSession {
  /** The open SFTP session, once connected. */
  sessionId: string | null;
  connecting: boolean;
  error: string | null;
  /** Shown while connecting. */
  connectionName: string;
  /** The host-key question to show, if any (unknown host or changed key). */
  hostKeyPrompt: HostKeyPrompt | null;
  /** True while a trust request runs (the dialog disables its buttons). */
  trusting: boolean;
  trustHost: () => void;
  /** Changed key: close the dialog and open Settings on the SSH panel. */
  openSshSettings: () => void;
  cancelHostKey: () => void;
}

/**
 * Connects the pane's SFTP session once per pane (reusing a session that
 * survived a split remount) and runs the host-key flow: trust an unknown
 * host, or for a changed key only explain and point to SSH settings.
 * Disconnects only when the pane is really gone, not on a remount.
 */
export function useSftpSession(paneId: string): SftpSession {
  const sessionIdRef = useRef<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [connectionName, setConnectionName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tofuPending, setTofuPending] = useState<PendingHostKey | null>(null);
  const [trusting, setTrusting] = useState(false);
  const trustingRef = useRef(false);
  const [hostKeyChanged, setHostKeyChanged] = useState<{ host: string; port: number } | null>(null);

  const sftpConnId = useTerminalStore((s) => s.panes[paneId]?.sftpConnectionId ?? "");
  const sftpConn = useSshStore((s) => s.connections.find((c) => c.id === sftpConnId));

  // Connect on mount.
  useEffect(() => {
    let cancelled = false;
    // Mount-time snapshot: connect once per pane. Store actions are stable, and
    // the pane's connection id and session id are read as they are right now.
    const pane = useTerminalStore.getState().panes[paneId];
    const { connect, disconnect } = useSftpStore.getState();

    (async () => {
      const connId = pane?.sftpConnectionId;
      if (!connId) {
        setError("No SFTP connection ID configured for this pane.");
        setConnecting(false);
        return;
      }

      const conn = useSshStore.getState().connections.find((c) => c.id === connId);
      setConnectionName(conn?.name ?? conn?.host ?? "remote host");

      // Reuse an existing session (e.g. after a split causes a remount).
      const existingSid = pane?.sessionId;
      if (existingSid && useSftpStore.getState().sessions[existingSid]) {
        sessionIdRef.current = existingSid;
        setSessionId(existingSid);
        setConnecting(false);
        return;
      }

      try {
        const sid = await connect(connId, conn?.name ?? "SFTP");
        if (cancelled) {
          disconnect(sid).catch(() => {});
          return;
        }
        sessionIdRef.current = sid;
        setSessionId(sid);
        // Persist so the session survives remounts (e.g. split/unsplit).
        useTerminalStore.getState().updatePaneSession(paneId, sid);
        setConnecting(false);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("TOFU_REQUIRED") && conn) {
          // Unknown host: fetch the pending key and ask.
          try {
            const key = await sshGetPendingHostKey(conn.host, conn.port ?? 22);
            if (key) {
              setTofuPending(key);
              setConnecting(false);
              return;
            }
          } catch {
            // fall through to generic error
          }
        }
        if (conn && isHostKeyChanged(msg)) {
          setHostKeyChanged({ host: conn.host, port: conn.port ?? 22 });
        }
        setError(msg);
        setConnecting(false);
      }
    })();

    return () => {
      cancelled = true;
      const sid = sessionIdRef.current;
      sessionIdRef.current = null;
      if (!sid) return;
      // Only disconnect when the pane is truly removed (tab closed). If it
      // still exists, this is a remount caused by a split layout change.
      if (!useTerminalStore.getState().panes[paneId]) {
        disconnect(sid).catch(() => {});
      }
    };
  }, [paneId]);

  const trustHost = useCallback(async () => {
    // The ref blocks a second request before the disabled state renders (double click).
    if (!tofuPending || !sftpConn || trustingRef.current) return;
    trustingRef.current = true;
    setTrusting(true);
    try {
      await sshKnownHostsAdd(tofuPending.host, tofuPending.port, tofuPending.keyType, tofuPending.keyData);
      await sshClearPendingHostKey(tofuPending.host, tofuPending.port);
      setTofuPending(null);
      setConnecting(true);
      setError(null);
      const sid = await useSftpStore.getState().connect(sftpConnId, sftpConn.name ?? "SFTP");
      sessionIdRef.current = sid;
      setSessionId(sid);
      useTerminalStore.getState().updatePaneSession(paneId, sid);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      trustingRef.current = false;
      setTrusting(false);
      setConnecting(false);
    }
  }, [tofuPending, sftpConn, sftpConnId, paneId]);

  const cancelTofu = useCallback(async () => {
    if (tofuPending) {
      await sshClearPendingHostKey(tofuPending.host, tofuPending.port).catch(() => {});
    }
    setTofuPending(null);
    setError("Connection cancelled — host not trusted.");
  }, [tofuPending]);

  const hostKeyPrompt: HostKeyPrompt | null = tofuPending
    ? { kind: "unknown", key: tofuPending }
    : hostKeyChanged
      ? { kind: "changed", ...hostKeyChanged }
      : null;

  return {
    sessionId,
    connecting,
    error,
    connectionName,
    hostKeyPrompt,
    trusting,
    trustHost: () => void trustHost(),
    // Changed key: the dialog only closes or sends the user to SSH settings.
    openSshSettings: () => {
      setHostKeyChanged(null);
      useTerminalStore.getState().openSettings("ssh");
    },
    cancelHostKey: () => {
      if (tofuPending) void cancelTofu();
      else setHostKeyChanged(null);
    },
  };
}
