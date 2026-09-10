import { describe, expect, it } from "vitest";
import { parseQuickConnect, quickConnectLabel } from "./quick-connect";

const opts = { defaultUser: "me" };
const parse = (input: string) => parseQuickConnect(input, opts);

describe("parseQuickConnect", () => {
  it("reads user@host", () => {
    expect(parse("alice@example.com")).toEqual({ user: "alice", host: "example.com", port: 22, userGiven: true });
  });

  it("reads host:port with the default user", () => {
    expect(parse("example.com:2200")).toEqual({ user: "me", host: "example.com", port: 2200, userGiven: false });
  });

  it("reads user@host:port", () => {
    expect(parse("bob@10.0.0.5:2222")).toEqual({ user: "bob", host: "10.0.0.5", port: 2222, userGiven: true });
  });

  it("reads bracketed IPv6, with and without a port, and stores the host unbracketed", () => {
    expect(parse("root@[2001:db8::1]")).toEqual({ user: "root", host: "2001:db8::1", port: 22, userGiven: true });
    expect(parse("root@[2001:db8::1]:2022")).toEqual({ user: "root", host: "2001:db8::1", port: 2022, userGiven: true });
    expect(parse("[::1]:2200")).toEqual({ user: "me", host: "::1", port: 2200, userGiven: false });
  });

  it("reads an ssh command line", () => {
    expect(parse("ssh alice@example.com")).toMatchObject({ user: "alice", host: "example.com", port: 22 });
    expect(parse("ssh alice@example.com -p 2222")).toMatchObject({ user: "alice", host: "example.com", port: 2222 });
    expect(parse("ssh -p 2222 alice@example.com")).toMatchObject({ port: 2222 });
    expect(parse("ssh -p2222 alice@example.com")).toMatchObject({ port: 2222 });
    expect(parse("ssh -l bob example.com")).toMatchObject({ user: "bob", host: "example.com", userGiven: true });
    expect(parse("  ssh   example.com  ")).toMatchObject({ user: "me", host: "example.com", userGiven: false });
  });

  it("lets -p win over a port in the destination", () => {
    expect(parse("ssh example.com:22 -p 2222")).toMatchObject({ port: 2222 });
  });

  it("does not treat plain words as a connection", () => {
    for (const input of ["", "   ", "prod", "new tab", "example.com", "split", "ssh", "ssh "]) {
      expect(parse(input), input).toBeNull();
    }
  });

  it("rejects invalid ports and hosts", () => {
    for (const input of ["a@host:0", "a@host:65536", "a@host:abc", "a@", "@host", "a@ho st", "a@host:", "a@b@c", "a@[::1", "a@exa$mple.com", "a@host;rm"]) {
      expect(parse(input), input).toBeNull();
    }
  });

  it("never lets input become an ssh option", () => {
    for (const input of [
      "-oProxyCommand=evil@host",
      "ssh -oProxyCommand=evil host",
      "ssh -o ProxyCommand=evil host",
      "ssh -J x host",
      "-bad@host",
      "user@-oProxyCommand=evil",
      "ssh -- -host",
      "ssh a@b c@d",
      "ssh -l -bad host",
    ]) {
      expect(parse(input), input).toBeNull();
    }
  });

  it("accepts usernames with dots, dashes and underscores", () => {
    expect(parse("first.last_1-x@host")).toMatchObject({ user: "first.last_1-x" });
  });

  it("needs a user: no default and none typed is not a connection", () => {
    expect(parseQuickConnect("host:22", { defaultUser: "" })).toBeNull();
    expect(parseQuickConnect("a@host", { defaultUser: "" })).toMatchObject({ user: "a" });
  });
});

describe("quickConnectLabel", () => {
  it("shows the port only when it is not 22", () => {
    expect(quickConnectLabel({ user: "a", host: "h.io", port: 22, userGiven: true })).toBe("a@h.io");
    expect(quickConnectLabel({ user: "a", host: "h.io", port: 2200, userGiven: true })).toBe("a@h.io:2200");
  });

  it("brackets IPv6 hosts", () => {
    expect(quickConnectLabel({ user: "a", host: "::1", port: 2200, userGiven: true })).toBe("a@[::1]:2200");
  });
});
