import { useState, useEffect, useCallback, useRef } from "react";
import {
  Upload,
  Download,
  FolderPlus,
  Trash2,
  Edit3,
  RefreshCw,
  PanelLeftClose,
  PanelLeft,
  ArrowUp,
  ExternalLink,
} from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { useTerminalStore } from "../../stores/terminal";
import { useSshStore } from "../../stores/ssh";
import { useSftpStore } from "../../stores/sftp";
import { useThemeStore } from "../../stores/theme";
import { useSettingsStore } from "../../stores/settings";
import { hexToRgba } from "../../lib/color";
import {
  sshGetPendingHostKey,
  sshKnownHostsAdd,
  sshKnownHostsRemove,
  sshClearPendingHostKey,
  type PendingHostKey,
} from "../../lib/ipc";
import HostKeyDialog from "../ssh/HostKeyDialog";
import { isHostKeyChanged, knownHostsNames } from "../ssh/host-key";
import { vibrancyAlpha } from "../../lib/platform";
import PathBreadcrumb from "./PathBreadcrumb";
import FileList from "./FileList";
import TransferQueue from "./TransferQueue";
import SftpContextMenu from "./SftpContextMenu";
import FileConflictDialog from "./FileConflictDialog";
import ConfirmDialog from "../ui/ConfirmDialog";
import InputDialog from "../ui/InputDialog";
import type { SftpEntry } from "../../types/sftp";

interface SftpPaneProps {
  paneId: string;
  isActive: boolean;
  paneCount?: number;
}

const EMPTY_ENTRIES: SftpEntry[] = [];

/** Navigate up one directory */
function parentPath(p: string): string {
  // Handle Windows paths like "C:/"
  if (/^[A-Za-z]:\/?$/.test(p)) return p;
  // Handle Unix root
  if (p === "/") return "/";
  // Remove trailing slash
  const trimmed = p.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  if (idx <= 0) return "/";
  // Windows root: keep "C:/"
  if (/^[A-Za-z]:$/.test(trimmed.substring(0, idx))) {
    return trimmed.substring(0, idx) + "/";
  }
  return trimmed.substring(0, idx);
}

export default function SftpPane({
  paneId,
  isActive,
  paneCount = 1,
}: SftpPaneProps) {
  const theme = useThemeStore((s) => s.active);
  const vibrancy = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const windowOpacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);
  const setActivePane = useTerminalStore((s) => s.setActivePane);
  const closePaneInTab = useTerminalStore((s) => s.closePaneInTab);
  const detachPaneToTab = useTerminalStore((s) => s.detachPaneToTab);
  const pane = useTerminalStore((s) => s.panes[paneId]);

  const sessionIdRef = useRef<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [connectionName, setConnectionName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [desktopDragOver, setDesktopDragOver] = useState(false);
  const [tofuPending, setTofuPending] = useState<PendingHostKey | null>(null);
  const [trusting, setTrusting] = useState(false);
  const trustingRef = useRef(false);
  const [hostKeyChanged, setHostKeyChanged] = useState<{ host: string; port: number } | null>(null);

  // Selection state
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set());
  const [remoteSelected, setRemoteSelected] = useState<Set<string>>(new Set());

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    entry: SftpEntry | null;
    side: "local" | "remote";
  } | null>(null);

  // File conflict dialog state
  const [conflictInfo, setConflictInfo] = useState<{
    localPath: string;
    remotePath: string;
    fileName: string;
    sessionId: string;
  } | null>(null);

  // React-level drag state (fallback for when Tauri eats HTML5 drop events)
  const [dragEntries, setDragEntries] = useState<{
    paths: string[];
    source: "local" | "remote";
  } | null>(null);

  // Delete confirmation dialog state
  const [deleteInfo, setDeleteInfo] = useState<{
    entries: SftpEntry[];
  } | null>(null);

  // Rename input dialog state
  const [renameInfo, setRenameInfo] = useState<{
    entry: SftpEntry;
  } | null>(null);

  // New folder input dialog state
  const [newFolderOpen, setNewFolderOpen] = useState(false);

  // Store selectors
  const session = useSftpStore((s) => (sessionId ? s.sessions[sessionId] : null));
  const remoteEntries = useSftpStore((s) => (sessionId ? s.remoteEntries[sessionId] ?? EMPTY_ENTRIES : EMPTY_ENTRIES));
  const localEntries = useSftpStore((s) => (sessionId ? s.localEntries[sessionId] ?? EMPTY_ENTRIES : EMPTY_ENTRIES));
  const transfers = useSftpStore((s) => s.transfers);
  const localCollapsed = useSftpStore((s) => (sessionId ? s.localCollapsed[sessionId] ?? true : true));

  const updatePaneSession = useTerminalStore((s) => s.updatePaneSession);

  const loadRemoteDir = useSftpStore((s) => s.loadRemoteDir);
  const loadLocalDir = useSftpStore((s) => s.loadLocalDir);
  const remoteMkdir = useSftpStore((s) => s.remoteMkdir);
  const remoteRemove = useSftpStore((s) => s.remoteRemove);
  const remoteRename = useSftpStore((s) => s.remoteRename);
  const downloadFile = useSftpStore((s) => s.download);
  const uploadFile = useSftpStore((s) => s.upload);
  const clearCompleted = useSftpStore((s) => s.clearCompletedTransfers);
  const setLocalCollapsed = useSftpStore((s) => s.setLocalCollapsed);

  // Derived paths
  const remoteCwd = session?.remoteCwd ?? "/";
  const localCwd = session?.localCwd ?? "";

  // Connect on mount
  useEffect(() => {
    let cancelled = false;
    // Mount-time snapshot: connect once per pane. Store actions are stable, and
    // the pane's connection id and session id are read as they are right now.
    const pane = useTerminalStore.getState().panes[paneId];
    const { connect, disconnect } = useSftpStore.getState();

    (async () => {
      const sftpConnId = pane?.sftpConnectionId;
      if (!sftpConnId) {
        setError("No SFTP connection ID configured for this pane.");
        setConnecting(false);
        return;
      }

      // Find the SSH connection info for display
      const conn = useSshStore
        .getState()
        .connections.find((c) => c.id === sftpConnId);
      setConnectionName(conn?.name ?? conn?.host ?? "remote host");

      // Reuse an existing session (e.g. after a split causes a remount)
      const existingSid = pane?.sessionId;
      if (existingSid && useSftpStore.getState().sessions[existingSid]) {
        sessionIdRef.current = existingSid;
        setSessionId(existingSid);
        setConnecting(false);
        return;
      }

      try {
        const sid = await connect(sftpConnId, conn?.name ?? "SFTP");
        if (cancelled) {
          disconnect(sid).catch(() => {});
          return;
        }
        sessionIdRef.current = sid;
        setSessionId(sid);
        // Persist so the session survives remounts (e.g. split/unsplit)
        useTerminalStore.getState().updatePaneSession(paneId, sid);
        setConnecting(false);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("TOFU_REQUIRED") && conn) {
          // Unknown host — fetch the pending key and show trust dialog
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
      // Only disconnect when the pane is truly removed (tab closed).
      // If the pane still exists in the store, this is just a remount
      // caused by a split layout change — keep the session alive.
      if (!useTerminalStore.getState().panes[paneId]) {
        disconnect(sid).catch(() => {});
      }
    };
  }, [paneId]);

  // -- Selection handlers --

  const handleLocalSelect = useCallback(
    (path: string, multi: boolean) => {
      setLocalSelected((prev) => {
        const next = new Set(multi ? prev : []);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return next;
      });
    },
    []
  );

  const handleRemoteSelect = useCallback(
    (path: string, multi: boolean) => {
      setRemoteSelected((prev) => {
        const next = new Set(multi ? prev : []);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return next;
      });
    },
    []
  );

  // -- Navigation --

  const navigateRemote = useCallback(
    (path: string) => {
      if (!sessionId) return;
      setRemoteSelected(new Set());
      loadRemoteDir(sessionId, path);
    },
    [sessionId, loadRemoteDir]
  );

  const navigateLocal = useCallback(
    (path: string) => {
      if (!sessionId) return;
      setLocalSelected(new Set());
      loadLocalDir(sessionId, path);
    },
    [sessionId, loadLocalDir]
  );

  // -- Upload with conflict check --

  const uploadWithCheck = useCallback(
    (sid: string, localPath: string, remotePath: string) => {
      const fileName = remotePath.split("/").pop() || remotePath;
      const exists = remoteEntries.some((e) => e.name === fileName);
      if (exists) {
        setConflictInfo({ localPath, remotePath, fileName, sessionId: sid });
      } else {
        uploadFile(sid, localPath, remotePath);
      }
    },
    [remoteEntries, uploadFile]
  );

  const handleConflictReplace = useCallback(() => {
    if (!conflictInfo) return;
    uploadFile(conflictInfo.sessionId, conflictInfo.localPath, conflictInfo.remotePath);
    setConflictInfo(null);
  }, [conflictInfo, uploadFile]);

  const handleConflictRename = useCallback(
    (newPath: string) => {
      if (!conflictInfo) return;
      uploadFile(conflictInfo.sessionId, conflictInfo.localPath, newPath);
      setConflictInfo(null);
    },
    [conflictInfo, uploadFile]
  );

  const handleConflictSkip = useCallback(() => {
    setConflictInfo(null);
  }, []);

  // -- Toolbar actions --

  const handleUpload = useCallback(() => {
    if (!sessionId) return;
    const selected = localEntries.filter((e) => localSelected.has(e.path) && !e.isDir);
    for (const entry of selected) {
      const targetPath = remoteCwd.replace(/\/+$/, "") + "/" + entry.name;
      uploadWithCheck(sessionId, entry.path, targetPath);
    }
  }, [sessionId, localEntries, localSelected, remoteCwd, uploadWithCheck]);

  const handleDownload = useCallback(() => {
    if (!sessionId) return;
    const selected = remoteEntries.filter((e) => remoteSelected.has(e.path) && !e.isDir);
    for (const entry of selected) {
      const sep = localCwd.includes("\\") ? "\\" : "/";
      const targetPath = localCwd.replace(/[/\\]+$/, "") + sep + entry.name;
      downloadFile(sessionId, entry.path, targetPath);
    }
  }, [sessionId, remoteEntries, remoteSelected, localCwd, downloadFile]);

  const handleNewFolder = useCallback(() => {
    if (!sessionId) return;
    setNewFolderOpen(true);
  }, [sessionId]);

  const handleNewFolderConfirm = useCallback(
    async (name: string) => {
      if (!sessionId) return;
      const path = remoteCwd.replace(/\/+$/, "") + "/" + name;
      const opId = `mkdir:${path}`;
      setPendingOps((prev) => new Set([...prev, opId]));
      try {
        await remoteMkdir(sessionId, path);
      } finally {
        setPendingOps((prev) => { const next = new Set(prev); next.delete(opId); return next; });
      }
      setNewFolderOpen(false);
    },
    [sessionId, remoteCwd, remoteMkdir]
  );

  const handleDelete = useCallback(() => {
    if (!sessionId) return;
    const selected = remoteEntries.filter((e) => remoteSelected.has(e.path));
    if (selected.length === 0) return;
    setDeleteInfo({ entries: selected });
  }, [sessionId, remoteEntries, remoteSelected]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!sessionId || !deleteInfo) return;
    const opIds = deleteInfo.entries.map((e) => `delete:${e.path}`);
    setPendingOps((prev) => new Set([...prev, ...opIds]));
    try {
      for (const entry of deleteInfo.entries) {
        await remoteRemove(sessionId, entry.path, entry.isDir);
      }
    } finally {
      setPendingOps((prev) => { const next = new Set(prev); opIds.forEach((id) => next.delete(id)); return next; });
    }
    setRemoteSelected(new Set());
    setDeleteInfo(null);
  }, [sessionId, deleteInfo, remoteRemove]);

  const handleRename = useCallback(() => {
    if (!sessionId) return;
    const selected = remoteEntries.filter((e) => remoteSelected.has(e.path));
    if (selected.length !== 1) return;
    setRenameInfo({ entry: selected[0] });
  }, [sessionId, remoteEntries, remoteSelected]);

  const handleRenameConfirm = useCallback(
    async (newName: string) => {
      if (!sessionId || !renameInfo) return;
      if (newName === renameInfo.entry.name) {
        setRenameInfo(null);
        return;
      }
      const dir = renameInfo.entry.path.substring(
        0,
        renameInfo.entry.path.lastIndexOf("/")
      );
      const opId = `rename:${renameInfo.entry.path}`;
      setPendingOps((prev) => new Set([...prev, opId]));
      try {
        await remoteRename(sessionId, renameInfo.entry.path, dir + "/" + newName);
      } finally {
        setPendingOps((prev) => { const next = new Set(prev); next.delete(opId); return next; });
      }
      setRemoteSelected(new Set());
      setRenameInfo(null);
    },
    [sessionId, renameInfo, remoteRename]
  );

  const handleRefresh = useCallback(() => {
    if (!sessionId) return;
    loadRemoteDir(sessionId, remoteCwd);
    if (localCwd) loadLocalDir(sessionId, localCwd);
  }, [sessionId, remoteCwd, localCwd, loadRemoteDir, loadLocalDir]);

  const toggleLocal = useCallback(() => {
    if (!sessionId) return;
    setLocalCollapsed(sessionId, !localCollapsed);
  }, [sessionId, localCollapsed, setLocalCollapsed]);

  // -- Context menu handler --

  const handleContextAction = useCallback(
    (action: string, entry: SftpEntry | null) => {
      if (!sessionId) return;

      switch (action) {
        case "open":
          if (entry?.isDir) {
            if (ctxMenu?.side === "local") {
              navigateLocal(entry.path);
            } else {
              navigateRemote(entry.path);
            }
          }
          break;
        case "download":
          if (entry) {
            const sep = localCwd.includes("\\") ? "\\" : "/";
            const target = localCwd.replace(/[/\\]+$/, "") + sep + entry.name;
            downloadFile(sessionId, entry.path, target);
          }
          break;
        case "upload":
          if (entry) {
            const target = remoteCwd.replace(/\/+$/, "") + "/" + entry.name;
            uploadWithCheck(sessionId, entry.path, target);
          }
          break;
        case "rename":
          if (entry) {
            setRenameInfo({ entry });
          }
          break;
        case "delete":
          if (entry) {
            setDeleteInfo({ entries: [entry] });
          }
          break;
        case "copy_path":
          if (entry) navigator.clipboard.writeText(entry.path);
          break;
        case "new_folder":
          handleNewFolder();
          break;
        case "refresh":
          handleRefresh();
          break;
        default:
          break;
      }
    },
    [
      sessionId,
      ctxMenu?.side,
      localCwd,
      remoteCwd,
      navigateLocal,
      navigateRemote,
      downloadFile,
      uploadWithCheck,
      handleNewFolder,
      handleRefresh,
    ]
  );

  // Drag start handler for cross-pane drag
  const handleDragStartLocal = useCallback(
    (e: React.DragEvent, entries: SftpEntry[]) => {
      const paths = entries.map((en) => en.path);
      e.dataTransfer.setData("application/sftp-entries", JSON.stringify(paths));
      e.dataTransfer.effectAllowed = "copy";
      setDragEntries({ paths, source: "local" });
    },
    []
  );

  const handleDragStartRemote = useCallback(
    (e: React.DragEvent, entries: SftpEntry[]) => {
      const paths = entries.map((en) => en.path);
      e.dataTransfer.setData("application/sftp-entries", JSON.stringify(paths));
      e.dataTransfer.effectAllowed = "copy";
      setDragEntries({ paths, source: "remote" });
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDragEntries(null);
  }, []);

  // Drop on remote pane → upload local files
  const handleDropOnRemote = useCallback(
    (e: React.DragEvent) => {
      if (!sessionId) return;
      // Prefer React state (works even if Tauri eats the dataTransfer)
      let paths: string[] | null = null;
      if (dragEntries && dragEntries.source === "local") {
        paths = dragEntries.paths;
      } else {
        const data = e.dataTransfer.getData("application/sftp-entries");
        if (data) paths = JSON.parse(data);
      }
      if (paths) {
        for (const p of paths) {
          const name = p.split(/[/\\]/).pop() || p;
          const target = remoteCwd.replace(/\/+$/, "") + "/" + name;
          uploadWithCheck(sessionId, p, target);
        }
      }
      setDragEntries(null);
    },
    [sessionId, remoteCwd, uploadWithCheck, dragEntries]
  );

  // Drop on local pane → download remote files
  const handleDropOnLocal = useCallback(
    (e: React.DragEvent) => {
      if (!sessionId) return;
      // Prefer React state (works even if Tauri eats the dataTransfer)
      let paths: string[] | null = null;
      if (dragEntries && dragEntries.source === "remote") {
        paths = dragEntries.paths;
      } else {
        const data = e.dataTransfer.getData("application/sftp-entries");
        if (data) paths = JSON.parse(data);
      }
      if (paths) {
        for (const p of paths) {
          const name = p.split("/").pop() || p;
          const sep = localCwd.includes("\\") ? "\\" : "/";
          const target = localCwd.replace(/[/\\]+$/, "") + sep + name;
          downloadFile(sessionId, p, target);
        }
      }
      setDragEntries(null);
    },
    [sessionId, localCwd, downloadFile, dragEntries]
  );

  // Listen for Tauri desktop file drag-over/leave/drop → upload to remote
  useEffect(() => {
    if (!sessionId || !isActive) return;

    const unlistenDrop = listen<{ paths: string[]; position: { x: number; y: number } }>(
      "tauri://drag-drop",
      (event) => {
        setDesktopDragOver(false);
        const sid = sessionIdRef.current;
        if (!sid) return;
        const store = useSftpStore.getState();
        const sess = store.sessions[sid];
        if (!sess) return;
        const filePaths = event.payload.paths;
        if (!filePaths || filePaths.length === 0) return;
        const remEntries = store.remoteEntries[sid] ?? [];
        const remNames = new Set(remEntries.map((e) => e.name));
        for (const filePath of filePaths) {
          const name = filePath.split(/[/\\]/).pop() || filePath;
          const target = sess.remoteCwd.replace(/\/+$/, "") + "/" + name;
          if (remNames.has(name)) {
            // Show conflict dialog for the first conflicting file
            setConflictInfo({ localPath: filePath, remotePath: target, fileName: name, sessionId: sid });
          } else {
            store.upload(sid, filePath, target);
          }
        }
      }
    );

    const unlistenOver = listen("tauri://drag-over", () => {
      setDesktopDragOver(true);
    });

    const unlistenLeave = listen("tauri://drag-leave", () => {
      setDesktopDragOver(false);
    });

    return () => {
      unlistenDrop.then((fn) => fn());
      unlistenOver.then((fn) => fn());
      unlistenLeave.then((fn) => fn());
    };
  }, [sessionId, isActive]);

  const [hovered, setHovered] = useState(false);
  const [pendingOps, setPendingOps] = useState<Set<string>>(new Set());

  const showCloseBtn = paneCount > 1 && (isActive || hovered);

  // Vibrancy-aware background colors
  const bgPrimary = vibrancy
    ? hexToRgba(theme.ui.bgPrimary, vibrancyAlpha(windowOpacity))
    : theme.ui.bgPrimary;
  const bgSecondary = vibrancy
    ? hexToRgba(theme.ui.bgSecondary, vibrancyAlpha(windowOpacity))
    : theme.ui.bgSecondary;

  const sftpConnId = pane?.sftpConnectionId ?? "";
  const sftpConn = useSshStore.getState().connections.find((c) => c.id === sftpConnId);

  const handleTofuTrust = useCallback(async () => {
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
      updatePaneSession(paneId, sid);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      trustingRef.current = false;
      setTrusting(false);
      setConnecting(false);
    }
  }, [tofuPending, sftpConn, sftpConnId, paneId, updatePaneSession]);

  const handleTofuCancel = useCallback(async () => {
    if (tofuPending) {
      await sshClearPendingHostKey(tofuPending.host, tofuPending.port).catch(() => {});
    }
    setTofuPending(null);
    setError("Connection cancelled — host not trusted.");
  }, [tofuPending]);

  // Changed key, confirmed by the user: drop the old known_hosts entries and
  // reconnect. The reconnect fails with TOFU_REQUIRED, which shows the new key.
  const handleReplaceChangedKey = useCallback(async () => {
    if (!hostKeyChanged || !sftpConn) return;
    const { host, port } = hostKeyChanged;
    setHostKeyChanged(null);
    setError(null);
    setConnecting(true);
    try {
      for (const name of knownHostsNames(host, port)) await sshKnownHostsRemove(name);
      const sid = await useSftpStore.getState().connect(sftpConnId, sftpConn.name ?? "SFTP");
      sessionIdRef.current = sid;
      setSessionId(sid);
      updatePaneSession(paneId, sid);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const key = msg.includes("TOFU_REQUIRED") ? await sshGetPendingHostKey(host, port).catch(() => null) : null;
      if (key) setTofuPending(key);
      else setError(msg);
    } finally {
      setConnecting(false);
    }
  }, [hostKeyChanged, sftpConn, sftpConnId, paneId, updatePaneSession]);

  // -- Connecting / error state --
  if (connecting || error || tofuPending) {
    return (
      <div
        className="relative flex h-full w-full flex-col items-center justify-center"
        style={{ backgroundColor: bgPrimary }}
        onMouseDown={() => setActivePane(paneId)}
      >
        {error ? (
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <span className="text-xs text-error">Connection failed</span>
            <span className="text-[11px] text-text-muted">{error}</span>
          </div>
        ) : tofuPending ? (
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <span className="text-xs text-warning">Unknown host</span>
            <span className="text-[11px] text-text-muted">Verify the server fingerprint</span>
          </div>
        ) : (
          <>
            <div
              className="h-8 w-8 animate-spin rounded-full border-[2.5px]"
              style={{
                borderColor: theme.ui.accent + "25",
                borderTopColor: theme.ui.accent,
              }}
            />
            <div className="mt-4 flex flex-col items-center gap-1.5">
              <span
                className="text-xs tracking-wide"
                style={{ color: theme.ui.textSecondary }}
              >
                Connecting to {connectionName}...
              </span>
              <span
                className="text-[11px] tracking-wide"
                style={{ color: theme.ui.textMuted }}
              >
                Establishing SFTP session
              </span>
            </div>
          </>
        )}
        <HostKeyDialog
          prompt={
            tofuPending
              ? { kind: "unknown", key: tofuPending }
              : hostKeyChanged
                ? { kind: "changed", ...hostKeyChanged }
                : null
          }
          pending={trusting}
          onTrust={handleTofuTrust}
          onReplace={handleReplaceChangedKey}
          onCancel={tofuPending ? handleTofuCancel : () => setHostKeyChanged(null)}
        />
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ backgroundColor: bgPrimary }}
      onMouseDown={() => setActivePane(paneId)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Toolbar */}
      <div
        className="flex items-center border-b shrink-0"
        style={{
          backgroundColor: bgSecondary,
          borderColor: theme.ui.border,
        }}
      >
        {/* Scrollable action buttons */}
        <div className="flex items-center gap-1 px-2 py-1 overflow-x-auto min-w-0 flex-1">
          <ToolbarButton
            icon={<Upload size={13} />}
            label="Upload"
            onClick={handleUpload}
            disabled={localSelected.size === 0}
            theme={theme}
          />
          <ToolbarButton
            icon={<Download size={13} />}
            label="Download"
            onClick={handleDownload}
            disabled={remoteSelected.size === 0}
            theme={theme}
          />
          <div className="mx-0.5 h-4 w-px shrink-0" style={{ backgroundColor: theme.ui.border }} />
          <ToolbarButton
            icon={<FolderPlus size={13} />}
            label="New Folder"
            onClick={handleNewFolder}
            theme={theme}
          />
          <ToolbarButton
            icon={<Trash2 size={13} />}
            label="Delete"
            onClick={handleDelete}
            disabled={remoteSelected.size === 0}
            theme={theme}
          />
          <ToolbarButton
            icon={<Edit3 size={13} />}
            label="Rename"
            onClick={handleRename}
            disabled={remoteSelected.size !== 1}
            theme={theme}
          />
          <ToolbarButton
            icon={<RefreshCw size={13} />}
            label="Refresh"
            onClick={handleRefresh}
            theme={theme}
          />
        </div>
        {/* Always-visible right section: toggle + split controls */}
        <div className="shrink-0 flex items-center gap-0.5 px-1 py-1 border-l" style={{ borderColor: theme.ui.border }}>
          <ToolbarButton
            icon={localCollapsed ? <PanelLeft size={13} /> : <PanelLeftClose size={13} />}
            label={localCollapsed ? "Show Local" : "Hide Local"}
            onClick={toggleLocal}
            theme={theme}
          />
          {showCloseBtn && (
            <>
              <div className="mx-0.5 h-4 w-px" style={{ backgroundColor: theme.ui.border }} />
              <button
                onClick={(e) => { e.stopPropagation(); detachPaneToTab(paneId); }}
                className="flex h-5 w-5 items-center justify-center rounded opacity-50 transition-opacity hover:opacity-100"
                style={{ color: theme.ui.textMuted }}
                title="Detach to tab"
              >
                <ExternalLink size={10} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); closePaneInTab(paneId); }}
                className="flex h-5 w-5 items-center justify-center rounded opacity-50 transition-opacity hover:opacity-100"
                style={{ color: theme.ui.textMuted }}
                title="Close pane"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M1 1l8 8M9 1l-8 8" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Dual pane area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Local pane (collapsible) */}
        {!localCollapsed && (
          <>
            <div className="flex flex-col w-[45%] min-w-0 shrink-0">
              {/* Local path header */}
              <div
                className="flex items-center border-b shrink-0"
                style={{ borderColor: theme.ui.border }}
              >
                <button
                  onClick={() => navigateLocal(parentPath(localCwd))}
                  className="flex items-center justify-center px-1.5 py-1 text-text-muted hover:text-text-primary transition-colors"
                  title="Go up"
                >
                  <ArrowUp size={12} />
                </button>
                <PathBreadcrumb
                  path={localCwd}
                  onNavigate={navigateLocal}
                  label="Local"
                />
              </div>

              {/* Local file list */}
              <FileList
                entries={localEntries}
                selectedPaths={localSelected}
                onSelect={handleLocalSelect}
                onNavigate={navigateLocal}
                onContextMenu={(e, entry) =>
                  setCtxMenu({ x: e.clientX, y: e.clientY, entry, side: "local" })
                }
                onDragStart={handleDragStartLocal}
                onDragEnd={handleDragEnd}
                onDrop={handleDropOnLocal}
                emptyMessage="Empty directory"
              />
            </div>

            {/* Divider */}
            <div
              className="w-px shrink-0"
              style={{ backgroundColor: theme.ui.border }}
            />
          </>
        )}

        {/* Remote pane */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Remote path header */}
          <div
            className="flex items-center border-b shrink-0"
            style={{ borderColor: theme.ui.border }}
          >
            <button
              onClick={() => navigateRemote(parentPath(remoteCwd))}
              className="flex items-center justify-center px-1.5 py-1 text-text-muted hover:text-text-primary transition-colors"
              title="Go up"
            >
              <ArrowUp size={12} />
            </button>
            <PathBreadcrumb
              path={remoteCwd}
              onNavigate={navigateRemote}
              label="Remote"
              showBookmarks
            />
            {pendingOps.size > 0 && (
              <div className="shrink-0 px-1.5 py-0.5 flex items-center gap-1">
                <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Remote file list */}
          <FileList
            entries={remoteEntries}
            selectedPaths={remoteSelected}
            onSelect={handleRemoteSelect}
            onNavigate={navigateRemote}
            onContextMenu={(e, entry) =>
              setCtxMenu({ x: e.clientX, y: e.clientY, entry, side: "remote" })
            }
            onDragStart={handleDragStartRemote}
            onDragEnd={handleDragEnd}
            onDrop={handleDropOnRemote}
            emptyMessage="Empty directory"
          />
        </div>
      </div>

      {/* Transfer queue */}
      <TransferQueue
        transfers={transfers}
        onClearCompleted={clearCompleted}
      />

      {/* Context menu */}
      {ctxMenu && (
        <SftpContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          entry={ctxMenu.entry}
          side={ctxMenu.side}
          onAction={handleContextAction}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteInfo !== null}
        title={
          deleteInfo && deleteInfo.entries.length > 1
            ? `Delete ${deleteInfo.entries.length} items?`
            : `Delete "${deleteInfo?.entries[0]?.name ?? ""}"?`
        }
        message="This action cannot be undone. The selected items will be permanently removed from the remote server."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteInfo(null)}
      />

      {/* Rename input dialog */}
      <InputDialog
        open={renameInfo !== null}
        title="Rename"
        label="Enter a new name for this item."
        defaultValue={renameInfo?.entry.name ?? ""}
        placeholder="New name"
        confirmLabel="Rename"
        onConfirm={handleRenameConfirm}
        onCancel={() => setRenameInfo(null)}
      />

      {/* New folder input dialog */}
      <InputDialog
        open={newFolderOpen}
        title="New Folder"
        label="Enter a name for the new folder."
        placeholder="Folder name"
        confirmLabel="Create"
        onConfirm={handleNewFolderConfirm}
        onCancel={() => setNewFolderOpen(false)}
      />

      {/* File conflict dialog */}
      <FileConflictDialog
        open={conflictInfo !== null}
        fileName={conflictInfo?.fileName ?? ""}
        remoteNames={new Set(remoteEntries.map((e) => e.name))}
        remoteDir={remoteCwd}
        onReplace={handleConflictReplace}
        onRename={handleConflictRename}
        onSkip={handleConflictSkip}
      />

      {/* Desktop drag-drop overlay */}
      {desktopDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div
            className="absolute inset-0 rounded-lg"
            style={{
              backgroundColor: theme.ui.accent + "12",
              border: `2px dashed ${theme.ui.accent}`,
            }}
          />
          <div
            className="relative flex flex-col items-center gap-3 rounded-xl px-8 py-6"
            style={{ backgroundColor: theme.ui.bgSecondary + "e6" }}
          >
            <Upload size={28} style={{ color: theme.ui.accent }} />
            <div className="flex flex-col items-center gap-1">
              <span className="text-sm font-medium" style={{ color: theme.ui.textPrimary }}>
                Drop files to upload
              </span>
              <span className="text-xs" style={{ color: theme.ui.textMuted }}>
                Files will be uploaded to {remoteCwd}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -- Toolbar button sub-component --

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  theme: ReturnType<typeof useThemeStore.getState>["active"];
}

function ToolbarButton({ icon, label, onClick, disabled, theme }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`shrink-0 flex items-center gap-1 rounded px-1.5 py-1 text-[11px] transition-colors ${
        disabled
          ? "opacity-30 cursor-default"
          : "hover:bg-overlay/[0.06] cursor-pointer"
      }`}
      style={{ color: disabled ? theme.ui.textMuted : theme.ui.textSecondary }}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}
