import { describe, expect, it } from "vitest";
import { createFormState, parsePort, toConnection, validateConnectionForm } from "./connection-form";
import type { SshConnection } from "../../types/ssh";

const EXISTING: SshConnection = {
  id: "c1",
  name: "prod",
  host: "10.0.0.5",
  port: 2222,
  username: "deploy",
  authMethod: "key",
  privateKeyId: "k1",
  jumpHostId: "bastion",
  startupCommands: "cd /srv",
  colorTag: "red",
  folderPath: "/work",
  sortOrder: 3,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  themeOverride: "frost",
  agentForwarding: true,
  envVars: { LANG: "C" },
};

describe("createFormState", () => {
  it("starts a new connection on port 22 with password auth", () => {
    expect(createFormState()).toMatchObject({ port: "22", authMethod: "password", colorTag: null, envVars: {} });
  });

  it("copies an existing connection but never a secret", () => {
    expect(createFormState(EXISTING)).toMatchObject({
      name: "prod",
      port: "2222",
      selectedKeyId: "k1",
      jumpHostId: "bastion",
      agentForwarding: true,
      password: "",
      passphrase: "",
    });
  });
});

describe("parsePort", () => {
  it("accepts whole numbers from 1 to 65535", () => {
    expect(parsePort(" 22 ")).toBe(22);
    expect(parsePort("65535")).toBe(65535);
  });

  it("rejects anything else", () => {
    for (const value of ["", "0", "65536", "22.5", "-1", "abc", "2 2"]) {
      expect(parsePort(value), value).toBeNull();
    }
  });
});

describe("validateConnectionForm", () => {
  it("passes a complete form", () => {
    expect(validateConnectionForm(createFormState(EXISTING))).toEqual({});
  });

  it("names every missing or malformed field", () => {
    const form = { ...createFormState(), name: "  ", host: "my host", port: "70000", username: "" };
    expect(validateConnectionForm(form)).toEqual({
      name: "Enter a name for this connection.",
      host: "The host cannot contain spaces.",
      port: "Use a port from 1 to 65535.",
      username: "Enter the user to log in as.",
    });
    expect(validateConnectionForm({ ...form, host: "" }).host).toBe("Enter a host name or IP address.");
  });
});

describe("toConnection", () => {
  const NOW = "2026-10-08T12:00:00.000Z";

  it("trims fields and keeps the identity of an edited connection", () => {
    const form = { ...createFormState(EXISTING), name: " prod 2 ", host: " 10.0.0.6 ", startupCommands: "  " };
    expect(toConnection(form, EXISTING, NOW, () => "unused")).toEqual({
      ...EXISTING,
      name: "prod 2",
      host: "10.0.0.6",
      startupCommands: null,
      updatedAt: NOW,
    });
  });

  it("creates a new connection in the root folder", () => {
    const form = { ...createFormState(), name: "dev", host: "dev.local", username: "me" };
    expect(toConnection(form, null, NOW, () => "new-id")).toMatchObject({
      id: "new-id",
      port: 22,
      privateKeyId: null,
      folderPath: "/",
      sortOrder: 0,
      createdAt: NOW,
      updatedAt: NOW,
    });
  });
});
