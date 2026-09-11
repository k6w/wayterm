import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildConnectActions, type ConnectContext } from "./connect-actions";
import { openConfigHost, openQuickTarget, openSavedConnection } from "../ssh/open-connection";
import { Icons } from "../../ui/icons";
import { useToastStore } from "../../stores/toast";
import type { SshConnection } from "../../types/ssh";
import type { SshConfigHost } from "../../lib/ipc";

vi.mock("../ssh/open-connection", () => ({
  openSavedConnection: vi.fn(),
  openQuickTarget: vi.fn(async () => {}),
  openConfigHost: vi.fn(),
}));

function conn(name: string, host: string, extra: Partial<SshConnection> = {}): SshConnection {
  return {
    id: `id-${name}`,
    name,
    host,
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
    ...extra,
  };
}

function cfg(alias: string, extra: Partial<SshConfigHost> = {}): SshConfigHost {
  return {
    alias,
    hostname: `${alias}.corp.example`,
    user: "ops",
    port: 22,
    identityFiles: [],
    proxyJump: null,
    forwardAgent: false,
    localForwards: [],
    remoteForwards: [],
    dynamicForwards: [],
    alreadyImported: false,
    ...extra,
  };
}

const ctx = (extra: Partial<ConnectContext> = {}): ConnectContext => ({
  defaultUser: "me",
  connections: [],
  configHosts: [],
  ...extra,
});

beforeEach(() => {
  vi.mocked(openSavedConnection).mockClear();
  vi.mocked(openQuickTarget).mockClear();
  vi.mocked(openConfigHost).mockClear();
  useToastStore.setState({ toasts: [] });
});

describe("buildConnectActions", () => {
  it("offers nothing for an empty query", () => {
    expect(buildConnectActions("", ctx({ connections: [conn("prod", "p.io")] }))).toEqual([]);
  });

  it("puts a quick connect first for something that looks like a target", () => {
    const [first, second] = buildConnectActions("alice@example.com:2200", ctx());
    expect(first).toMatchObject({ label: "Connect to alice@example.com:2200", category: "Connect", icon: Icons.server });
    first.handler();
    expect(openQuickTarget).toHaveBeenCalledWith({ user: "alice", host: "example.com", port: 2200, userGiven: true }, false);
    expect(second).toMatchObject({ label: "Save and connect to alice@example.com:2200" });
    second.handler();
    expect(openQuickTarget).toHaveBeenLastCalledWith(expect.objectContaining({ host: "example.com" }), true);
  });

  it("uses the default user when none is typed", () => {
    const [first] = buildConnectActions("example.com:22", ctx({ defaultUser: "me" }));
    expect(first.label).toBe("Connect to me@example.com");
  });

  it("understands an ssh command line", () => {
    const [first] = buildConnectActions("ssh bob@example.com -p 2222", ctx());
    expect(first.label).toBe("Connect to bob@example.com:2222");
  });

  it("does not offer to save a target that is already saved", () => {
    const actions = buildConnectActions("deploy@p.io", ctx({ connections: [conn("prod", "p.io")] }));
    expect(actions.map((a) => a.label)).toEqual(["Connect to deploy@p.io", "prod"]);
  });

  it("reports a failed save as a toast", async () => {
    vi.mocked(openQuickTarget).mockRejectedValueOnce(new Error("disk full"));
    const [, save] = buildConnectActions("a@h.io", ctx());
    save.handler();
    await vi.waitFor(() => expect(useToastStore.getState().toasts[0]?.message).toContain("disk full"));
  });

  it("matches saved connections by name, host or user", () => {
    const connections = [conn("prod-db", "10.0.0.5"), conn("staging", "stage.example.com", { username: "qa" })];
    expect(buildConnectActions("prod", ctx({ connections })).map((a) => a.label)).toEqual(["prod-db"]);
    expect(buildConnectActions("stage.example", ctx({ connections })).map((a) => a.label)).toEqual(["staging"]);
    expect(buildConnectActions("QA", ctx({ connections })).map((a) => a.label)).toEqual(["staging"]);
    const [row] = buildConnectActions("prod", ctx({ connections }));
    expect(row).toMatchObject({ category: "Connections", icon: Icons.server, detail: "deploy@10.0.0.5" });
    row.handler();
    expect(openSavedConnection).toHaveBeenCalledWith(connections[0]);
  });

  it("matches ssh config aliases that are not saved yet", () => {
    const configHosts = [cfg("prod-web", { port: 2200 }), cfg("prod-old", { alreadyImported: true }), cfg("dev")];
    const actions = buildConnectActions("prod", ctx({ configHosts }));
    expect(actions.map((a) => a.label)).toEqual(["prod-web"]);
    expect(actions[0]).toMatchObject({ category: "SSH config", detail: "ops@prod-web.corp.example:2200" });
    actions[0].handler();
    expect(openConfigHost).toHaveBeenCalledWith(configHosts[0]);
  });

  it("orders quick connect, saved connections, then ssh config", () => {
    const actions = buildConnectActions(
      "prod@x.io",
      ctx({ connections: [conn("prod@x.io", "z.io")], configHosts: [cfg("prod@x.io")] })
    );
    expect(actions.map((a) => a.category)).toEqual(["Connect", "Connect", "Connections", "SSH config"]);
  });

  it("caps each kind of result", () => {
    const connections = Array.from({ length: 12 }, (_, i) => conn(`prod-${i}`, "h.io"));
    expect(buildConnectActions("prod", ctx({ connections }))).toHaveLength(5);
  });
});
