import { describe, expect, it } from "vitest";
import {
  EMPTY_PORT_FORWARD_FORM,
  forwardRoute,
  forwardType,
  toPortForward,
  validatePortForward,
} from "./port-forward-form";

describe("validatePortForward", () => {
  it("accepts the defaults", () => {
    expect(validatePortForward(EMPTY_PORT_FORWARD_FORM)).toEqual({});
  });

  it("rejects half-typed and out-of-range ports and a blank or spaced host", () => {
    expect(validatePortForward({ localPort: "80a", remoteHost: " ", remotePort: "70000" })).toEqual({
      localPort: "Use a port from 1 to 65535.",
      remoteHost: "Enter a host.",
      remotePort: "Use a port from 1 to 65535.",
    });
    expect(validatePortForward({ ...EMPTY_PORT_FORWARD_FORM, remoteHost: "db internal" }).remoteHost).toBe(
      "A host has no spaces."
    );
    expect(validatePortForward({ ...EMPTY_PORT_FORWARD_FORM, localPort: "0" }).localPort).toBeDefined();
  });
});

describe("toPortForward", () => {
  it("builds a new, stopped local forward with numeric ports and a trimmed host", () => {
    expect(toPortForward({ localPort: " 5433 ", remoteHost: " db.internal ", remotePort: "5432" }, "c1")).toEqual({
      id: "",
      connectionId: "c1",
      portForwardType: "local",
      localPort: 5433,
      remoteHost: "db.internal",
      remotePort: 5432,
      isActive: false,
      createdAt: "",
      updatedAt: "",
    });
  });
});

describe("labels", () => {
  it("names the forward types and formats the route", () => {
    expect(forwardType("local")).toEqual({ short: "L", long: "Local" });
    expect(forwardType("dynamic")).toEqual({ short: "D", long: "Dynamic" });
    expect(forwardType("socks")).toEqual({ short: "S", long: "socks" });
    expect(forwardRoute({ localPort: 8080, remoteHost: "web", remotePort: 80 })).toBe("8080 → web:80");
  });
});
