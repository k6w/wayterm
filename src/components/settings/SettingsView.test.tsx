import { beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsView from "./SettingsView";
import { useTerminalStore } from "../../stores/terminal";
import { useSettingsStore } from "../../stores/settings";

beforeEach(() => {
  useTerminalStore.setState(useTerminalStore.getInitialState(), true);
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
});

function openSettings() {
  act(() => useTerminalStore.setState({ settingsOpen: true }));
}

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
