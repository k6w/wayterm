import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { useChangedHostKey } from "./useChangedHostKey";
import type { HostKeyMismatch } from "../../lib/ipc";

const MISMATCH: HostKeyMismatch = {
  host: "example.com",
  port: 2222,
  knownHostsPath: "/home/u/.ssh/known_hosts",
  oldKeys: [
    { keyType: "ecdsa-sha2-nistp256", fingerprint: "SHA256:ecdsaOld", lineNumber: 2 },
    { keyType: "ssh-ed25519", fingerprint: "SHA256:edOld", lineNumber: 5 },
  ],
  newKeyType: "ssh-ed25519",
  newFingerprint: "SHA256:LBuyLim8IdHpu2wb2n4XlpdeS449E1PMNZHGyxEusKo",
  newKeyB64: "AAAAC3NzaC1lZDI1NTE5AAAAICNbsieyVJqvXuKZPxUkHI3LEHkelfGm1+sUEaCQ9gax",
};

afterEach(() => {
  vi.mocked(invoke).mockImplementation(async () => null);
});

describe("useChangedHostKey", () => {
  it("replaces with the expected old fingerprint and resolves true", async () => {
    const { result } = renderHook(() => useChangedHostKey());
    let answer: Promise<boolean> = Promise.resolve(false);
    act(() => {
      answer = result.current.ask(MISMATCH);
    });
    expect(result.current.mismatch).toEqual(MISMATCH);
    await act(async () => {
      result.current.replace();
    });
    await expect(answer).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledWith("ssh_known_hosts_replace", {
      host: "example.com",
      port: 2222,
      expectedOldFingerprint: "SHA256:edOld",
      newKeyType: "ssh-ed25519",
      newKeyB64: MISMATCH.newKeyB64,
    });
    expect(result.current.mismatch).toBeNull();
  });

  it("keeps the prompt open with the error when the replacement fails", async () => {
    vi.mocked(invoke).mockRejectedValueOnce("The saved key no longer matches");
    const { result } = renderHook(() => useChangedHostKey());
    let settled = false;
    act(() => {
      void result.current.ask(MISMATCH).then(() => {
        settled = true;
      });
    });
    await act(async () => {
      result.current.replace();
    });
    await waitFor(() => expect(result.current.error).toBe("The saved key no longer matches"));
    expect(result.current.mismatch).toEqual(MISMATCH);
    expect(result.current.replacing).toBe(false);
    expect(settled).toBe(false);
  });

  it("resolves false on cancel without touching known_hosts", async () => {
    const { result } = renderHook(() => useChangedHostKey());
    let answer: Promise<boolean> = Promise.resolve(true);
    act(() => {
      answer = result.current.ask(MISMATCH);
    });
    act(() => result.current.cancel());
    await expect(answer).resolves.toBe(false);
    expect(result.current.mismatch).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("sends one request on a double replace", async () => {
    let release: () => void = () => {};
    vi.mocked(invoke).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(null);
        })
    );
    const { result } = renderHook(() => useChangedHostKey());
    act(() => {
      void result.current.ask(MISMATCH);
    });
    act(() => {
      result.current.replace();
      result.current.replace();
    });
    expect(result.current.replacing).toBe(true);
    // Cancel is ignored while the request runs.
    act(() => result.current.cancel());
    expect(result.current.mismatch).toEqual(MISMATCH);
    await act(async () => release());
    expect(vi.mocked(invoke).mock.calls.filter(([cmd]) => cmd === "ssh_known_hosts_replace")).toHaveLength(1);
  });
});
