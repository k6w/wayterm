import { describe, expect, it } from "vitest";
import {
  confirmationCode,
  expectedOldKey,
  fingerprintParts,
  hostKeyErrorText,
  hostLabel,
  isHostKeyChanged,
  parseHostKeyMismatch,
} from "./host-key";
import type { HostKeyMismatch } from "../../lib/ipc";

const MISMATCH: HostKeyMismatch = {
  host: "example.com",
  port: 22,
  knownHostsPath: "/home/u/.ssh/known_hosts",
  oldKeys: [{ keyType: "ssh-ed25519", fingerprint: "SHA256:ANn8TSkGESlxtfcNBritd0+eASn7b4Qk2d2wkUd9m+8", lineNumber: 4 }],
  newKeyType: "ssh-ed25519",
  newFingerprint: "SHA256:LBuyLim8IdHpu2wb2n4XlpdeS449E1PMNZHGyxEusKo",
  newKeyB64: "AAAAC3NzaC1lZDI1NTE5AAAAICNbsieyVJqvXuKZPxUkHI3LEHkelfGm1+sUEaCQ9gax",
};

const TEXT = "HOST KEY CHANGED for example.com:22! This could indicate a man-in-the-middle attack. The connection was not made.";
const ERROR = `${TEXT}\nnexterm-host-key-mismatch:${JSON.stringify(MISMATCH)}`;

describe("isHostKeyChanged", () => {
  it("recognizes the backend's changed-key error and nothing else", () => {
    expect(isHostKeyChanged(ERROR)).toBe(true);
    expect(isHostKeyChanged("HOST KEY CHANGED for example.com:22! This could indicate ...")).toBe(true);
    expect(isHostKeyChanged("TOFU_REQUIRED:example.com:22")).toBe(false);
    expect(isHostKeyChanged("Connection refused")).toBe(false);
  });
});

describe("parseHostKeyMismatch", () => {
  it("reads the payload after the marker", () => {
    expect(parseHostKeyMismatch(ERROR)).toEqual(MISMATCH);
    expect(parseHostKeyMismatch(`Error: ${ERROR}`)).toEqual(MISMATCH);
  });

  it("returns null without a payload or with a malformed one", () => {
    expect(parseHostKeyMismatch(TEXT)).toBeNull();
    expect(parseHostKeyMismatch(`${TEXT}\nnexterm-host-key-mismatch:{not json`)).toBeNull();
    const partial: Partial<HostKeyMismatch> = { ...MISMATCH };
    delete partial.newKeyB64;
    expect(parseHostKeyMismatch(`${TEXT}\nnexterm-host-key-mismatch:${JSON.stringify(partial)}`)).toBeNull();
    expect(
      parseHostKeyMismatch(`${TEXT}\nnexterm-host-key-mismatch:${JSON.stringify({ ...MISMATCH, oldKeys: [] })}`)
    ).toBeNull();
  });
});

describe("hostKeyErrorText", () => {
  it("drops the payload and keeps the sentence", () => {
    expect(hostKeyErrorText(ERROR)).toBe(TEXT);
    expect(hostKeyErrorText("Connection refused")).toBe("Connection refused");
  });
});

describe("confirmationCode", () => {
  it("is the last 4 characters of the fingerprint, case preserved", () => {
    expect(confirmationCode("SHA256:LBuyLim8IdHpu2wb2n4XlpdeS449E1PMNZHGyxEusKo")).toBe("usKo");
  });
});

describe("expectedOldKey", () => {
  it("prefers the saved key of the new key's type", () => {
    const ecdsa = { keyType: "ecdsa-sha2-nistp256", fingerprint: "SHA256:ecdsa", lineNumber: 2 };
    expect(expectedOldKey({ ...MISMATCH, oldKeys: [ecdsa, ...MISMATCH.oldKeys] })).toEqual(MISMATCH.oldKeys[0]);
    expect(expectedOldKey({ ...MISMATCH, oldKeys: [ecdsa] })).toEqual(ecdsa);
  });
});

describe("hostLabel", () => {
  it("hides the default port", () => {
    expect(hostLabel("example.com", 22)).toBe("example.com");
    expect(hostLabel("example.com", 2222)).toBe("example.com:2222");
  });
});

describe("fingerprintParts", () => {
  it("splits the algorithm from the digest and groups the digest by 4", () => {
    expect(fingerprintParts("SHA256:abcdEFGH1234xy")).toEqual({
      algorithm: "SHA256",
      groups: ["abcd", "EFGH", "1234", "xy"],
    });
  });

  it("keeps a digest that has no algorithm prefix", () => {
    expect(fingerprintParts("AAAAB3Nz...xyz")).toEqual({ algorithm: null, groups: ["AAAA", "B3Nz", "...x", "yz"] });
  });

  it("returns no groups for an empty fingerprint", () => {
    expect(fingerprintParts("")).toEqual({ algorithm: null, groups: [] });
  });
});
