import { describe, expect, it } from "vitest";
import { SETTINGS_SEARCH_INDEX, searchSettings } from "./searchIndex";
import { isPanelId } from "./nav";

describe("searchSettings", () => {
  it("returns null for a blank query", () => {
    expect(searchSettings("")).toBeNull();
    expect(searchSettings("   ")).toBeNull();
  });

  it("matches labels case-insensitively", () => {
    expect(searchSettings("WINDOW OPACITY")?.map((e) => e.label)).toEqual(["Window opacity"]);
  });

  it("matches keywords", () => {
    expect(searchSettings("autostart")?.map((e) => e.label)).toEqual(["Launch on startup"]);
  });

  it("matches the panel name", () => {
    const keys = searchSettings("keys")?.map((e) => `${e.panel}:${e.label}`);
    expect(keys).toContain("keys:SSH keys");
    expect(keys).toContain("keybindings:Keyboard shortcuts");
  });

  it("finds nothing for nonsense", () => {
    expect(searchSettings("zzzz")).toEqual([]);
  });

  it("points every entry at a real panel", () => {
    for (const entry of SETTINGS_SEARCH_INDEX) expect(isPanelId(entry.panel)).toBe(true);
  });
});
