import { describe, expect, it } from "vitest";
import { groupSnippets, isDraftValid, mergeImportedSnippets, saveSnippet } from "./snippets";
import type { Snippet } from "../../types/settings";

const LIST: Snippet[] = [
  { id: "1", name: "logs", command: "journalctl -f", category: "ops" },
  { id: "2", name: "status", command: "git status" },
  { id: "3", name: "disk", command: "df -h", category: "Ops" },
  { id: "4", name: "deploy", command: "make deploy", category: "deploy" },
];

let counter = 0;
const newId = () => `new-${++counter}`;

describe("groupSnippets", () => {
  it("sorts categories and puts uncategorized last", () => {
    expect(groupSnippets(LIST).map((g) => [g.category, g.snippets.map((s) => s.id)])).toEqual([
      ["deploy", ["4"]],
      ["ops", ["1"]],
      ["Ops", ["3"]],
      [null, ["2"]],
    ]);
  });

  it("treats a blank category as none", () => {
    expect(groupSnippets([{ id: "x", name: "a", command: "b", category: "  " }])[0].category).toBeNull();
  });
});

describe("saveSnippet", () => {
  it("adds a trimmed snippet, dropping an empty category", () => {
    counter = 0;
    const next = saveSnippet(LIST, { name: " up ", category: " ", command: " uptime " }, null, newId);
    expect(next[next.length - 1]).toEqual({ id: "new-1", name: "up", command: "uptime", category: undefined });
    expect(next).toHaveLength(5);
  });

  it("replaces the edited snippet in place", () => {
    const next = saveSnippet(LIST, { name: "st", category: "git", command: "git st" }, "2", newId);
    expect(next[1]).toEqual({ id: "2", name: "st", command: "git st", category: "git" });
    expect(next).toHaveLength(4);
  });

  it("requires a name and a command", () => {
    expect(isDraftValid({ name: "a", category: "", command: " " })).toBe(false);
    expect(isDraftValid({ name: " ", category: "", command: "ls" })).toBe(false);
    expect(isDraftValid({ name: "a", category: "", command: "ls" })).toBe(true);
  });
});

describe("mergeImportedSnippets", () => {
  it("rejects a file that is not a list", () => {
    expect(mergeImportedSnippets(LIST, { name: "x" }, newId)).toBeNull();
  });

  it("skips malformed entries and known ids, and fills in missing ids", () => {
    counter = 0;
    const merged = mergeImportedSnippets(
      LIST,
      [
        { id: "1", name: "dup", command: "x" },
        { name: "no id", command: "whoami", category: "me" },
        { id: "9", name: 42, command: "x" },
        null,
        "text",
      ],
      newId
    );
    expect(merged?.slice(4)).toEqual([{ id: "new-1", name: "no id", command: "whoami", category: "me" }]);
  });
});
