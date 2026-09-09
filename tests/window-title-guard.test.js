// @vitest-environment node
// Regression guard for the macOS traffic lights jumping ~6pt up after a tab
// opens: a native title change makes AppKit lay out the title bar again and
// reset the buttons, and only the Rust set_window_title command re-applies
// their position afterwards. The JS window.setTitle() bypasses that, so no
// frontend file may call it.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// fileURLToPath, not URL.pathname: on Windows .pathname is "/D:/..." and breaks fs calls.
const root = fileURLToPath(new URL("../src/", import.meta.url));

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("window title", () => {
  it("is only ever set through setWindowTitle (src/lib/ipc.ts)", () => {
    const offenders = sourceFiles(root).filter((file) => /\.setTitle\s*\(/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
