import { describe, expect, it } from "vitest";
import { createProfile, duplicateProfile, nextEnvKey, removeEnvKey, renameEnvKey } from "./profile-utils";

describe("profile helpers", () => {
  it("creates a blank profile with no overrides", () => {
    expect(createProfile("p1")).toMatchObject({
      id: "p1",
      name: "New Profile",
      shellPath: "",
      args: [],
      env: {},
      themeOverride: null,
      ligaturesOverride: null,
    });
  });

  it("duplicates with a new id, a (Copy) name and its own args and env", () => {
    const original = { ...createProfile("p1"), name: "Work", args: ["-l"], env: { A: "1" } };
    const copy = duplicateProfile(original, "p2");
    expect(copy).toMatchObject({ id: "p2", name: "Work (Copy)", args: ["-l"], env: { A: "1" } });
    expect(copy.args).not.toBe(original.args);
    expect(copy.env).not.toBe(original.env);
  });

  it("picks the next free variable name", () => {
    expect(nextEnvKey({})).toBe("VAR_1");
    expect(nextEnvKey({ VAR_1: "" })).toBe("VAR_2");
    expect(nextEnvKey({ A: "", VAR_3: "" })).toBe("VAR_4");
  });

  it("renames a variable without moving it", () => {
    expect(Object.keys(renameEnvKey({ A: "1", B: "2", C: "3" }, "B", "BB"))).toEqual(["A", "BB", "C"]);
    expect(renameEnvKey({ A: "1", B: "2" }, "B", "BB")).toEqual({ A: "1", BB: "2" });
  });

  it("removes a variable", () => {
    expect(removeEnvKey({ A: "1", B: "2" }, "A")).toEqual({ B: "2" });
  });
});
