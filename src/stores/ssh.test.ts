import { beforeEach, describe, expect, it, vi } from "vitest";
import { savedConnections, useSshStore } from "./ssh";
import { sshListConnections } from "../lib/ipc";
import type { SshConnection } from "../types/ssh";

vi.mock("../lib/ipc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/ipc")>()),
  sshListConnections: vi.fn(async () => []),
  sshListKeys: vi.fn(async () => []),
}));

const conn = (id: string, extra: Partial<SshConnection> = {}): SshConnection => ({
  id,
  name: id,
  host: `${id}.example.com`,
  port: 22,
  username: "me",
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
});

beforeEach(() => {
  useSshStore.setState({ connections: [] });
});

describe("transient connections", () => {
  it("are kept in the store but are not saved connections", () => {
    useSshStore.getState().addTransientConnection(conn("adhoc"));
    useSshStore.setState((s) => ({ connections: [...s.connections, conn("real")] }));
    expect(useSshStore.getState().connections.map((c) => c.id)).toEqual(["adhoc", "real"]);
    expect(savedConnections(useSshStore.getState().connections).map((c) => c.id)).toEqual(["real"]);
    expect(useSshStore.getState().connections[0].transient).toBe(true);
  });

  it("survive a reload of the saved connections so open tabs still resolve them", async () => {
    useSshStore.getState().addTransientConnection(conn("adhoc"));
    vi.mocked(sshListConnections).mockResolvedValueOnce([conn("real")]);
    await useSshStore.getState().load();
    expect(useSshStore.getState().connections.map((c) => c.id)).toEqual(["real", "adhoc"]);
  });
});
