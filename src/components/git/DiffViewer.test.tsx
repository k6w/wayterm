import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import DiffViewer from "./DiffViewer";

const CHANGES = [
  "diff --git a/a.txt b/a.txt",
  "index 1..2 100644",
  "--- a/a.txt",
  "+++ b/a.txt",
  "@@ -1,2 +1,2 @@",
  " one",
  "-two",
  "+three",
].join("\n");

describe("DiffViewer", () => {
  it("renders added and removed lines with token colors", () => {
    render(<DiffViewer diffs={[{ file: "a.txt", additions: 1, deletions: 1, changes: CHANGES }]} />);
    expect(screen.getByText("three").closest("tr")).toHaveClass("bg-success-subtle", "text-success");
    expect(screen.getByText("two").closest("tr")).toHaveClass("bg-danger-subtle", "text-danger");
    expect(screen.getByText("one").closest("tr")).toHaveClass("text-fg-secondary");
  });

  it("pluralizes the file count", () => {
    const d = { file: "a.txt", additions: 1, deletions: 0, changes: "@@ -1 +1 @@\n+x" };
    const { rerender } = render(<DiffViewer diffs={[d]} />);
    expect(screen.getByText("1 file changed")).toBeInTheDocument();
    rerender(<DiffViewer diffs={[d, { ...d, file: "b.txt" }]} />);
    expect(screen.getByText("2 files changed")).toBeInTheDocument();
  });
});
