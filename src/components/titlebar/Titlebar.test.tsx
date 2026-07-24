import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Titlebar from "./Titlebar";
import TabRail from "./TabRail";
import { useTerminalStore } from "../../stores/terminal";
import { useSettingsStore } from "../../stores/settings";
import type { AppearanceSettings } from "../../types/settings";

const toggleCommandPalette = vi.fn();
const toggleSettings = vi.fn();
const splitPane = vi.fn();

function setTabPosition(tabPosition: AppearanceSettings["tabPosition"]) {
  useSettingsStore.setState((s) => ({
    settings: { ...s.settings, appearance: { ...s.settings.appearance, tabPosition } },
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useTerminalStore.setState({
    tabs: [{ id: "t1", title: "zsh", icon: "", shellType: "zsh", panes: { type: "pane", paneId: "p1" }, isActive: true }],
    panes: { p1: { id: "p1", sessionId: "s1", isActive: true, cwd: "/tmp", shellType: "zsh", shellPath: "/bin/zsh" } },
    activeTabId: "t1",
    activePaneId: "p1",
    toggleCommandPalette,
    toggleSettings,
    splitPane,
  });
});

describe("Titlebar", () => {
  it("is one 36px bar with the tab strip and the window actions", () => {
    render(<Titlebar />);
    const bar = screen.getByRole("banner");
    expect(bar).toHaveClass("h-9");
    expect(within(bar).getByRole("tablist", { name: "Terminal tabs" })).toBeInTheDocument();
    expect(within(bar).getByRole("toolbar", { name: "Window actions" })).toBeInTheDocument();
  });

  it("opens the command palette from the search field and shows its shortcut", async () => {
    const user = userEvent.setup();
    render(<Titlebar />);
    const trigger = screen.getByRole("button", { name: /Search or run command/ });
    expect(within(trigger).getByLabelText("Ctrl+Shift+P")).toBeInTheDocument();
    await user.click(trigger);
    expect(toggleCommandPalette).toHaveBeenCalledTimes(1);
  });

  it("splits the active pane and opens settings", async () => {
    const user = userEvent.setup();
    render(<Titlebar />);
    await user.click(screen.getByRole("button", { name: "Split pane right" }));
    expect(splitPane).toHaveBeenCalledWith("p1", "horizontal", expect.objectContaining({ cwd: "/tmp" }));
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(toggleSettings).toHaveBeenCalledTimes(1);
  });

  it("disables split when there is no pane", () => {
    useTerminalStore.setState({ tabs: [], activeTabId: null, activePaneId: null });
    render(<Titlebar />);
    expect(screen.getByRole("button", { name: "Split pane right" })).toBeDisabled();
  });

  it("moves between its actions with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Titlebar />);
    screen.getByRole("button", { name: /Search or run command/ }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Split pane right" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Settings" })).toHaveFocus();
  });

  it("shows the split shortcut in its tooltip", async () => {
    const user = userEvent.setup();
    render(<Titlebar />);
    screen.getByRole("button", { name: /Search or run command/ }).focus();
    await user.keyboard("{ArrowRight}");
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/^Split pane right\s*Ctrl\s*Shift\s*D$/);
  });

  it("has window controls off macOS", () => {
    render(<Titlebar />);
    expect(screen.getByRole("button", { name: "Minimize" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("leaves the tabs to the rail when they are not along the top", () => {
    setTabPosition("left");
    render(
      <>
        <Titlebar />
        <TabRail />
      </>
    );
    expect(within(screen.getByRole("banner")).queryByRole("tablist")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("tab-rail")).getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Window actions" })).toBeInTheDocument();
  });

  it("renders no rail when tabs are along the top", () => {
    render(<TabRail />);
    expect(screen.queryByTestId("tab-rail")).not.toBeInTheDocument();
  });
});
