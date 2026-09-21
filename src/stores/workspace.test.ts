import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/ipc", () => ({
  workspaceList: vi.fn(async () => []),
  workspaceSave: vi.fn(async () => {}),
  workspaceDelete: vi.fn(async () => {}),
  bufferLoadBatch: vi.fn(async () => []),
  terminalKill: vi.fn(async () => {}),
  terminalCwd: vi.fn(async () => null),
}));

import { bufferLoadBatch, terminalCwd, terminalKill, workspaceDelete, workspaceList, workspaceSave } from "../lib/ipc";
import { useTerminalStore } from "./terminal";
import { useSshStore } from "./ssh";
import { useWorkspaceStore } from "./workspace";
import { buildSnapshot, parseWorkspaceLayout, setSnapshotStartupCommands, snapshotPanes, stripPaneIds } from "../lib/workspace-snapshot";
import { setCachedTerminal } from "../lib/terminal-registry";
import type { SplitNode, TerminalPane, TerminalTab } from "../types/terminal";
import type { WorkspaceMeta } from "../types/workspace";

const leaf = (paneId: string): SplitNode => ({ type: "pane", paneId });
const pane = (id: string, over: Partial<TerminalPane> = {}): TerminalPane => ({
  id,
  sessionId: `s-${id}`,
  isActive: false,
  cwd: "",
  shellType: "zsh",
  ...over,
});
const tab = (id: string, title: string, panes: SplitNode, isActive = false): TerminalTab => ({
  id,
  title,
  icon: "terminal",
  shellType: "zsh",
  panes,
  isActive,
});

function seedTerminal() {
  useTerminalStore.setState({
    tabs: [
      tab("t1", "Dev", { type: "split", direction: "horizontal", ratio: 0.7, children: [leaf("a"), { type: "split", direction: "vertical", ratio: 0.4, children: [leaf("b"), leaf("c")] }] }, true),
      tab("t2", "Ops", leaf("d")),
    ],
    panes: {
      a: pane("a", { cwd: "/repo", shellPath: "/bin/zsh" }),
      b: pane("b", { cwd: "/repo/api" }),
      c: pane("c", { shellType: "ssh", sshConnectionId: "c1" }),
      d: pane("d", { cwd: "/ops" }),
    },
    activeTabId: "t1",
    activePaneId: "b",
    paneFocusHistory: ["d", "b"],
    zoomedPaneId: null,
  });
}

function record(over: Partial<WorkspaceMeta> = {}): WorkspaceMeta {
  return { id: "w1", name: "Backend", icon: null, isDefault: false, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z", lastOpenedAt: null, ...over };
}

function saved(): { id: string; name: string; layout: string; createdAt: string; lastOpenedAt?: string | null } {
  const calls = vi.mocked(workspaceSave).mock.calls;
  return calls[calls.length - 1][0] as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  useTerminalStore.setState({ tabs: [], panes: {}, activeTabId: null, activePaneId: null, paneFocusHistory: [] });
  useSshStore.setState({ connections: [] });
  useWorkspaceStore.setState({ workspaces: [], loaded: false, pendingBuffers: {}, _buffersReadyPromise: null });
});

describe("save", () => {
  it("stores a versioned snapshot of the current tabs, splits, focus and pane cwd", async () => {
    seedTerminal();
    vi.mocked(terminalCwd).mockImplementation(async (sessionId) => (sessionId === "s-b" ? "/repo/api/v2" : null));
    const id = await useWorkspaceStore.getState().save("Backend");
    const row = saved();
    expect(row.id).toBe(id);
    expect(row.name).toBe("Backend");
    const snap = parseWorkspaceLayout(row.layout)!;
    expect(snap.version).toBe(2);
    expect(snap.tabs.map((t) => t.title)).toEqual(["Dev", "Ops"]);
    expect(snap.tabs[0].focusedPane).toBe(1);
    expect(snap.tabs[0].layout).toMatchObject({ type: "split", direction: "horizontal", ratio: 0.7 });
    // The pane's live cwd (PTY foreground process) wins over the stale stored one; ssh panes are not asked.
    expect(snapshotPanes(snap).map((p) => p.cwd)).toEqual(["/repo", "/repo/api/v2", null, "/ops"]);
    expect(terminalCwd).not.toHaveBeenCalledWith("s-c");
    expect(useWorkspaceStore.getState().workspaces.map((w) => w.name)).toEqual(["Backend"]);
  });

  it("keeps the stored cwd when the backend cannot tell", async () => {
    seedTerminal();
    vi.mocked(terminalCwd).mockRejectedValue(new Error("gone"));
    await useWorkspaceStore.getState().save("X");
    expect(snapshotPanes(parseWorkspaceLayout(saved().layout)!)[0].cwd).toBe("/repo");
  });

  it("does nothing when there are no tabs", async () => {
    expect(await useWorkspaceStore.getState().save("Empty")).toBeNull();
    expect(workspaceSave).not.toHaveBeenCalled();
  });
});

describe("update, rename, duplicate, startup commands", () => {
  async function withSaved() {
    seedTerminal();
    const snap = setSnapshotStartupCommands(buildSnapshot({ ...useTerminalStore.getState(), connections: [] }), [["npm run dev"], [], [], ["htop"]]);
    useWorkspaceStore.setState({ workspaces: [record({ layout: JSON.stringify(snap) })] });
  }

  it("update re-captures the layout but keeps the name, creation time and startup commands", async () => {
    await withSaved();
    useTerminalStore.getState().renameTab("t1", "Renamed");
    await useWorkspaceStore.getState().update("w1");
    const row = saved();
    expect(row).toMatchObject({ id: "w1", name: "Backend", createdAt: "2026-01-01T00:00:00.000Z" });
    const snap = parseWorkspaceLayout(row.layout)!;
    expect(snap.tabs[0].title).toBe("Renamed");
    expect(snapshotPanes(snap).map((p) => p.startupCommands)).toEqual([["npm run dev"], [], [], ["htop"]]);
  });

  it("rename saves under the new trimmed name and ignores a blank one", async () => {
    await withSaved();
    await useWorkspaceStore.getState().rename("w1", "  Platform  ");
    expect(saved().name).toBe("Platform");
    expect(useWorkspaceStore.getState().workspaces[0].name).toBe("Platform");
    vi.mocked(workspaceSave).mockClear();
    await useWorkspaceStore.getState().rename("w1", "   ");
    expect(workspaceSave).not.toHaveBeenCalled();
  });

  it("duplicate saves a copy with a new id, a copy name, the same layout and no shared scrollback ids", async () => {
    await withSaved();
    const id = await useWorkspaceStore.getState().duplicate("w1");
    const row = saved();
    expect(id).toBe(row.id);
    expect(row.id).not.toBe("w1");
    expect(row.name).toBe("Backend copy");
    const snap = parseWorkspaceLayout(row.layout)!;
    expect(snapshotPanes(snap).every((p) => p.id === null)).toBe(true);
    expect(snapshotPanes(snap).map((p) => p.startupCommands)).toEqual([["npm run dev"], [], [], ["htop"]]);
    expect(useWorkspaceStore.getState().workspaces).toHaveLength(2);
  });

  it("setStartupCommands rewrites only the commands", async () => {
    await withSaved();
    await useWorkspaceStore.getState().setStartupCommands("w1", [[], ["make", " "], [], []]);
    const snap = parseWorkspaceLayout(saved().layout)!;
    expect(snapshotPanes(snap).map((p) => p.startupCommands)).toEqual([[], ["make"], [], []]);
    expect(snap.tabs).toHaveLength(2);
  });

  it("remove deletes the record", async () => {
    await withSaved();
    await useWorkspaceStore.getState().remove("w1");
    expect(workspaceDelete).toHaveBeenCalledWith("w1");
    expect(useWorkspaceStore.getState().workspaces).toEqual([]);
  });
});

describe("restore", () => {
  async function workspaceFromCurrent(commands: string[][] = []) {
    seedTerminal();
    let snap = buildSnapshot({ ...useTerminalStore.getState(), connections: [] });
    if (commands.length) snap = setSnapshotStartupCommands(snap, commands);
    useWorkspaceStore.setState({ workspaces: [record({ layout: JSON.stringify(snap) })] });
    return snap;
  }

  it("replace rebuilds the same split tree with new ids, the saved focus and queued startup commands", async () => {
    await workspaceFromCurrent([["npm run dev"]]);
    const old = useTerminalStore.getState();
    const oldTabIds = old.tabs.map((t) => t.id);
    expect(useWorkspaceStore.getState().restore("w1")).toBe(true);
    const now = useTerminalStore.getState();
    expect(now.tabs.map((t) => t.id).some((id) => oldTabIds.includes(id))).toBe(false);
    expect(Object.keys(now.panes)).toHaveLength(4);
    const again = buildSnapshot({ ...now, connections: [] });
    const before = parseWorkspaceLayout(useWorkspaceStore.getState().workspaces[0].layout)!;
    expect(stripPaneIds(again)).toEqual(stripPaneIds(setSnapshotStartupCommands(before, [[], [], [], []])));
    const focused = now.panes[now.activePaneId!];
    expect(focused.cwd).toBe("/repo/api");
    const first = Object.values(now.panes).find((p) => p.cwd === "/repo")!;
    expect(first.startupCommands).toEqual(["npm run dev"]);
    expect(first.checkCwd).toBe(true);
    expect(now.paneFocusHistory[now.paneFocusHistory.length - 1]).toBe(now.activePaneId);
  });

  it("replace disposes the live terminals of the tabs it replaces", async () => {
    await workspaceFromCurrent();
    const dispose = vi.fn();
    const disposeBlocks = vi.fn();
    setCachedTerminal("a", { terminal: { dispose } as never, fitAddon: {} as never, element: {} as never, sessionId: "s-a", unlistenOutput: null, unlistenExit: null, webglAddon: null, blocks: { dispose: disposeBlocks } as never });
    useWorkspaceStore.getState().restore("w1");
    expect(dispose).toHaveBeenCalled();
    expect(disposeBlocks).toHaveBeenCalled();
    expect(terminalKill).toHaveBeenCalledWith("s-a");
  });

  it("add keeps the current tabs and focuses the restored active tab", async () => {
    await workspaceFromCurrent();
    useTerminalStore.setState({ tabs: [tab("keep", "Keep", leaf("k"), true)], panes: { k: pane("k") }, activeTabId: "keep", activePaneId: "k", paneFocusHistory: ["k"] });
    useWorkspaceStore.getState().restore("w1", "add");
    const now = useTerminalStore.getState();
    expect(now.tabs.map((t) => t.title)).toEqual(["Keep", "Dev", "Ops"]);
    expect(now.tabs.filter((t) => t.isActive).map((t) => t.title)).toEqual(["Dev"]);
    expect(now.panes.k).toBeDefined();
    expect(Object.keys(now.panes)).toHaveLength(5);
    expect(now.activeTabId).toBe(now.tabs[1].id);
    expect(terminalKill).not.toHaveBeenCalled();
  });

  it("records when the workspace was opened", async () => {
    await workspaceFromCurrent();
    useWorkspaceStore.getState().restore("w1");
    await vi.waitFor(() => expect(workspaceSave).toHaveBeenCalled());
    const row = saved();
    expect(row.id).toBe("w1");
    expect(row.lastOpenedAt).toBeTruthy();
    expect(row.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(useWorkspaceStore.getState().workspaces[0].lastOpenedAt).toBe(row.lastOpenedAt);
  });

  it("recreates the in-memory connection of a quick-connect SSH pane", () => {
    seedTerminal();
    useSshStore.setState({ connections: [] });
    const snap = buildSnapshot({
      ...useTerminalStore.getState(),
      connections: [{ id: "c1", name: "me@box:2222", host: "box", port: 2222, username: "me", transient: true } as never],
    });
    useWorkspaceStore.setState({ workspaces: [record({ layout: JSON.stringify(snap) })] });
    useWorkspaceStore.getState().restore("w1");
    const conn = useSshStore.getState().connections.find((c) => c.id === "c1");
    expect(conn).toMatchObject({ host: "box", port: 2222, username: "me", transient: true });
  });

  it("restores a legacy record written before snapshots were versioned", () => {
    const legacy = {
      tabs: [{ id: "t", title: "Old", icon: "terminal", shellType: "zsh", panes: { type: "split", direction: "horizontal", ratio: 0.3, children: [leaf("x"), leaf("y")] }, isActive: true }],
      panes: { x: pane("x", { cwd: "/old" }), y: pane("y") },
    };
    useWorkspaceStore.setState({ workspaces: [record({ layout: JSON.stringify(legacy) })] });
    expect(useWorkspaceStore.getState().restore("w1")).toBe(true);
    const now = useTerminalStore.getState();
    expect(now.tabs[0].title).toBe("Old");
    expect(now.tabs[0].panes).toMatchObject({ type: "split", ratio: 0.3 });
    expect(Object.keys(now.panes)).toHaveLength(2);
  });

  it("loads saved scrollback for panes whose snapshot kept an id", async () => {
    await workspaceFromCurrent();
    vi.mocked(bufferLoadBatch).mockResolvedValue([{ paneId: "a", bufferData: "hello" } as never]);
    useWorkspaceStore.getState().restore("w1");
    expect(bufferLoadBatch).toHaveBeenCalled();
    await useWorkspaceStore.getState()._buffersReadyPromise;
    const newId = Object.values(useTerminalStore.getState().panes).find((p) => p.cwd === "/repo")!.id;
    expect(useWorkspaceStore.getState().pendingBuffers[newId]).toBe("hello");
  });

  it("returns false and changes nothing for an unreadable record", () => {
    seedTerminal();
    useWorkspaceStore.setState({ workspaces: [record({ layout: "garbage" }), record({ id: "w2", layout: undefined })] });
    expect(useWorkspaceStore.getState().restore("w1")).toBe(false);
    expect(useWorkspaceStore.getState().restore("w2")).toBe(false);
    expect(useWorkspaceStore.getState().restore("missing")).toBe(false);
    expect(useTerminalStore.getState().tabs).toHaveLength(2);
  });
});

describe("session autosave and restore", () => {
  it("autoSave writes the same snapshot format, without startup commands", async () => {
    seedTerminal();
    await useWorkspaceStore.getState().autoSave();
    const row = saved();
    expect(row.id).toBe("__session__");
    const snap = parseWorkspaceLayout(row.layout)!;
    expect(snap.version).toBe(2);
    expect(snapshotPanes(snap).every((p) => p.startupCommands.length === 0)).toBe(true);
  });

  it("restoreSession restores both the new and the legacy session format", async () => {
    seedTerminal();
    await useWorkspaceStore.getState().autoSave();
    useTerminalStore.setState({ tabs: [], panes: {}, activeTabId: null, activePaneId: null });
    expect(useWorkspaceStore.getState().restoreSession()).toBe(true);
    expect(useTerminalStore.getState().tabs).toHaveLength(2);

    const legacy = { tabs: [tab("t", "L", leaf("x"), true)], panes: { x: pane("x") } };
    useWorkspaceStore.setState({ workspaces: [record({ id: "__session__", layout: JSON.stringify(legacy) })] });
    expect(useWorkspaceStore.getState().restoreSession()).toBe(true);
    expect(useTerminalStore.getState().tabs[0].title).toBe("L");
  });

  it("load keeps what the backend lists", async () => {
    vi.mocked(workspaceList).mockResolvedValue([record()] as never);
    await useWorkspaceStore.getState().load();
    expect(useWorkspaceStore.getState().workspaces).toHaveLength(1);
    expect(useWorkspaceStore.getState().loaded).toBe(true);
  });
});
