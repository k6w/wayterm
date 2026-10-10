import { invoke } from "@tauri-apps/api/core";
import { loadShellInfo, resetShellInfo } from "./shell-detect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Terminal } from "@xterm/xterm";
import { BlockTracker } from "./blocks/block-tracker";
import { removeCachedTerminal, setCachedTerminal, type CachedTerminal } from "./terminal-registry";
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
  it("keeps every existing binding id and adds select-tab-1..9 and the command block keys", () => {
    const ids = getDefaultKeybindings().map((b) => b.id);
    expect(ids).toEqual([
      "new-tab", "close-tab", "toggle-sidebar", "command-palette", "settings",
      "split-horizontal", "split-vertical", "next-tab", "prev-tab", "zoom-pane",
      "close-pane", "detach-pane", "focus-next-pane", "focus-prev-pane",
      "focus-next-pane-arrow", "focus-prev-pane-arrow", "toggle-scratchpad",
      "block-prev", "block-next", "block-select-extend-up", "block-select-extend-down",
      "block-copy-output", "block-clear-selection",
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

describe("new-tab shell", () => {
  const addTab = vi.fn();
  beforeEach(() => {
    addTab.mockClear();
    resetShellInfo();
    useTerminalStore.setState({ addTab });
  });

  it("uses the login shell when no default shell is configured", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ loginShell: "/bin/zsh", shells: ["/bin/bash", "/bin/zsh"] });
    await loadShellInfo();
    getDefaultKeybindings().find((b) => b.id === "new-tab")!.handler();
    expect(addTab).toHaveBeenCalledWith("zsh", "/bin/zsh");
  });

  it("uses the configured default shell", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ loginShell: "/bin/zsh", shells: ["/bin/bash", "/bin/zsh"] });
    await loadShellInfo();
    const s = useSettingsStore.getState().settings;
    useSettingsStore.setState({ settings: { ...s, general: { ...s.general, defaultShell: "/bin/bash" } } });
    getDefaultKeybindings().find((b) => b.id === "new-tab")!.handler();
    expect(addTab).toHaveBeenCalledWith("bash", "/bin/bash");
  });
});

describe("command block keys", () => {
  const NONCE = "n";
  let term: Terminal;
  let tracker: BlockTracker;

  async function setup(flag = true) {
    const s = useSettingsStore.getState().settings;
    useSettingsStore.setState({ settings: { ...s, terminal: { ...s.terminal, commandBlocks: flag } } });
    term = new Terminal({ cols: 80, rows: 5, allowProposedApi: true, scrollback: 100 });
    tracker = new BlockTracker(term, NONCE);
    const block = (cmd: string) =>
      `\x1b]133;A;wt=${NONCE}\x07$ \x1b]133;B\x07${cmd}\r\n\x1b]133;C;wt=${NONCE}\x07out\r\n\x1b]133;D;0;wt=${NONCE}\x07`;
    await new Promise<void>((resolve) =>
      term.write(`${block("one")}${block("two")}${block("three")}\x1b]133;A;wt=${NONCE}\x07$ `, resolve),
    );
    // The terminal's own element has focus, as when the user types in it.
    const host = document.createElement("div");
    const focusable = document.createElement("textarea");
    host.appendChild(focusable);
    document.body.appendChild(host);
    Object.defineProperty(term, "element", { value: host, configurable: true });
    focusable.focus();
    setCachedTerminal("pane-1", { terminal: term, sessionId: "s1", blocks: tracker } as unknown as CachedTerminal);
    useTerminalStore.setState({ activePaneId: "pane-1" });
  }

  function key(k: string) {
    const event = new KeyboardEvent("keydown", { key: k, ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(event);
    return event;
  }

  afterEach(() => {
    removeCachedTerminal("pane-1");
    document.body.innerHTML = "";
  });

  it("jumps between blocks at the shell", async () => {
    await setup();
    const teardown = setupKeybindings();
    expect(key("ArrowUp").defaultPrevented).toBe(true);
    expect(tracker.selection.map((b) => tracker.getCommandText(b))).toEqual(["three"]);
    key("ArrowUp");
    expect(tracker.selection.map((b) => tracker.getCommandText(b))).toEqual(["two"]);
    key("ArrowDown");
    expect(tracker.selection.map((b) => tracker.getCommandText(b))).toEqual(["three"]);
    teardown();
  });

  it("leaves the keys to the program on the alternate screen (vim, tmux)", async () => {
    await setup();
    await new Promise<void>((resolve) => term.write("\x1b[?1049h", resolve));
    const teardown = setupKeybindings();
    expect(key("ArrowUp").defaultPrevented).toBe(false);
    expect(tracker.selection).toEqual([]);
    teardown();
  });

  it("leaves the keys alone with the feature off or when the terminal is not focused", async () => {
    await setup(false);
    const teardown = setupKeybindings();
    expect(key("ArrowUp").defaultPrevented).toBe(false);
    teardown();
    await setup(true);
    (document.activeElement as HTMLElement).blur();
    const teardown2 = setupKeybindings();
    expect(key("ArrowUp").defaultPrevented).toBe(false);
    teardown2();
  });

  it("copies the selected block's output, else falls through to the normal copy", async () => {
    await setup();
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}), readText: vi.fn(async () => "") } });
    const teardown = setupKeybindings();
    key("c");
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled(); // no block and no text selected
    key("ArrowUp");
    key("c");
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("out");
    const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    window.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(tracker.selection).toEqual([]);
    const again = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    window.dispatchEvent(again);
    expect(again.defaultPrevented).toBe(false);
    teardown();
  });
});
