import { useCallback, useEffect, useState, type DragEvent } from "react";
import { listen } from "@tauri-apps/api/event";
import { useSftpStore } from "../../stores/sftp";
import type { SftpEntry } from "../../types/sftp";
import { baseName, joinLocal, joinRemote, renamedPath } from "./sftp-paths";
import type { FileAction, SftpSide } from "./file-table";

const EMPTY_ENTRIES: SftpEntry[] = [];
const DRAG_TYPE = "application/sftp-entries";

export interface ConflictInfo {
  localPath: string;
  remotePath: string;
  fileName: string;
  sessionId: string;
}

/**
 * Everything the dual-pane browser does with one SFTP session: listings,
 * per-side selection, navigation, uploads and downloads (asking before
 * overwriting), new folder / rename / delete with their dialogs, drag and
 * drop between the sides and from the desktop.
 */
export function useSftpBrowser(sessionId: string | null, isActive: boolean) {
  const session = useSftpStore((s) => (sessionId ? s.sessions[sessionId] : null));
  const remoteEntries = useSftpStore((s) => (sessionId ? (s.remoteEntries[sessionId] ?? EMPTY_ENTRIES) : EMPTY_ENTRIES));
  const localEntries = useSftpStore((s) => (sessionId ? (s.localEntries[sessionId] ?? EMPTY_ENTRIES) : EMPTY_ENTRIES));
  const localCollapsed = useSftpStore((s) => (sessionId ? (s.localCollapsed[sessionId] ?? true) : true));
  const { loadRemoteDir, loadLocalDir, remoteMkdir, remoteRemove, remoteRename, download, upload, setLocalCollapsed } =
    useSftpStore.getState();

  const remoteCwd = session?.remoteCwd ?? "/";
  const localCwd = session?.localCwd ?? "";

  const [selected, setSelected] = useState<Record<SftpSide, Set<string>>>({ local: new Set(), remote: new Set() });
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [deleting, setDeleting] = useState<SftpEntry[] | null>(null);
  const [renaming, setRenaming] = useState<SftpEntry | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [pendingOps, setPendingOps] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<{ paths: string[]; source: SftpSide } | null>(null);
  const [desktopDragOver, setDesktopDragOver] = useState(false);

  const setSideSelection = useCallback((side: SftpSide, next: Set<string>) => {
    setSelected((prev) => ({ ...prev, [side]: next }));
  }, []);

  /** Runs a remote operation while its id is in `pendingOps` (the spinner in the remote path bar). */
  const track = async (ids: string[], op: () => Promise<void>) => {
    setPendingOps((prev) => new Set([...prev, ...ids]));
    try {
      await op();
    } finally {
      setPendingOps((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
    }
  };

  const navigate = (side: SftpSide, path: string) => {
    if (!sessionId) return;
    setSideSelection(side, new Set());
    if (side === "remote") void loadRemoteDir(sessionId, path);
    else void loadLocalDir(sessionId, path);
  };

  /** Uploads, or asks first when a file with that name is already in the remote folder. */
  const uploadWithCheck = (localPath: string, remotePath: string) => {
    if (!sessionId) return;
    const fileName = baseName(remotePath);
    if (remoteEntries.some((e) => e.name === fileName)) {
      setConflict({ localPath, remotePath, fileName, sessionId });
    } else {
      void upload(sessionId, localPath, remotePath);
    }
  };

  const uploadSelected = () => {
    for (const entry of localEntries) {
      if (selected.local.has(entry.path) && !entry.isDir) uploadWithCheck(entry.path, joinRemote(remoteCwd, entry.name));
    }
  };

  const downloadSelected = () => {
    if (!sessionId) return;
    for (const entry of remoteEntries) {
      if (selected.remote.has(entry.path) && !entry.isDir) void download(sessionId, entry.path, joinLocal(localCwd, entry.name));
    }
  };

  const requestDelete = () => {
    const entries = remoteEntries.filter((e) => selected.remote.has(e.path));
    if (entries.length > 0) setDeleting(entries);
  };

  const requestRename = () => {
    const entries = remoteEntries.filter((e) => selected.remote.has(e.path));
    if (entries.length === 1) setRenaming(entries[0]);
  };

  const refresh = () => {
    if (!sessionId) return;
    void loadRemoteDir(sessionId, remoteCwd);
    if (localCwd) void loadLocalDir(sessionId, localCwd);
  };

  const confirmNewFolder = async (name: string) => {
    if (!sessionId) return;
    const path = joinRemote(remoteCwd, name);
    await track([`mkdir:${path}`], () => remoteMkdir(sessionId, path));
    setCreatingFolder(false);
  };

  const confirmDelete = async () => {
    if (!sessionId || !deleting) return;
    const entries = deleting;
    await track(
      entries.map((e) => `delete:${e.path}`),
      async () => {
        for (const entry of entries) await remoteRemove(sessionId, entry.path, entry.isDir);
      }
    );
    setSideSelection("remote", new Set());
    setDeleting(null);
  };

  const confirmRename = async (newName: string) => {
    if (!sessionId || !renaming) return;
    const entry = renaming;
    if (newName !== entry.name) {
      await track([`rename:${entry.path}`], () => remoteRename(sessionId, entry.path, renamedPath(entry.path, newName)));
      setSideSelection("remote", new Set());
    }
    setRenaming(null);
  };

  const resolveConflict = (choice: "replace" | "skip" | { renameTo: string }) => {
    if (conflict && choice !== "skip") {
      const target = choice === "replace" ? conflict.remotePath : choice.renameTo;
      void upload(conflict.sessionId, conflict.localPath, target);
    }
    setConflict(null);
  };

  /** A context menu choice on `side` for `entry` (null: the empty area). */
  const runAction = (side: SftpSide, action: FileAction, entry: SftpEntry | null) => {
    if (!sessionId) return;
    switch (action) {
      case "open":
        if (entry?.isDir) navigate(side, entry.path);
        break;
      case "download":
        if (entry) void download(sessionId, entry.path, joinLocal(localCwd, entry.name));
        break;
      case "upload":
        if (entry) uploadWithCheck(entry.path, joinRemote(remoteCwd, entry.name));
        break;
      case "rename":
        if (entry) setRenaming(entry);
        break;
      case "delete":
        if (entry) setDeleting([entry]);
        break;
      case "copy_path":
        if (entry) void navigator.clipboard.writeText(entry.path);
        break;
      case "new_folder":
        setCreatingFolder(true);
        break;
      case "refresh":
        refresh();
        break;
    }
  };

  const dragStart = (side: SftpSide) => (event: DragEvent, entries: SftpEntry[]) => {
    const paths = entries.map((e) => e.path);
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(paths));
    event.dataTransfer.effectAllowed = "copy";
    setDragging({ paths, source: side });
  };

  const dragEnd = () => setDragging(null);

  /** Drop on `side`: local files upload to the remote folder, remote files download to the local one. */
  const drop = (side: SftpSide) => (event: DragEvent) => {
    if (!sessionId) return;
    const from: SftpSide = side === "remote" ? "local" : "remote";
    // Prefer React state: Tauri can swallow the HTML5 dataTransfer.
    let paths: string[] | null = dragging?.source === from ? dragging.paths : null;
    if (!paths) {
      const data = event.dataTransfer.getData(DRAG_TYPE);
      if (data) paths = JSON.parse(data) as string[];
    }
    for (const p of paths ?? []) {
      if (side === "remote") uploadWithCheck(p, joinRemote(remoteCwd, baseName(p)));
      else void download(sessionId, p, joinLocal(localCwd, baseName(p)));
    }
    setDragging(null);
  };

  // Files dragged in from the desktop upload to the remote folder.
  useEffect(() => {
    if (!sessionId || !isActive) return;
    const unlistenDrop = listen<{ paths: string[] }>("tauri://drag-drop", (event) => {
      setDesktopDragOver(false);
      const store = useSftpStore.getState();
      const sess = store.sessions[sessionId];
      const filePaths = event.payload.paths;
      if (!sess || !filePaths || filePaths.length === 0) return;
      const remoteNames = new Set((store.remoteEntries[sessionId] ?? []).map((e) => e.name));
      for (const filePath of filePaths) {
        const name = baseName(filePath);
        const target = joinRemote(sess.remoteCwd, name);
        if (remoteNames.has(name)) setConflict({ localPath: filePath, remotePath: target, fileName: name, sessionId });
        else void store.upload(sessionId, filePath, target);
      }
    });
    const unlistenOver = listen("tauri://drag-over", () => setDesktopDragOver(true));
    const unlistenLeave = listen("tauri://drag-leave", () => setDesktopDragOver(false));
    return () => {
      void unlistenDrop.then((fn) => fn());
      void unlistenOver.then((fn) => fn());
      void unlistenLeave.then((fn) => fn());
    };
  }, [sessionId, isActive]);

  return {
    remoteCwd,
    localCwd,
    remoteEntries,
    localEntries,
    localCollapsed,
    toggleLocal: () => {
      if (sessionId) setLocalCollapsed(sessionId, !localCollapsed);
    },
    selected,
    setSelection: setSideSelection,
    navigate,
    uploadSelected,
    downloadSelected,
    refresh,
    requestNewFolder: () => setCreatingFolder(true),
    requestDelete,
    requestRename,
    runAction,
    creatingFolder,
    cancelNewFolder: () => setCreatingFolder(false),
    confirmNewFolder,
    deleting,
    cancelDelete: () => setDeleting(null),
    confirmDelete,
    renaming,
    cancelRename: () => setRenaming(null),
    confirmRename,
    conflict,
    resolveConflict,
    busy: pendingOps.size > 0,
    dragStart,
    dragEnd,
    drop,
    desktopDragOver,
  };
}

export type SftpBrowser = ReturnType<typeof useSftpBrowser>;
