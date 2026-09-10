import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSshStore } from "../../stores/ssh";
import { getFirstPaneId, useTerminalStore } from "../../stores/terminal";
import { sshSaveConnection } from "../../lib/ipc";
import { openConfigHost, openQuickTarget, openSavedConnection } from "./open-connection";
import type { SshConnection } from "../../types/ssh";
import type { SshConfigHost } from "../../lib/ipc";

vi.mock("../../lib/ipc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/ipc")>()),
  sshSaveConnection: vi.fn(async () => {}),
}));

const SAVED: SshConnection = {
  id: "c1",
  name: "prod",
  host: "10.0.0.5",
  port: 22,
  username: "deploy",
  authMethod: "password",
  privateKeyId: null,
  jumpHostId: null,
  startupCommands: null,
  colorTag: null,
  folderPath: "",
  sortOrder: 0,
  createdAt: "",
  updatedAt: "",
  envVars: {},
};

const lastTab = () => {
  const { tabs, panes } = useTerminalStore.getState();
  const tab = tabs[tabs.length - 1];
  return { tab, pane: panes[getFirstPaneId(tab.panes) ?? ""] };
};

beforeEach(() => {
  vi.mocked(sshSaveConnection).mockClear();
  useSshStore.setState({ connections: [SAVED] });
  useTerminalStore.setState(useTerminalStore.getInitialState(), true);
});

describe("openSavedConnection", () => {
  it("opens an SSH tab named after the connection", () => {
    openSavedConnection(SAVED);
    const { tab, pane } = lastTab();
    expect(pane.sshConnectionId).toBe("c1");
    expect(tab.title).toBe("prod");
  });
});

describe("openQuickTarget", () => {
  const target = { user: "alice", host: "example.com", port: 2200, userGiven: true };

  it("opens a tab on a transient connection that is never persisted", async () => {
    await openQuickTarget(target, false);
    const { tab, pane } = lastTab();
    const conn = useSshStore.getState().connections.find((c) => c.id === pane.sshConnectionId);
    expect(conn).toMatchObject({ host: "example.com", port: 2200, username: "alice", transient: true, authMethod: "password" });
    expect(tab.title).toBe("alice@example.com:2200");
    expect(sshSaveConnection).not.toHaveBeenCalled();
  });

  it("saves the connection first when asked to save and connect", async () => {
    await openQuickTarget(target, true);
    expect(sshSaveConnection).toHaveBeenCalledTimes(1);
    const { pane } = lastTab();
    const conn = useSshStore.getState().connections.find((c) => c.id === pane.sshConnectionId);
    expect(conn?.transient).toBeFalsy();
    expect(conn).toMatchObject({ host: "example.com", username: "alice", name: "alice@example.com:2200" });
  });

  it("does not open a tab when saving fails", async () => {
    vi.mocked(sshSaveConnection).mockRejectedValueOnce(new Error("disk full"));
    await expect(openQuickTarget(target, true)).rejects.toThrow("disk full");
    expect(useTerminalStore.getState().tabs).toHaveLength(0);
  });
});

describe("openConfigHost", () => {
  const host: SshConfigHost = {
    alias: "prod-web",
    hostname: "web.example.com",
    user: "deploy",
    port: 2200,
    identityFiles: [],
    proxyJump: "bastion",
    forwardAgent: false,
    localForwards: [],
    remoteForwards: [],
    dynamicForwards: [],
    alreadyImported: false,
  };

  it("connects through the alias so ssh applies the rest of the config itself", () => {
    openConfigHost(host);
    const { tab, pane } = lastTab();
    const conn = useSshStore.getState().connections.find((c) => c.id === pane.sshConnectionId);
    expect(conn).toMatchObject({ host: "prod-web", username: "deploy", port: 22, transient: true });
    expect(tab.title).toBe("prod-web");
  });
});
