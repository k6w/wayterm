import { describe, expect, it } from "vitest";
import { comboFromEvent, findConflicts, normalizeCombo } from "./keybinding-utils";

const press = (key: string, mods: Partial<Record<"ctrlKey" | "metaKey" | "altKey" | "shiftKey", boolean>> = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("comboFromEvent", () => {
  it("writes modifiers in the recorder's order and lower-cases letters", () => {
    expect(comboFromEvent(press("P", { shiftKey: true, ctrlKey: true }))).toBe("Control+Shift+p");
    expect(comboFromEvent(press("k", { metaKey: true, altKey: true }))).toBe("Meta+Alt+k");
  });

  it("names the space bar and keeps named keys", () => {
    expect(comboFromEvent(press(" ", { ctrlKey: true }))).toBe("Control+Space");
    expect(comboFromEvent(press("ArrowLeft", { altKey: true }))).toBe("Alt+ArrowLeft");
  });

  it("waits while only a modifier is down", () => {
    expect(comboFromEvent(press("Shift", { shiftKey: true }))).toBeNull();
    expect(comboFromEvent(press("Meta", { metaKey: true }))).toBeNull();
  });
});

describe("normalizeCombo", () => {
  it("orders modifiers and lower-cases the key", () => {
    expect(normalizeCombo("Shift+Control+P")).toBe("Control+Shift+p");
    expect(normalizeCombo("Control+Shift+p")).toBe("Control+Shift+p");
    expect(normalizeCombo("Alt+ArrowLeft")).toBe("Alt+arrowleft");
  });
});

describe("findConflicts", () => {
  it("maps each clashing action to the others that share its combo", () => {
    const conflicts = findConflicts([
      { id: "paste", label: "Paste", keys: "Control+Shift+v" },
      { id: "clipboard", label: "Clipboard Manager", keys: "Shift+Control+V" },
      { id: "new-tab", label: "New Tab", keys: "Control+t" },
    ]);
    expect(conflicts.get("paste")).toEqual(["Clipboard Manager"]);
    expect(conflicts.get("clipboard")).toEqual(["Paste"]);
    expect(conflicts.has("new-tab")).toBe(false);
  });

  it("lists every other action when three share a combo", () => {
    const conflicts = findConflicts([
      { id: "a", label: "A", keys: "Alt+x" },
      { id: "b", label: "B", keys: "Alt+x" },
      { id: "c", label: "C", keys: "Alt+x" },
    ]);
    expect(conflicts.get("a")).toEqual(["B", "C"]);
  });
});
