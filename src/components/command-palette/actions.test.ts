import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPaletteActions, historyActions } from "./actions";
import { useSettingsStore } from "../../stores/settings";
import { useTerminalStore } from "../../stores/terminal";
import { OPEN_SSH_CONFIG_IMPORT } from "../ssh/ssh-config-import";
import { useWorkspaceStore } from "../../stores/workspace";
import { OPEN_SAVE_WORKSPACE } from "../sidebar/save-workspace";
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
  it("toggles inactive pane dimming", () => {
    const run = () => buildPaletteActions().find((a) => a.id === "toggle-pane-dimming")!.handler();
    expect(useSettingsStore.getState().settings.appearance.dimInactivePanes).toBe(true);
    run();
    expect(useSettingsStore.getState().settings.appearance.dimInactivePanes).toBe(false);
    run();
    expect(useSettingsStore.getState().settings.appearance.dimInactivePanes).toBe(true);
  });

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

  it("offers the ~/.ssh/config import, which opens its dialog", () => {
    const listener = vi.fn();
    window.addEventListener(OPEN_SSH_CONFIG_IMPORT, listener);
    const action = buildPaletteActions().find((a) => a.id === "import-ssh-config");
    expect(action).toMatchObject({ label: "Import from ~/.ssh/config", category: "SSH" });
    action?.handler();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_SSH_CONFIG_IMPORT, listener);
  });

  it("keeps the theme picker as a nested list", () => {
    expect(buildPaletteActions().find((a) => a.id === "change-theme")).toMatchObject({
      category: "Appearance",
      subView: "themes",
    });
  });

  it("opens the serial dialog through its window event", () => {
    const listener = vi.fn();
    window.addEventListener("wayterm:open-serial", listener);
    buildPaletteActions().find((a) => a.id === "new-serial-tab")?.handler();
    window.removeEventListener("wayterm:open-serial", listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("workspace actions", () => {
  const meta = (id: string, name: string, layout = "{}") => ({ id, name, icon: null, isDefault: false, updatedAt: "", layout });
  const restore = vi.fn(() => true);

  beforeEach(() => {
    restore.mockClear();
    useTerminalStore.setState({ tabs: [] });
    useWorkspaceStore.setState({
      workspaces: [meta("__session__", "__session__"), meta("w1", "Backend"), meta("w2", "Ops")],
      restore,
    });
  });

  it("lists one Open workspace entry per saved workspace, without the auto-saved session", () => {
    const entries = buildPaletteActions().filter((a) => a.category === "Workspaces" && a.id.startsWith("open-workspace-"));
    expect(entries.map((a) => a.label)).toEqual(["Open workspace: Backend", "Open workspace: Ops"]);
  });

  it("opens in place of the current tabs when none are open", () => {
    buildPaletteActions().find((a) => a.id === "open-workspace-w1")?.handler();
    expect(restore).toHaveBeenCalledWith("w1", "replace");
  });

  it("adds to the current tabs instead of closing them when some are open", () => {
    useTerminalStore.setState({ tabs: [{ id: "t", title: "T", icon: "terminal", shellType: "zsh", panes: { type: "pane", paneId: "p" }, isActive: true }] });
    const entry = buildPaletteActions().find((a) => a.id === "open-workspace-w2");
    expect(entry?.detail).toBe("Adds to current tabs");
    entry?.handler();
    expect(restore).toHaveBeenCalledWith("w2", "add");
  });

  it("offers saving the current layout, which opens the name dialog through its window event", () => {
    const listener = vi.fn();
    window.addEventListener(OPEN_SAVE_WORKSPACE, listener);
    const action = buildPaletteActions().find((a) => a.id === "save-workspace");
    expect(action).toMatchObject({ label: "Save current layout as workspace…", category: "Workspaces" });
    action?.handler();
    window.removeEventListener(OPEN_SAVE_WORKSPACE, listener);
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
