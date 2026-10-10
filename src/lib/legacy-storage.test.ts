import { beforeEach, describe, expect, it } from "vitest";
import { migrateLegacyStorage } from "./legacy-storage";

describe("migrateLegacyStorage", () => {
  beforeEach(() => localStorage.clear());

  it("copies old values to the renamed keys and keeps the old ones", () => {
    localStorage.setItem("nexterm-welcomed", "1");
    localStorage.setItem("nexterm.palette.recents", '["a"]');
    migrateLegacyStorage();
    expect(localStorage.getItem("wayterm-welcomed")).toBe("1");
    expect(localStorage.getItem("wayterm.palette.recents")).toBe('["a"]');
    expect(localStorage.getItem("nexterm-welcomed")).toBe("1");
  });

  it("never overwrites a value already under the new key", () => {
    localStorage.setItem("nexterm.palette.recents", '["old"]');
    localStorage.setItem("wayterm.palette.recents", '["new"]');
    migrateLegacyStorage();
    expect(localStorage.getItem("wayterm.palette.recents")).toBe('["new"]');
  });

  it("leaves keys unset when there is nothing to migrate", () => {
    migrateLegacyStorage();
    expect(localStorage.getItem("wayterm-welcomed")).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("ignores storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(() => migrateLegacyStorage(broken)).not.toThrow();
  });
});
