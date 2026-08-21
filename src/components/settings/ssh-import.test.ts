import { describe, expect, it } from "vitest";
import { connectionsFromConfig, type ImportedHost } from "./ssh-import";
import type { SshConnection } from "../../types/ssh";

const host = (name: string, extra: Partial<ImportedHost> = {}): ImportedHost => ({
  name,
  host: `${name}.example.com`,
  port: 22,
  username: "deploy",
  identityFile: null,
  jumpHost: null,
  ...extra,
});

let n = 0;
const newId = () => `id-${++n}`;

describe("connectionsFromConfig", () => {
  it("creates connections for the chosen hosts only", () => {
    n = 0;
    const result = connectionsFromConfig([host("a"), host("b", { identityFile: "~/.ssh/id" })], new Set([1]), [], "T", newId);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "id-1",
      name: "b",
      host: "b.example.com",
      authMethod: "key",
      folderPath: "",
      createdAt: "T",
      updatedAt: "T",
      envVars: {},
    });
  });

  it("uses password auth without an identity file", () => {
    expect(connectionsFromConfig([host("a")], new Set([0]), [], "T", newId)[0].authMethod).toBe("password");
  });

  it("skips hosts that are already saved or chosen twice", () => {
    const existing = [{ host: "a.example.com", username: "deploy", port: 22 } as SshConnection];
    const result = connectionsFromConfig(
      [host("a"), host("b"), host("b-again", { host: "b.example.com" })],
      new Set([0, 1, 2]),
      existing,
      "T",
      newId
    );
    expect(result.map((c) => c.name)).toEqual(["b"]);
  });
});
