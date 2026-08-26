import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TabStrip from "./TabStrip";
import { useTerminalStore } from "../../stores/terminal";
import { useSettingsStore } from "../../stores/settings";
import type { TerminalTab } from "../../types/terminal";

function makeTab(id: string, title: string, isActive: boolean): TerminalTab {
  return { id, title, icon: "", shellType: "zsh", panes: { type: "pane", paneId: `${id}-pane` }, isActive };
}

const actions = {
  setActiveTab: vi.fn(),
  removeTab: vi.fn(),
  addTab: vi.fn(() => "new"),
  renameTab: vi.fn(),
};

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useTerminalStore.setState({
    tabs: [makeTab("t1", "zsh", true), makeTab("t2", "logs", false), makeTab("t3", "db", false)],
    activeTabId: "t1",
    panes: {},
    ...actions,
  });
});

describe("TabStrip", () => {
  it("never scrolls vertically or shows a scrollbar along the top", () => {
    render(<TabStrip />);
    const strip = screen.getByRole("tablist", { name: "Terminal tabs" }).parentElement!;
    expect(strip).toHaveClass("overflow-y-hidden", "scrollbar-none");
  });

  it("renders one tab per terminal tab with the active one selected", () => {
    render(<TabStrip />);
    const list = screen.getByRole("tablist", { name: "Terminal tabs" });
    const tabs = within(list).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["zsh", "logs", "db"]);
    expect(within(list).getByRole("tab", { name: "zsh" })).toHaveAttribute("aria-selected", "true");
  });

  it("activates a tab on click", async () => {
    const user = userEvent.setup();
    render(<TabStrip />);
    await user.click(screen.getByRole("tab", { name: "logs" }));
    expect(actions.setActiveTab).toHaveBeenCalledWith("t2");
  });

  it("is reachable with Tab and switches tabs with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<TabStrip />);
    await user.tab();
    expect(screen.getByRole("tab", { name: "zsh" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "logs" })).toHaveFocus();
    expect(actions.setActiveTab).toHaveBeenCalledWith("t2");
  });

  it("closes the focused tab with Delete and from its close button", async () => {
    const user = userEvent.setup();
    render(<TabStrip />);
    await user.tab();
    await user.keyboard("{Delete}");
    expect(actions.removeTab).toHaveBeenCalledWith("t1");
    await user.click(screen.getByRole("button", { name: "Close logs" }));
    expect(actions.removeTab).toHaveBeenCalledWith("t2");
  });

  it("renames with F2 and Enter", async () => {
    const user = userEvent.setup();
    render(<TabStrip />);
    await user.tab();
    await user.keyboard("{F2}");
    const input = screen.getByRole("textbox", { name: "Tab name" });
    expect(input).toHaveFocus();
    await user.clear(input);
    await user.keyboard("build{Enter}");
    expect(actions.renameTab).toHaveBeenCalledWith("t1", "build");
  });

  it("opens the context menu with shortcut hints on right-click", async () => {
    render(<TabStrip />);
    fireEvent.contextMenu(screen.getByRole("tab", { name: "logs" }), { clientX: 20, clientY: 10 });
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: /Rename Tab/ })).toBeInTheDocument();
    const close = within(menu).getByRole("menuitem", { name: /^Close Tab(?!s)/ });
    expect(within(close).getByLabelText("Ctrl+W")).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /Move Left/ })).not.toHaveAttribute("data-disabled");
  });

  it("starts a tab with the default shell and offers other shells in a menu", async () => {
    const user = userEvent.setup();
    render(<TabStrip />);
    await user.click(screen.getByRole("button", { name: /^New tab/ }));
    expect(actions.addTab).toHaveBeenCalledTimes(1);

    screen.getByRole("button", { name: "Choose shell" }).focus();
    await user.keyboard("{Enter}");
    const menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    expect(items.length).toBeGreaterThan(0);
    await user.keyboard("{Enter}");
    await waitFor(() => expect(actions.addTab).toHaveBeenCalledTimes(2));
  });
});
