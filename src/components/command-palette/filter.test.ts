import { describe, expect, it } from "vitest";
import { Terminal } from "lucide-react";
import type { PaletteAction } from "./actions";
import { displayOrder, filterActions, filterThemes, groupActions, matchRanges, wrapIndex } from "./filter";

function action(id: string, label: string, category: string): PaletteAction {
  return { id, label, category, icon: Terminal, handler: () => {} };
}

const ACTIONS = [
  action("new-tab", "New Tab", "Actions"),
  action("clear-buffer", "Clear Terminal Buffer", "Terminal"),
  action("new-bash", "New Bash Tab", "New Tab"),
  action("change-theme", "Change Theme", "Appearance"),
  action("toggle-scratchpad", "Toggle Scratchpad Terminal", "Terminal"),
];

describe("filterActions", () => {
  it("returns everything for a blank query", () => {
    expect(filterActions(ACTIONS, "   ")).toEqual(ACTIONS);
  });

  it("matches the label or the category, ignoring case, keeping order", () => {
    expect(filterActions(ACTIONS, "TERMINAL").map((a) => a.id)).toEqual(["clear-buffer", "toggle-scratchpad"]);
    expect(filterActions(ACTIONS, "appear").map((a) => a.id)).toEqual(["change-theme"]);
  });

  it("returns nothing when no action matches", () => {
    expect(filterActions(ACTIONS, "zzz")).toEqual([]);
  });
});

describe("groupActions and displayOrder", () => {
  it("collects a category's actions under its first appearance", () => {
    const groups = groupActions(ACTIONS);
    expect(groups.map((g) => g.category)).toEqual(["Actions", "Terminal", "New Tab", "Appearance"]);
    expect(groups[1].actions.map((a) => a.id)).toEqual(["clear-buffer", "toggle-scratchpad"]);
  });

  it("walks the actions in the order the grouped list shows them", () => {
    expect(displayOrder(groupActions(ACTIONS)).map((a) => a.id)).toEqual([
      "new-tab",
      "clear-buffer",
      "toggle-scratchpad",
      "new-bash",
      "change-theme",
    ]);
  });
});

describe("filterThemes", () => {
  const themes = [{ name: "Graphite" }, { name: "Frost" }, { name: "Paper" }];

  it("matches theme names ignoring case", () => {
    expect(filterThemes(themes, "PA")).toEqual([{ name: "Paper" }]);
    expect(filterThemes(themes, "")).toEqual(themes);
  });
});

describe("wrapIndex", () => {
  it("wraps past both ends", () => {
    expect(wrapIndex(4, 1, 5)).toBe(0);
    expect(wrapIndex(0, -1, 5)).toBe(4);
    expect(wrapIndex(2, 1, 5)).toBe(3);
  });

  it("returns 0 for an empty list", () => {
    expect(wrapIndex(0, 1, 0)).toBe(0);
    expect(wrapIndex(3, -1, 0)).toBe(0);
  });
});

describe("matchRanges", () => {
  it("returns the case-insensitive substring range", () => {
    expect(matchRanges("Toggle Scratchpad", "SCRATCH")).toEqual([[7, 14]]);
  });

  it("returns nothing for a blank query or a miss", () => {
    expect(matchRanges("New Tab", "  ")).toEqual([]);
    expect(matchRanges("New Tab", "zzz")).toEqual([]);
  });

  it("trims the query before matching", () => {
    expect(matchRanges("New Tab", " tab ")).toEqual([[4, 7]]);
  });
});
