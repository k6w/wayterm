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
} from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { useTerminalStore } from "../../stores/terminal";
import { useSshStore } from "../../stores/ssh";
import { useSftpStore } from "../../stores/sftp";
import { useThemeStore } from "../../stores/theme";
import { useSettingsStore } from "../../stores/settings";
import { hexToRgba } from "../../lib/color";
import { vibrancyAlpha } from "../../lib/platform";
import PathBreadcrumb from "./PathBreadcrumb";
import FileList from "./FileList";
import TransferQueue from "./TransferQueue";
import SftpContextMenu from "./SftpContextMenu";
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
  const pane = useTerminalStore((s) => s.panes[paneId]);

  const sessionIdRef = useRef<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [connectionName, setConnectionName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [desktopDragOver, setDesktopDragOver] = useState(false);

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

  // Store selectors
  const session = useSftpStore((s) => (sessionId ? s.sessions[sessionId] : null));
  const remoteEntries = useSftpStore((s) => (sessionId ? s.remoteEntries[sessionId] ?? EMPTY_ENTRIES : EMPTY_ENTRIES));
  const localEntries = useSftpStore((s) => (sessionId ? s.localEntries[sessionId] ?? EMPTY_ENTRIES : EMPTY_ENTRIES));
  const transfers = useSftpStore((s) => s.transfers);
  const localCollapsed = useSftpStore((s) => (sessionId ? s.localCollapsed[sessionId] ?? true : true));

  const connect = useSftpStore((s) => s.connect);
  const disconnect = useSftpStore((s) => s.disconnect);
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

      try {
        const sid = await connect(sftpConnId, conn?.name ?? "SFTP");
        if (cancelled) {
          disconnect(sid).catch(() => {});
          return;
        }
        sessionIdRef.current = sid;
        setSessionId(sid);
        setConnecting(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setConnecting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (sessionIdRef.current) {
        disconnect(sessionIdRef.current).catch(() => {});
        sessionIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // -- Toolbar actions --

  const handleUpload = useCallback(() => {
    if (!sessionId) return;
    const selected = localEntries.filter((e) => localSelected.has(e.path) && !e.isDir);
    for (const entry of selected) {
      const targetPath = remoteCwd.replace(/\/+$/, "") + "/" + entry.name;
      uploadFile(sessionId, entry.path, targetPath);
    }
  }, [sessionId, localEntries, localSelected, remoteCwd, uploadFile]);

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
    const name = window.prompt("New folder name:");
    if (!name) return;
    const path = remoteCwd.replace(/\/+$/, "") + "/" + name;
    remoteMkdir(sessionId, path);
  }, [sessionId, remoteCwd, remoteMkdir]);

  const handleDelete = useCallback(() => {
    if (!sessionId) return;
    const selected = remoteEntries.filter((e) => remoteSelected.has(e.path));
    if (selected.length === 0) return;
    const confirmed = window.confirm(
      `Delete ${selected.length} item${selected.length > 1 ? "s" : ""}?`
    );
    if (!confirmed) return;
    for (const entry of selected) {
      remoteRemove(sessionId, entry.path, entry.isDir);
    }
    setRemoteSelected(new Set());
  }, [sessionId, remoteEntries, remoteSelected, remoteRemove]);

  const handleRename = useCallback(() => {
    if (!sessionId) return;
    const selected = remoteEntries.filter((e) => remoteSelected.has(e.path));
    if (selected.length !== 1) return;
    const entry = selected[0];
    const newName = window.prompt("Rename to:", entry.name);
    if (!newName || newName === entry.name) return;
    const dir = entry.path.substring(0, entry.path.lastIndexOf("/"));
    const newPath = dir + "/" + newName;
    remoteRename(sessionId, entry.path, newPath);
    setRemoteSelected(new Set());
  }, [sessionId, remoteEntries, remoteSelected, remoteRename]);

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
            uploadFile(sessionId, entry.path, target);
          }
          break;
        case "rename":
          if (entry) {
            const newName = window.prompt("Rename to:", entry.name);
            if (!newName || newName === entry.name) return;
            const dir = entry.path.substring(0, entry.path.lastIndexOf("/"));
            remoteRename(sessionId, entry.path, dir + "/" + newName);
          }
          break;
        case "delete":
          if (entry) {
            const ok = window.confirm(`Delete "${entry.name}"?`);
            if (ok) remoteRemove(sessionId, entry.path, entry.isDir);
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
      uploadFile,
      remoteRename,
      remoteRemove,
      handleNewFolder,
      handleRefresh,
    ]
  );

  // Drag start handler for cross-pane drag
  const handleDragStart = useCallback(
    (e: React.DragEvent, entries: SftpEntry[]) => {
      e.dataTransfer.setData(
        "application/sftp-entries",
        JSON.stringify(entries.map((en) => en.path))
      );
      e.dataTransfer.effectAllowed = "copy";
    },
    []
  );

  // Drop on remote pane → upload local files
  const handleDropOnRemote = useCallback(
    (e: React.DragEvent) => {
      if (!sessionId) return;
      const data = e.dataTransfer.getData("application/sftp-entries");
      if (data) {
        const paths: string[] = JSON.parse(data);
        for (const p of paths) {
          const name = p.split(/[/\\]/).pop() || p;
          const target = remoteCwd.replace(/\/+$/, "") + "/" + name;
          uploadFile(sessionId, p, target);
        }
      }
    },
    [sessionId, remoteCwd, uploadFile]
  );

  // Drop on local pane → download remote files
  const handleDropOnLocal = useCallback(
    (e: React.DragEvent) => {
      if (!sessionId) return;
      const data = e.dataTransfer.getData("application/sftp-entries");
      if (data) {
        const paths: string[] = JSON.parse(data);
        for (const p of paths) {
          const name = p.split("/").pop() || p;
          const sep = localCwd.includes("\\") ? "\\" : "/";
          const target = localCwd.replace(/[/\\]+$/, "") + sep + name;
          downloadFile(sessionId, p, target);
        }
      }
    },
    [sessionId, localCwd, downloadFile]
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
        const paths = event.payload.paths;
        if (!paths || paths.length === 0) return;
        for (const filePath of paths) {
          const name = filePath.split(/[/\\]/).pop() || filePath;
          const target = sess.remoteCwd.replace(/\/+$/, "") + "/" + name;
          store.upload(sid, filePath, target);
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

  const isSplit = paneCount > 1;
  const showFocus = isActive && paneCount > 1;

  // Vibrancy-aware background colors
  const bgPrimary = vibrancy
    ? hexToRgba(theme.ui.bgPrimary, vibrancyAlpha(windowOpacity))
    : theme.ui.bgPrimary;
  const bgSecondary = vibrancy
    ? hexToRgba(theme.ui.bgSecondary, vibrancyAlpha(windowOpacity))
    : theme.ui.bgSecondary;

  // -- Connecting / error state --
  if (connecting || error) {
    return (
      <div
        className={`relative flex h-full w-full flex-col items-center justify-center ${isSplit ? "rounded-lg" : ""}`}
        style={{
          backgroundColor: bgPrimary,
          border: showFocus
            ? `1.5px solid ${theme.ui.accent}`
            : isSplit
              ? `1.5px solid ${theme.ui.border || "transparent"}`
              : "1.5px solid transparent",
        }}
        onMouseDown={() => setActivePane(paneId)}
      >
        {error ? (
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <span className="text-xs text-red-400">Connection failed</span>
            <span className="text-[11px] text-text-muted">{error}</span>
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
      </div>
    );
  }

  return (
    <div
      className={`relative flex h-full w-full flex-col overflow-hidden ${isSplit ? "rounded-lg" : ""}`}
      style={{
        backgroundColor: bgPrimary,
        border: showFocus
          ? `1.5px solid ${theme.ui.accent}`
          : isSplit
            ? `1.5px solid ${theme.ui.border || "transparent"}`
            : "1.5px solid transparent",
        boxShadow: showFocus ? `0 0 12px ${theme.ui.accent}33` : "none",
      }}
      onMouseDown={() => setActivePane(paneId)}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-1 border-b px-2 py-1 shrink-0"
        style={{
          backgroundColor: bgSecondary,
          borderColor: theme.ui.border,
        }}
      >
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
        <div className="mx-0.5 h-4 w-px" style={{ backgroundColor: theme.ui.border }} />
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
        <span className="flex-1" />
        <ToolbarButton
          icon={localCollapsed ? <PanelLeft size={13} /> : <PanelLeftClose size={13} />}
          label={localCollapsed ? "Show Local" : "Hide Local"}
          onClick={toggleLocal}
          theme={theme}
        />
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
                onDragStart={handleDragStart}
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
            />
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
            onDragStart={handleDragStart}
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
      className={`flex items-center gap-1 rounded px-1.5 py-1 text-[11px] transition-colors ${
        disabled
          ? "opacity-30 cursor-default"
          : "hover:bg-white/[0.06] cursor-pointer"
      }`}
      style={{ color: disabled ? theme.ui.textMuted : theme.ui.textSecondary }}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}
