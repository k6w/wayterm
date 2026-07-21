import { describe, expect, it } from "vitest";
import { formatShortcut, shortcutLabel } from "./shortcut";

describe("formatShortcut", () => {
  it("uses symbols on macOS", () => {
    expect(formatShortcut("Meta+Shift+p", true)).toEqual(["⌘", "⇧", "P"]);
    expect(formatShortcut("Control+Alt+t", true)).toEqual(["⌃", "⌥", "T"]);
    expect(formatShortcut("Mod+,", true)).toEqual(["⌘", ","]);
  });

  it("uses words on Windows and Linux", () => {
    expect(formatShortcut("Control+Shift+p", false)).toEqual(["Ctrl", "Shift", "P"]);
    expect(formatShortcut("Mod+t", false)).toEqual(["Ctrl", "T"]);
  });

  it("names special keys", () => {
    expect(formatShortcut("Control+Tab", false)).toEqual(["Ctrl", "Tab"]);
    expect(formatShortcut("ArrowUp", true)).toEqual(["↑"]);
    expect(formatShortcut("F2", false)).toEqual(["F2"]);
    expect(formatShortcut("Delete", false)).toEqual(["Del"]);
  });

  it("builds a one-line label", () => {
    expect(shortcutLabel("Control+Shift+p", false)).toBe("Ctrl+Shift+P");
    expect(shortcutLabel("Meta+Shift+p", true)).toBe("⌘⇧P");
  });
});
