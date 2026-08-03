import { describe, expect, it } from "vitest";
import { fingerprintParts, hostLabel, isHostKeyChanged, knownHostsNames, removalSummary } from "./host-key";

describe("isHostKeyChanged", () => {
  it("recognizes the backend's changed-key error and nothing else", () => {
    expect(isHostKeyChanged("HOST KEY CHANGED for example.com:22! This could indicate ...")).toBe(true);
    expect(isHostKeyChanged("TOFU_REQUIRED:example.com:22")).toBe(false);
    expect(isHostKeyChanged("Connection refused")).toBe(false);
  });
});

describe("hostLabel", () => {
  it("hides the default port", () => {
    expect(hostLabel("example.com", 22)).toBe("example.com");
    expect(hostLabel("example.com", 2222)).toBe("example.com:2222");
  });
});

describe("knownHostsNames", () => {
  it("covers every name the backend matches a host by", () => {
    expect(knownHostsNames("example.com", 22)).toEqual(["example.com", "[example.com]:22"]);
    expect(knownHostsNames("10.0.0.5", 2222)).toEqual(["[10.0.0.5]:2222", "10.0.0.5"]);
  });
});

describe("removalSummary", () => {
  it("on port 22 names the plain and [host]:22 entries and says other ports are kept", () => {
    const text = removalSummary("example.com", 22);
    expect(text).toContain("example.com");
    expect(text).toContain("[example.com]:22");
    expect(text).toMatch(/other ports.*kept/i);
    expect(text).not.toMatch(/every saved key/i);
  });

  it("on another port names [host]:port and the plain host entry", () => {
    const text = removalSummary("example.com", 2222);
    expect(text).toContain("[example.com]:2222");
    expect(text).toMatch(/plain example\.com entry/);
    expect(text).toMatch(/other ports.*kept/i);
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
