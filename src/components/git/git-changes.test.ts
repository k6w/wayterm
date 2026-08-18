import { describe, expect, it } from "vitest";
import { changeGroups, isRepoPath } from "./git-changes";
import type { GitStatus } from "../../types/git";

const STATUS: GitStatus = {
  branch: "main",
  ahead: 0,
  behind: 0,
  staged: ["src/a.ts"],
  modified: ["src/b.ts"],
  added: ["src/c.ts"],
  deleted: ["old.txt"],
  untracked: ["notes.md"],
  conflicted: 0,
  stashes: 0,
};

describe("changeGroups", () => {
  it("splits staged from unstaged and codes each file", () => {
    expect(changeGroups(STATUS)).toEqual({
      staged: [{ path: "src/a.ts", code: "S", staged: true }],
      unstaged: [
        { path: "src/b.ts", code: "M" },
        { path: "src/c.ts", code: "A" },
        { path: "old.txt", code: "D" },
        { path: "notes.md", code: "U" },
      ],
    });
  });
});

describe("changeGroups staged codes", () => {
  it("uses the real index status for staged badges", () => {
    const status = {
      ...STATUS,
      staged: ["n.ts", "m.ts", "d.ts", "r.ts"],
      stagedCodes: { "n.ts": "A", "m.ts": "M", "d.ts": "D", "r.ts": "R" },
    };
    expect(changeGroups(status).staged.map((r) => r.code)).toEqual(["A", "M", "D", "R"]);
  });
});

describe("isRepoPath", () => {
  it("rejects an empty or home placeholder cwd", () => {
    expect(isRepoPath("")).toBe(false);
    expect(isRepoPath("~")).toBe(false);
    expect(isRepoPath("/home/me/app")).toBe(true);
  });
});
