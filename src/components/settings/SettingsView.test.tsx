import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsView from "./SettingsView";
import { useSshStore } from "../../stores/ssh";
import { NAV_GROUPS } from "./nav";
import { useTerminalStore } from "../../stores/terminal";
import { useSettingsStore } from "../../stores/settings";
import { setupKeybindings } from "../../lib/keybindings";

beforeEach(() => {
  useTerminalStore.setState(useTerminalStore.getInitialState(), true);
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
});

function openSettings() {
  act(() => useTerminalStore.setState({ settingsOpen: true }));
}

describe("SettingsView surface", () => {
  it("is opaque and unblurred so content behind never shows through at any blur setting", () => {
    render(<SettingsView />);
    openSettings();
    const root = screen.getByRole("region", { name: "Settings" });
    expect(root).toHaveClass("bg-canvas");
    expect(root).not.toHaveClass("nx-blur");
    expect(root.className).not.toMatch(/glass/);
  });
});

describe("SettingsView scrolling", () => {
  it("reserves the scrollbar gutter so short and long panels share one left edge", () => {
    render(<SettingsView />);
    openSettings();
    expect(document.querySelector("[data-settings-scroll]")).toHaveClass("[scrollbar-gutter:stable]");
  });

  it("always shows the scroll track so short and long panels share one left edge", () => {
    render(<SettingsView />);
    openSettings();
    expect(document.querySelector("[data-settings-scroll]")).toHaveClass("overflow-y-scroll");
  });

  it("renders every panel inside the one shared content frame", async () => {
    useSshStore.setState({ keys: [], loadKeys: vi.fn(async () => {}) });
    const user = userEvent.setup();
    render(<SettingsView />);
    openSettings();
    const classes = new Set<string>();
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        await user.click(screen.getByRole("button", { name: item.label }));
        const frames = document.querySelectorAll("[data-settings-scroll] > [data-settings-frame]");
        expect(frames, item.label).toHaveLength(1);
        expect(frames[0].children).toHaveLength(1);
        classes.add(frames[0].className);
      }
    }
    expect(classes.size).toBe(1);
  });

  it("resets the content scroll to the top when switching panels", async () => {
    const user = userEvent.setup();
    render(<SettingsView />);
    openSettings();
    const scroller = document.querySelector<HTMLElement>("[data-settings-scroll]")!;
    scroller.scrollTop = 120;
    await user.click(screen.getByRole("button", { name: "Appearance" }));
    expect(scroller.scrollTop).toBe(0);
  });

  it("scrolls a clicked search result's row into view and highlights it", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(Element.prototype, "scrollIntoView");
    render(<SettingsView />);
    openSettings();
    await user.click(screen.getByRole("button", { name: "Appearance" }));
    spy.mockClear();
    await user.type(screen.getByRole("searchbox", { name: "Search settings" }), "default shell");
    await user.click(screen.getByRole("button", { name: /Default shell/ }));
    const row = document.querySelector("[data-setting='Default shell']")!;
    expect(row).toBeInTheDocument();
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.contexts).toContain(row);
    expect(row).toHaveAttribute("data-highlight");
    spy.mockRestore();
  });

  it("turns off autocomplete and autocorrect in the search box", () => {
    render(<SettingsView />);
    openSettings();
    const box = screen.getByRole("searchbox", { name: "Search settings" });
    expect(box).toHaveAttribute("autocomplete", "off");
    expect(box).toHaveAttribute("autocorrect", "off");
    expect(box).toHaveAttribute("spellcheck", "false");
    expect(box).not.toHaveClass("font-mono");
  });
});

describe("SettingsView", () => {
  it("renders nothing while closed", () => {
    render(<SettingsView />);
    expect(screen.queryByRole("region", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("groups the panels and starts on General with the search focused", () => {
    render(<SettingsView />);
    openSettings();
    const nav = screen.getByRole("navigation", { name: "Settings sections" });
    const groups = within(nav).getAllByRole("group").map((group) => group.getAttribute("aria-label"));
    expect(groups).toEqual(["App", "Terminal", "Connections", "Advanced"]);
    const app = within(nav).getByRole("group", { name: "App" });
    expect(within(app).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "General",
      "Appearance",
      "Keybindings",
    ]);
    expect(within(nav).getByRole("button", { name: "General" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("heading", { level: 2, name: "General" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search settings" })).toHaveFocus();
  });

  it("switches panels from the navigation", async () => {
    const user = userEvent.setup();
    render(<SettingsView />);
    openSettings();
    await user.click(screen.getByRole("button", { name: "Terminal" }));
    expect(screen.getByRole("heading", { level: 2, name: "Terminal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terminal" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "General" })).not.toHaveAttribute("aria-current");
  });

  it("searches settings by label and opens the first result with Enter", async () => {
    const user = userEvent.setup();
    render(<SettingsView />);
    openSettings();
    await user.type(screen.getByRole("searchbox", { name: "Search settings" }), "scrollback");
    const nav = screen.getByRole("navigation", { name: "Settings sections" });
    expect(within(nav).getByRole("button", { name: /Scrollback lines/ })).toHaveTextContent("Terminal");
    expect(within(nav).queryByRole("group")).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { level: 2, name: "Terminal" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search settings" })).toHaveValue("");
  });

  it("says so when nothing matches", async () => {
    const user = userEvent.setup();
    render(<SettingsView />);
    openSettings();
    await user.type(screen.getByRole("searchbox", { name: "Search settings" }), "zzzz");
    expect(screen.getByText('No settings match "zzzz"')).toBeInTheDocument();
  });

  it("closes on Escape and with the close button", async () => {
    const user = userEvent.setup();
    render(<SettingsView />);
    openSettings();
    await user.keyboard("{Escape}");
    expect(useTerminalStore.getState().settingsOpen).toBe(false);
    openSettings();
    await user.click(screen.getByRole("button", { name: "Close settings" }));
    expect(useTerminalStore.getState().settingsOpen).toBe(false);
  });

  it("leaves Escape to whatever already handled it (an open select or dialog)", () => {
    render(<SettingsView />);
    openSettings();
    const event = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    event.preventDefault();
    act(() => {
      window.dispatchEvent(event);
    });
    expect(useTerminalStore.getState().settingsOpen).toBe(true);
  });

  it("keeps the panel across close and reopen but clears the search", async () => {
    const user = userEvent.setup();
    render(<SettingsView />);
    openSettings();
    await user.click(screen.getByRole("button", { name: "Keybindings" }));
    await user.type(screen.getByRole("searchbox", { name: "Search settings" }), "font");
    act(() => useTerminalStore.getState().toggleSettings());
    openSettings();
    expect(screen.getByRole("heading", { level: 2, name: "Keybindings" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search settings" })).toHaveValue("");
  });

  it("opens the panel a deep link asks for and ignores unknown ids", () => {
    render(<SettingsView />);
    act(() => useTerminalStore.getState().openSettings("keybindings"));
    expect(screen.getByRole("heading", { level: 2, name: "Keybindings" })).toBeInTheDocument();
    expect(useTerminalStore.getState().settingsPanel).toBeNull();
    act(() => useTerminalStore.getState().openSettings("nope"));
    expect(screen.getByRole("heading", { level: 2, name: "Keybindings" })).toBeInTheDocument();
    expect(useTerminalStore.getState().settingsPanel).toBeNull();
  });
});

describe("SettingsView Escape layering", () => {
  it("closes an open select first, then settings on the next Escape", async () => {
    const teardown = setupKeybindings();
    const user = userEvent.setup();
    render(<SettingsView />);
    openSettings();
    await user.click(screen.getAllByRole("combobox")[0]);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(useTerminalStore.getState().settingsOpen).toBe(true);
    await user.keyboard("{Escape}");
    expect(useTerminalStore.getState().settingsOpen).toBe(false);
    teardown();
  });
});
