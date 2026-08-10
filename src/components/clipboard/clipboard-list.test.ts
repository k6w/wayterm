import { describe, expect, it } from "vitest";
import { clipboardPreview, filterClipboard } from "./clipboard-list";
import type { ClipboardEntry } from "../../types/clipboard";

function entry(id: string, content: string, favorite = false): ClipboardEntry {
  return { id, content, timestamp: 0, source: "terminal", favorite, tags: [] };
}

describe("filterClipboard", () => {
  const entries = [entry("a", "git status"), entry("b", "ls -la", true), entry("c", "GIT push")];

  it("puts starred entries first and keeps the stored order otherwise", () => {
    expect(filterClipboard(entries, "").map((e) => e.id)).toEqual(["b", "a", "c"]);
  });

  it("matches case-insensitively and ignores surrounding spaces", () => {
    expect(filterClipboard(entries, "  git ").map((e) => e.id)).toEqual(["a", "c"]);
    expect(filterClipboard(entries, "nothing")).toEqual([]);
  });

  it("does not reorder the store's array", () => {
    filterClipboard(entries, "");
    expect(entries.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });
});

describe("clipboardPreview", () => {
  it("collapses whitespace to one line and cuts long text", () => {
    expect(clipboardPreview("  echo hi\n\techo there  ")).toBe("echo hi echo there");
    expect(clipboardPreview("x".repeat(150))).toBe(`${"x".repeat(100)}…`);
  });
});
