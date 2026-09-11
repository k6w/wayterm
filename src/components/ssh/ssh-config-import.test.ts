import { describe, expect, it } from "vitest";
import type { SshConfigHost, SshConfigImportResult } from "../../lib/ipc";
import { hostEndpoint, identityLabel, importSummary, initialSelection } from "./ssh-config-import";

function host(alias: string, extra: Partial<SshConfigHost> = {}): SshConfigHost {
  return {
    alias,
    hostname: `${alias}.example.com`,
    user: "me",
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

const result = (r: Partial<SshConfigImportResult>): SshConfigImportResult => ({ imported: [], skipped: [], warnings: [], ...r });

describe("initialSelection", () => {
  it("selects every host that is not saved yet", () => {
    const sel = initialSelection([host("a"), host("b", { alreadyImported: true }), host("c")]);
    expect([...sel]).toEqual(["a", "c"]);
  });
});

describe("hostEndpoint", () => {
  it("is user@host:port, always with the port", () => {
    expect(hostEndpoint(host("web", { user: "deploy", port: 2200 }))).toBe("deploy@web.example.com:2200");
    expect(hostEndpoint(host("web"))).toBe("me@web.example.com:22");
  });

  it("brackets an IPv6 address", () => {
    expect(hostEndpoint(host("v6", { hostname: "::1" }))).toBe("me@[::1]:22");
  });
});

describe("identityLabel", () => {
  it("is the file name of the first key, or null without one", () => {
    expect(identityLabel(host("a"))).toBeNull();
    expect(identityLabel(host("a", { identityFiles: ["/home/me/.ssh/id_ed25519", "/x/other"] }))).toBe("id_ed25519");
    expect(identityLabel(host("a", { identityFiles: ["C:\\Users\\me\\.ssh\\id_rsa"] }))).toBe("id_rsa");
  });
});

describe("importSummary", () => {
  it("counts imported connections", () => {
    expect(importSummary(result({ imported: [{ alias: "a", connectionId: "1" }] }))).toEqual({
      message: "Imported 1 connection",
      variant: "success",
    });
  });

  it("mentions skipped hosts and warnings", () => {
    const summary = importSummary(
      result({
        imported: [
          { alias: "a", connectionId: "1" },
          { alias: "b", connectionId: "2" },
        ],
        skipped: [{ alias: "c", reason: "Already imported" }],
        warnings: ["x", "y"],
      })
    );
    expect(summary.message).toBe("Imported 2 connections, skipped 1, 2 warnings");
    expect(summary.variant).toBe("success");
  });

  it("is informational when nothing was imported", () => {
    expect(importSummary(result({ skipped: [{ alias: "c", reason: "Already imported" }] }))).toEqual({
      message: "Nothing imported, skipped 1",
      variant: "info",
    });
  });
});
