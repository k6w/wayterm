import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPaletteActions, historyActions } from "./actions";
import { useSettingsStore } from "../../stores/settings";
import { useTerminalStore } from "../../stores/terminal";
import { writeToTerminal } from "../../lib/terminal-registry";

vi.mock("../../lib/terminal-registry", () => ({
  clearBuffer: vi.fn(),
  resetTerminal: vi.fn(),
  writeToTerminal: vi.fn(),
  getCachedTerminal: vi.fn(),
  copySelection: vi.fn(),
  pasteToTerminal: vi.fn(),
}));

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useTerminalStore.setState({ activePaneId: "p1" });
});

describe("buildPaletteActions", () => {
  it("lists keybinding actions with their shortcut, but not the palette itself", () => {
    const actions = buildPaletteActions();
    expect(actions.find((a) => a.id === "split-horizontal")).toMatchObject({
      label: "Split Horizontal",
      category: "Actions",
      keys: "Control+Shift+d",
    });
    expect(actions.find((a) => a.id === "command-palette")).toBeUndefined();
  });

  it("shows the user's rebound keys", () => {
    useSettingsStore.setState((s) => ({
      settings: { ...s.settings, keybindings: { "split-horizontal": "Alt+d" } },
    }));
    expect(buildPaletteActions().find((a) => a.id === "split-horizontal")?.keys).toBe("Alt+d");
  });

  it("reads snippets each time it is called", () => {
    expect(buildPaletteActions().some((a) => a.category === "Snippets")).toBe(false);
    useSettingsStore.setState((s) => ({
      settings: { ...s.settings, snippets: [{ id: "s1", name: "Deploy", command: "make deploy" }] },
    }));
    expect(buildPaletteActions().find((a) => a.id === "snippet-s1")).toMatchObject({
      label: "Deploy",
      category: "Snippets",
    });
  });

  it("keeps the theme picker as a nested list", () => {
    expect(buildPaletteActions().find((a) => a.id === "change-theme")).toMatchObject({
      category: "Appearance",
      subView: "themes",
    });
  });

  it("opens the serial dialog through its window event", () => {
    const listener = vi.fn();
    window.addEventListener("nexterm:open-serial", listener);
    buildPaletteActions().find((a) => a.id === "new-serial-tab")?.handler();
    window.removeEventListener("nexterm:open-serial", listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("historyActions", () => {
  it("drops blank commands and types the trimmed command into the active pane", () => {
    const actions = historyActions([
      { id: 1, command: "  git status  " },
      { id: 2, command: "   " },
    ]);
    expect(actions.map((a) => [a.id, a.label, a.category])).toEqual([["history-1", "git status", "History"]]);
    actions[0].handler();
    expect(writeToTerminal).toHaveBeenCalledWith("p1", "git status\r");
  });

  it("treats a missing result as no history", () => {
    expect(historyActions(null)).toEqual([]);
  });
});
