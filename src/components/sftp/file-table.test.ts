import { describe, expect, it } from "vitest";
import {
  applySelection,
  fileMenuItems,
  formatDate,
  formatSize,
  nextSort,
  sortEntries,
  transferPercent,
  transferStatusLabel,
} from "./file-table";
import type { SftpEntry } from "../../types/sftp";

function entry(name: string, isDir: boolean, size = 0, modified: string | null = null): SftpEntry {
  return { name, path: `/srv/${name}`, size, modified, permissions: 0o644, isDir, isSymlink: false };
}

const ENTRIES = [
  entry("b.log", false, 300, "200"),
  entry("logs", true, 0, "50"),
  entry("A.txt", false, 100, "300"),
  entry("file10", false, 5, null),
  entry("file9", false, 5, "100"),
  entry("app", true, 0, "400"),
];

describe("sortEntries", () => {
  it("puts folders first and sorts names naturally, ignoring case", () => {
    expect(sortEntries(ENTRIES, { key: "name", dir: "asc" }).map((e) => e.name)).toEqual([
      "app",
      "logs",
      "A.txt",
      "b.log",
      "file9",
      "file10",
    ]);
  });

  it("sorts by size or date descending, keeping folders first", () => {
    expect(sortEntries(ENTRIES, { key: "size", dir: "desc" }).map((e) => e.name)).toEqual([
      "app",
      "logs",
      "b.log",
      "A.txt",
      "file9",
      "file10",
    ]);
    expect(sortEntries(ENTRIES, { key: "modified", dir: "asc" }).map((e) => e.name)).toEqual([
      "logs",
      "app",
      "file10",
      "file9",
      "b.log",
      "A.txt",
    ]);
  });

  it("does not reorder the input", () => {
    sortEntries(ENTRIES, { key: "name", dir: "asc" });
    expect(ENTRIES[0].name).toBe("b.log");
  });

  it("flips the direction of the sorted column and resets for a new one", () => {
    expect(nextSort({ key: "name", dir: "asc" }, "name")).toEqual({ key: "name", dir: "desc" });
    expect(nextSort({ key: "name", dir: "desc" }, "size")).toEqual({ key: "size", dir: "asc" });
  });
});

describe("applySelection", () => {
  const paths = ["/a", "/b", "/c", "/d"];
  const none = { toggle: false, range: false };

  it("selects only the clicked entry on a plain click", () => {
    expect(applySelection(new Set(["/a", "/b"]), paths, 2, 0, none)).toEqual({ selected: new Set(["/c"]), anchor: 2 });
  });

  it("toggles one entry with Cmd/Ctrl", () => {
    expect(applySelection(new Set(["/a"]), paths, 2, 0, { toggle: true, range: false }).selected).toEqual(new Set(["/a", "/c"]));
    expect(applySelection(new Set(["/a", "/c"]), paths, 2, 0, { toggle: true, range: false }).selected).toEqual(new Set(["/a"]));
  });

  it("adds the range from the anchor with Shift and keeps the anchor", () => {
    expect(applySelection(new Set(["/a"]), paths, 3, 1, { toggle: false, range: true })).toEqual({
      selected: new Set(["/a", "/b", "/c", "/d"]),
      anchor: 1,
    });
  });

  it("treats Shift without an anchor as a plain click", () => {
    expect(applySelection(new Set(), paths, 1, -1, { toggle: false, range: true }).selected).toEqual(new Set(["/b"]));
  });
});

describe("fileMenuItems", () => {
  const actions = (items: ReturnType<typeof fileMenuItems>) => items.map((i) => (i === "separator" ? "-" : i.action));

  it("offers download, rename and delete for remote entries", () => {
    expect(actions(fileMenuItems("remote", entry("logs", true)))).toEqual(["open", "download", "-", "rename", "delete", "-", "copy_path"]);
    expect(actions(fileMenuItems("remote", entry("a", false)))).toEqual(["download", "-", "rename", "delete", "-", "copy_path"]);
  });

  it("offers upload for local entries and never rename or delete", () => {
    expect(actions(fileMenuItems("local", entry("a", false)))).toEqual(["upload", "-", "copy_path"]);
  });

  it("creates folders only on the remote side", () => {
    expect(actions(fileMenuItems("remote", null))).toEqual(["new_folder", "refresh"]);
    expect(actions(fileMenuItems("local", null))).toEqual(["refresh"]);
  });
});

describe("formatting", () => {
  it("formats sizes", () => {
    expect(formatSize(0)).toBe("0 B");
    expect(formatSize(1536)).toBe("1.5 KB");
    expect(formatSize(50 * 1024 * 1024)).toBe("50 MB");
  });

  it("formats dates, with a dash when unknown", () => {
    const now = new Date(2026, 9, 8);
    expect(formatDate(null, now)).toBe("--");
    expect(formatDate("nope", now)).toBe("--");
    expect(formatDate(String(new Date(2026, 2, 4, 9, 5).getTime() / 1000), now)).toBe("Mar 4 09:05");
    expect(formatDate(String(new Date(2024, 2, 4).getTime() / 1000), now)).toBe("Mar 4, 2024");
  });

  it("reports transfer progress", () => {
    expect(transferPercent({ status: "in_progress", bytesTransferred: 25, totalBytes: 200 })).toBe(13);
    expect(transferPercent({ status: "completed", bytesTransferred: 0, totalBytes: 0 })).toBe(100);
    expect(transferPercent({ status: "queued", bytesTransferred: 0, totalBytes: 0 })).toBe(0);
    expect(transferStatusLabel({ status: "in_progress", bytesTransferred: 1, totalBytes: 2 })).toBe("50%");
    expect(transferStatusLabel({ status: "error", bytesTransferred: 1, totalBytes: 2 })).toBe("Failed");
  });
});
