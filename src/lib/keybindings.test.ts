import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultKeybindings, setupKeybindings } from "./keybindings";
import { useTerminalStore } from "../stores/terminal";
import { useSidebarStore } from "../stores/sidebar";
import { useSettingsStore } from "../stores/settings";
import type { TerminalTab } from "../types/terminal";

function makeTab(id: string): TerminalTab {
  return { id, title: id, icon: "", shellType: "zsh", panes: { type: "pane", paneId: `${id}-p` }, isActive: false };
}

// jsdom is not macOS, so Mod is Control.
function press(key: string, init: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, ctrlKey: true, bubbles: true, cancelable: true, ...init }));
}

const setActiveTab = vi.fn();

beforeEach(() => {
  setActiveTab.mockClear();
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useSidebarStore.setState(useSidebarStore.getInitialState(), true);
  useTerminalStore.setState({
    tabs: [makeTab("a"), makeTab("b"), makeTab("c")],
    activeTabId: "a",
    settingsOpen: false,
    commandPaletteOpen: false,
    setActiveTab,
  });
});

describe("default keybindings", () => {
  it("keeps every existing binding id and adds only select-tab-1..9", () => {
    const ids = getDefaultKeybindings().map((b) => b.id);
    expect(ids).toEqual([
      "new-tab", "close-tab", "toggle-sidebar", "command-palette", "settings",
      "split-horizontal", "split-vertical", "next-tab", "prev-tab", "zoom-pane",
      "close-pane", "detach-pane", "focus-next-pane", "focus-prev-pane",
      "focus-next-pane-arrow", "focus-prev-pane-arrow", "toggle-scratchpad",
      "copy", "paste", "search-terminal", "clipboard-manager",
      "select-tab-1", "select-tab-2", "select-tab-3", "select-tab-4", "select-tab-5",
      "select-tab-6", "select-tab-7", "select-tab-8", "select-tab-9",
    ]);
  });

  it("gives the new tab-select bindings keys no other binding uses", () => {
    const bindings = getDefaultKeybindings();
    const others = new Set(bindings.filter((b) => !b.id.startsWith("select-tab-")).map((b) => b.keys.toLowerCase()));
    for (const b of bindings.filter((b) => b.id.startsWith("select-tab-"))) {
      expect(others.has(b.keys.toLowerCase()), b.id).toBe(false);
    }
  });
});

describe("setupKeybindings", () => {
  it("Mod+B toggles the sidebar", () => {
    const teardown = setupKeybindings();
    press("b");
    expect(useSidebarStore.getState().collapsed).toBe(false);
    press("b");
    expect(useSidebarStore.getState().collapsed).toBe(true);
    teardown();
  });

  it("Mod+1..9 select that tab and ignore numbers past the last tab", () => {
    const teardown = setupKeybindings();
    press("2");
    expect(setActiveTab).toHaveBeenLastCalledWith("b");
    press("3");
    expect(setActiveTab).toHaveBeenLastCalledWith("c");
    press("9");
    expect(setActiveTab).toHaveBeenCalledTimes(2);
    teardown();
  });

  it("the clipboard-manager action opens the clipboard panel", () => {
    // Called directly: off macOS its Ctrl+Shift+V is shadowed by paste (a
    // pre-existing conflict that Phase 2 leaves alone).
    getDefaultKeybindings().find((b) => b.id === "clipboard-manager")!.handler();
    expect(useSidebarStore.getState()).toMatchObject({ collapsed: false, section: "clipboard" });
  });

  it("honors a user override of a select-tab binding", () => {
    useSettingsStore.setState((s) => ({ settings: { ...s.settings, keybindings: { "select-tab-1": "Alt+1" } } }));
    const teardown = setupKeybindings();
    press("1");
    expect(setActiveTab).not.toHaveBeenCalled();
    press("1", { ctrlKey: false, altKey: true });
    expect(setActiveTab).toHaveBeenCalledWith("a");
    teardown();
  });
});
