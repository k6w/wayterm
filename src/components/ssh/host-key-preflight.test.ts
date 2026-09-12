import { afterEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { preflightHostKey } from "./host-key-preflight";
import type { HostKeyMismatch } from "../../lib/ipc";

const MISMATCH: HostKeyMismatch = {
  host: "example.com",
  port: 2222,
  knownHostsPath: "/home/u/.ssh/known_hosts",
  oldKeys: [{ keyType: "ssh-ed25519", fingerprint: "SHA256:old", lineNumber: 1 }],
  newKeyType: "ssh-ed25519",
  newFingerprint: "SHA256:new",
  newKeyB64: "AAAA",
};
const CHANGED = `HOST KEY CHANGED for example.com:2222! ...\nnexterm-host-key-mismatch:${JSON.stringify(MISMATCH)}`;

const conn = { host: "example.com", port: 2222, jumpHostId: null };

afterEach(() => {
  vi.mocked(invoke).mockImplementation(async () => null);
});

describe("preflightHostKey", () => {
  it("goes ahead for a trusted, unknown or skipped host without asking", async () => {
    const ask = vi.fn();
    vi.mocked(invoke).mockResolvedValueOnce("trusted");
    await expect(preflightHostKey(conn, ask)).resolves.toBe(true);
    vi.mocked(invoke).mockResolvedValueOnce("unknown");
    await expect(preflightHostKey(conn, ask)).resolves.toBe(true);
    vi.mocked(invoke).mockResolvedValueOnce("skipped");
    await expect(preflightHostKey(conn, ask)).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledWith("ssh_check_host_key", { host: "example.com", port: 2222 });
    expect(ask).not.toHaveBeenCalled();
  });

  it("leaves other failures to ssh itself", async () => {
    const ask = vi.fn();
    vi.mocked(invoke).mockRejectedValueOnce("SSH connect failed: Connection refused");
    await expect(preflightHostKey(conn, ask)).resolves.toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });

  it("asks about a changed key and follows the answer", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(CHANGED);
    const ask = vi.fn(async () => false);
    await expect(preflightHostKey(conn, ask)).resolves.toBe(false);
    expect(ask).toHaveBeenCalledWith(MISMATCH);

    vi.mocked(invoke).mockRejectedValueOnce(new Error(CHANGED));
    await expect(preflightHostKey(conn, async () => true)).resolves.toBe(true);
  });

  it("skips the check behind a jump host (the target is not reachable directly)", async () => {
    const ask = vi.fn();
    await expect(preflightHostKey({ ...conn, jumpHostId: "j1" }, ask)).resolves.toBe(true);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("passes a port only when ssh gets -p, so ~/.ssh/config can set it otherwise", async () => {
    vi.mocked(invoke).mockResolvedValue("trusted");
    await preflightHostKey({ host: "example.com", port: undefined, jumpHostId: null }, vi.fn());
    expect(invoke).toHaveBeenLastCalledWith("ssh_check_host_key", { host: "example.com", port: null });
    await preflightHostKey({ host: "example.com", port: 22, jumpHostId: null }, vi.fn());
    expect(invoke).toHaveBeenLastCalledWith("ssh_check_host_key", { host: "example.com", port: null });
  });
});
