import { describe, expect, it, vi } from "vitest";
import type { SplitNode, TerminalPane, TerminalTab } from "../types/terminal";
import type { SshConnection } from "../types/ssh";
import type { WorkspaceSnapshot } from "../types/workspace";
import {
  buildSnapshot,
  countSnapshot,
  describeStartupTargets,
  materializeSnapshot,
  mergeStartupCommands,
  parseWorkspaceLayout,
  resolveRestoredCwd,
  setSnapshotStartupCommands,
  snapshotPanes,
  stripPaneIds,
  type SnapshotSource,
} from "./workspace-snapshot";

const pane = (id: string, over: Partial<TerminalPane> = {}): TerminalPane => ({
  id,
  sessionId: `s-${id}`,
  isActive: false,
  cwd: "",
  shellType: "zsh",
  ...over,
});

const leaf = (paneId: string): SplitNode => ({ type: "pane", paneId });

const tab = (id: string, title: string, panes: SplitNode, over: Partial<TerminalTab> = {}): TerminalTab => ({
  id,
  title,
  icon: "terminal",
  shellType: "zsh",
  panes,
  isActive: false,
  ...over,
});

const conn = (id: string, over: Partial<SshConnection> = {}): SshConnection => ({
  id,
  name: id,
  host: `${id}.example.com`,
  port: 22,
  username: "root",
  authMethod: "key",
  privateKeyId: null,
  jumpHostId: null,
  startupCommands: null,
  colorTag: null,
  folderPath: "",
  sortOrder: 0,
  createdAt: "",
  updatedAt: "",
  envVars: {},
  ...over,
});

/** Three tabs: nested splits with a local, an SSH and a serial pane; an SFTP tab; a quick-connect SSH tab. */
function source(): SnapshotSource {
  const serialConfig = { portName: "/dev/ttyUSB0", baudRate: 115200, dataBits: 8, stopBits: 1, parity: "none", flowControl: "none" };
  return {
    tabs: [
      tab(
        "t1",
        "Dev",
        {
          type: "split",
          direction: "horizontal",
          ratio: 0.6,
          children: [
            leaf("a"),
            { type: "split", direction: "vertical", ratio: 0.3, children: [leaf("b"), leaf("c")] },
          ],
        },
        { colorTag: "blue" }
      ),
      tab("t2", "Files", leaf("d"), { shellType: "sftp" }),
      tab("t3", "scratch", leaf("e"), { shellType: "ssh" }),
    ],
    panes: {
      a: pane("a", { cwd: "/Users/me/repo", shellPath: "/bin/zsh" }),
      b: pane("b", { shellType: "ssh", sshConnectionId: "c1", cwd: "/srv/remote" }),
      c: pane("c", { shellType: "serial", serialConfig }),
      d: pane("d", { shellType: "sftp", sftpConnectionId: "c2" }),
      e: pane("e", { shellType: "ssh", sshConnectionId: "q1" }),
    },
    activeTabId: "t1",
    activePaneId: "c",
    paneFocusHistory: ["a", "e", "c"],
    connections: [conn("c1"), conn("c2"), conn("q1", { name: "me@box:2222", host: "box", port: 2222, username: "me", transient: true })],
  };
}

describe("buildSnapshot", () => {
  it("captures tabs, the nested split tree, panes of every type, focus and the active tab", () => {
    expect(buildSnapshot(source())).toEqual({
      version: 2,
      activeTab: 0,
      tabs: [
        {
          title: "Dev",
          colorTag: "blue",
          focusedPane: 2,
          layout: {
            type: "split",
            direction: "horizontal",
            ratio: 0.6,
            children: [
              {
                type: "pane",
                pane: {
                  id: "a",
                  kind: "local",
                  shellType: "zsh",
                  shellPath: "/bin/zsh",
                  cwd: "/Users/me/repo",
                  sshConnectionId: null,
                  sshQuick: null,
                  sftpConnectionId: null,
                  serialConfig: null,
                  startupCommands: [],
                },
              },
              {
                type: "split",
                direction: "vertical",
                ratio: 0.3,
                children: [
                  {
                    type: "pane",
                    pane: {
                      id: "b",
                      kind: "ssh",
                      shellType: "ssh",
                      shellPath: null,
                      cwd: null,
                      sshConnectionId: "c1",
                      sshQuick: null,
                      sftpConnectionId: null,
                      serialConfig: null,
                      startupCommands: [],
                    },
                  },
                  {
                    type: "pane",
                    pane: {
                      id: "c",
                      kind: "serial",
                      shellType: "serial",
                      shellPath: null,
                      cwd: null,
                      sshConnectionId: null,
                      sshQuick: null,
                      sftpConnectionId: null,
                      serialConfig: {
                        portName: "/dev/ttyUSB0",
                        baudRate: 115200,
                        dataBits: 8,
                        stopBits: 1,
                        parity: "none",
                        flowControl: "none",
                      },
                      startupCommands: [],
                    },
                  },
                ],
              },
            ],
          },
        },
        {
          title: "Files",
          colorTag: null,
          focusedPane: 0,
          layout: {
            type: "pane",
            pane: {
              id: "d",
              kind: "sftp",
              shellType: "sftp",
              shellPath: null,
              cwd: null,
              sshConnectionId: null,
              sshQuick: null,
              sftpConnectionId: "c2",
              serialConfig: null,
              startupCommands: [],
            },
          },
        },
        {
          title: "scratch",
          colorTag: null,
          focusedPane: 0,
          layout: {
            type: "pane",
            pane: {
              id: "e",
              kind: "ssh",
              shellType: "ssh",
              shellPath: null,
              cwd: null,
              sshConnectionId: "q1",
              sshQuick: { name: "me@box:2222", host: "box", port: 2222, username: "me" },
              sftpConnectionId: null,
              serialConfig: null,
              startupCommands: [],
            },
          },
        },
      ],
    });
  });

  it("remembers each background tab's last focused pane", () => {
    const src = source();
    src.activeTabId = "t3";
    src.activePaneId = "e";
    const snap = buildSnapshot(src);
    expect(snap.activeTab).toBe(2);
    expect(snap.tabs[0].focusedPane).toBe(2);
  });

  it("falls back to the first pane and the first tab when focus is unknown", () => {
    const src = source();
    src.activeTabId = null;
    src.activePaneId = null;
    src.paneFocusHistory = [];
    const snap = buildSnapshot(src);
    expect(snap.activeTab).toBe(0);
    expect(snap.tabs.map((t) => t.focusedPane)).toEqual([0, 0, 0]);
  });

  it("skips panes missing from the store and defaults a missing split ratio to one half", () => {
    const src = source();
    src.tabs = [tab("t1", "Odd", { type: "split", direction: "horizontal", children: [leaf("a"), leaf("ghost")] })];
    const snap = buildSnapshot(src);
    expect(countSnapshot(snap)).toEqual({ tabs: 1, panes: 1 });
    expect(snap.tabs[0].layout.type).toBe("pane");
  });

  it("carries startup commands over from the previous snapshot by position and kind", () => {
    const src = source();
    const previous = buildSnapshot(src);
    const withCommands = setSnapshotStartupCommands(previous, [["npm run dev", "git status"], [], ["htop"], [], ["uptime"]]);
    const merged = mergeStartupCommands(buildSnapshot(src), withCommands);
    expect(snapshotPanes(merged).map((p) => p.startupCommands)).toEqual([["npm run dev", "git status"], [], ["htop"], [], ["uptime"]]);
    // A pane that changed kind does not inherit the commands of the pane it replaced.
    const changed = source();
    changed.panes.a = pane("a", { shellType: "ssh", sshConnectionId: "c1" });
    expect(snapshotPanes(mergeStartupCommands(buildSnapshot(changed), withCommands))[0].startupCommands).toEqual([]);
  });
});

describe("parseWorkspaceLayout", () => {
  it("round-trips a current snapshot", () => {
    const snap = buildSnapshot(source());
    expect(parseWorkspaceLayout(JSON.stringify(snap))).toEqual(snap);
  });

  it("migrates the legacy { tabs, panes } dump", () => {
    const legacy = {
      tabs: [
        tab("t1", "Old", { type: "split", direction: "vertical", ratio: 0.4, children: [leaf("a"), leaf("b")] }, { isActive: false, colorTag: "red" }),
        tab("t2", "Remote", leaf("c"), { isActive: true, shellType: "ssh" }),
      ],
      panes: {
        a: pane("a", { cwd: "/work", shellPath: "/bin/bash", shellType: "bash", sessionId: "gone" }),
        b: pane("b", { shellType: "powershell" }),
        c: pane("c", { shellType: "ssh", sshConnectionId: "c1", cwd: "/remote/dir" }),
      },
    };
    const snap = parseWorkspaceLayout(JSON.stringify(legacy));
    expect(snap).toEqual({
      version: 2,
      activeTab: 1,
      tabs: [
        {
          title: "Old",
          colorTag: "red",
          focusedPane: 0,
          layout: {
            type: "split",
            direction: "vertical",
            ratio: 0.4,
            children: [
              {
                type: "pane",
                pane: {
                  id: "a",
                  kind: "local",
                  shellType: "bash",
                  shellPath: "/bin/bash",
                  cwd: "/work",
                  sshConnectionId: null,
                  sshQuick: null,
                  sftpConnectionId: null,
                  serialConfig: null,
                  startupCommands: [],
                },
              },
              {
                type: "pane",
                pane: {
                  id: "b",
                  kind: "local",
                  shellType: "powershell",
                  shellPath: null,
                  cwd: null,
                  sshConnectionId: null,
                  sshQuick: null,
                  sftpConnectionId: null,
                  serialConfig: null,
                  startupCommands: [],
                },
              },
            ],
          },
        },
        {
          title: "Remote",
          colorTag: null,
          focusedPane: 0,
          layout: {
            type: "pane",
            pane: {
              id: "c",
              kind: "ssh",
              shellType: "ssh",
              shellPath: null,
              cwd: null,
              sshConnectionId: "c1",
              sshQuick: null,
              sftpConnectionId: null,
              serialConfig: null,
              startupCommands: [],
            },
          },
        },
      ],
    });
  });

  it("returns null for unreadable, empty or newer-than-known records instead of throwing", () => {
    expect(parseWorkspaceLayout("")).toBeNull();
    expect(parseWorkspaceLayout("not json")).toBeNull();
    expect(parseWorkspaceLayout("{}")).toBeNull();
    expect(parseWorkspaceLayout(JSON.stringify({ tabs: [], panes: {} }))).toBeNull();
    expect(parseWorkspaceLayout(JSON.stringify({ version: 3, activeTab: 0, tabs: [] }))).toBeNull();
  });

  it("repairs a damaged current snapshot: bad fields are defaulted and the active tab clamped", () => {
    const raw = {
      version: 2,
      activeTab: 9,
      tabs: [
        {
          title: 5,
          layout: { type: "pane", pane: { kind: "local", shellType: "zsh", startupCommands: ["ok", 3, ""] } },
        },
        { title: "no layout" },
      ],
    };
    const snap = parseWorkspaceLayout(JSON.stringify(raw))!;
    expect(snap.tabs).toHaveLength(1);
    expect(snap.activeTab).toBe(0);
    expect(snap.tabs[0].title).toBe("Terminal");
    expect(snapshotPanes(snap)[0]).toMatchObject({ cwd: null, shellPath: null, startupCommands: ["ok"] });
  });
});

describe("materializeSnapshot", () => {
  it("rebuilds an identical split tree with fresh ids and the saved focus", () => {
    const snap = stripPaneIds(buildSnapshot(source()));
    const { tabs, panes, activeTabId, activePaneId } = materializeSnapshot(snap);
    expect(tabs.map((t) => t.title)).toEqual(["Dev", "Files", "scratch"]);
    expect(tabs[0].colorTag).toBe("blue");
    expect(tabs.map((t) => t.isActive)).toEqual([true, false, false]);
    expect(activeTabId).toBe(tabs[0].id);
    // Rebuilding the snapshot from the restored state gives the same document.
    const again = buildSnapshot({
      tabs,
      panes,
      activeTabId,
      activePaneId,
      paneFocusHistory: [],
      connections: [conn("c1"), conn("c2"), conn("q1", { name: "me@box:2222", host: "box", port: 2222, username: "me", transient: true })],
    });
    expect(stripPaneIds(again)).toEqual(snap);
    const ids = Object.keys(panes);
    expect(new Set(ids).size).toBe(5);
    expect(ids).not.toContain("a");
    expect(activePaneId).toBe(Object.values(panes).find((p) => p.shellType === "serial")!.id);
  });

  it("marks local panes that had a cwd for an existence check and queues startup commands", () => {
    const snap = setSnapshotStartupCommands(buildSnapshot(source()), [["npm i"], [], [], [], ["uptime"]]);
    const { panes, idMap } = materializeSnapshot(snap);
    const byOldId = (old: string) => panes[idMap.get(old)!];
    expect(byOldId("a")).toMatchObject({ cwd: "/Users/me/repo", checkCwd: true, startupCommands: ["npm i"] });
    expect(byOldId("b").checkCwd).toBeUndefined();
    expect(byOldId("b").startupCommands).toBeUndefined();
    expect(byOldId("e").startupCommands).toEqual(["uptime"]);
  });

  it("keeps the profile a local shell was started from, through save, parse and restore", () => {
    const src = source();
    const a = Object.keys(src.panes)[0];
    src.panes[a] = { ...src.panes[a], profileId: "prof-1" };
    const snap = parseWorkspaceLayout(JSON.stringify(buildSnapshot(src)))!;
    const { panes, idMap } = materializeSnapshot(snap);
    expect(panes[idMap.get(a)!].profileId).toBe("prof-1");
    expect(Object.values(panes).filter((p) => p.profileId)).toHaveLength(1);
  });

  it("keeps the ids-to-buffers map empty for panes without a saved id", () => {
    expect(materializeSnapshot(stripPaneIds(buildSnapshot(source()))).idMap.size).toBe(0);
  });
});

describe("snapshot helpers", () => {
  it("counts tabs and panes and lists panes in tree order", () => {
    const snap: WorkspaceSnapshot = buildSnapshot(source());
    expect(countSnapshot(snap)).toEqual({ tabs: 3, panes: 5 });
    expect(snapshotPanes(snap).map((p) => p.kind)).toEqual(["local", "ssh", "serial", "sftp", "ssh"]);
  });

  it("setSnapshotStartupCommands trims lines, drops blanks and leaves the input untouched", () => {
    const snap = buildSnapshot(source());
    const next = setSnapshotStartupCommands(snap, [["  make  ", "", "  "]]);
    expect(snapshotPanes(next)[0].startupCommands).toEqual(["make"]);
    expect(snapshotPanes(next)[1].startupCommands).toEqual([]);
    expect(snapshotPanes(snap)[0].startupCommands).toEqual([]);
  });
});

describe("resolveRestoredCwd", () => {
  it("keeps a saved folder that still exists", async () => {
    const dirExists = vi.fn(async () => true);
    expect(await resolveRestoredCwd("/Users/me/repo", { dirExists, home: async () => "/Users/me" })).toEqual({ cwd: "/Users/me/repo" });
    expect(dirExists).toHaveBeenCalledWith("/Users/me/repo");
  });

  it("falls back to home with a notice when the folder is gone", async () => {
    const result = await resolveRestoredCwd("/Users/me/deleted", { dirExists: async () => false, home: async () => "/Users/me" });
    expect(result).toEqual({ cwd: "/Users/me", notice: "/Users/me/deleted no longer exists. Started in your home folder." });
  });

  it("falls back to the shell default when home is unknown, and when the check itself fails", async () => {
    expect(await resolveRestoredCwd("/gone", { dirExists: async () => false, home: async () => { throw new Error("x"); } })).toMatchObject({ cwd: "" });
    expect(await resolveRestoredCwd("/gone", { dirExists: async () => { throw new Error("x"); }, home: async () => "/h" })).toMatchObject({ cwd: "/h" });
  });
});

describe("describeStartupTargets", () => {
  it("lists the panes that can run startup commands, grouped by tab, with their global index", () => {
    const snap = setSnapshotStartupCommands(buildSnapshot(source()), [["make"], [], [], [], ["uptime"]]);
    const targets = describeStartupTargets(snap);
    expect(targets).toEqual([
      { index: 0, tabIndex: 0, tab: "Dev", number: 1, description: "zsh in /Users/me/repo", commands: ["make"] },
      { index: 1, tabIndex: 0, tab: "Dev", number: 2, description: "SSH", commands: [] },
      { index: 4, tabIndex: 2, tab: "scratch", number: 1, description: "SSH me@box:2222", commands: ["uptime"] },
    ]);
  });
});
