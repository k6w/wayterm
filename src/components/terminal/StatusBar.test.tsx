import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import StatusBar from "./StatusBar";
import { useTerminalStore } from "../../stores/terminal";
import { useSettingsStore } from "../../stores/settings";
import { useThemeStore } from "../../stores/theme";

const toggleBroadcastMode = vi.fn();
const toggleCommandPalette = vi.fn();

beforeEach(() => {
  useThemeStore.setState(useThemeStore.getInitialState(), true);
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useTerminalStore.setState({
    tabs: [
      { id: "t1", title: "zsh", icon: "", shellType: "zsh", panes: { type: "pane", paneId: "p1" }, isActive: true },
    ],
    panes: {
      p1: { id: "p1", sessionId: "s1", isActive: true, cwd: "~", shellType: "zsh", shellPath: "/bin/zsh" },
    },
    activeTabId: "t1",
    activePaneId: "p1",
    broadcastMode: false,
    loggingPanes: new Set<string>(),
    toggleBroadcastMode,
    toggleCommandPalette,
  });
});

describe("StatusBar", () => {
  it("renders nothing without an active pane", () => {
    useTerminalStore.setState({ activePaneId: null });
    const { container } = render(<StatusBar />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is one toolbar navigated with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<StatusBar />);
    const toolbar = screen.getByRole("toolbar", { name: "Status bar" });
    await user.tab();
    const first = within(toolbar).getByRole("button", { name: "zsh" });
    expect(first).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(within(toolbar).getByRole("button", { name: "~" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(within(toolbar).getByRole("button", { name: "Settings" })).toHaveFocus();
  });

  it("shows the shortcut of an action in its tooltip", async () => {
    const user = userEvent.setup();
    render(<StatusBar />);
    await user.tab();
    await user.keyboard("{End}{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Command palette" })).toHaveFocus();
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent(/^Command palette\s*Ctrl\s*Shift\s*P$/);
  });

  it("toggles broadcast and reflects its state", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<StatusBar />);
    const broadcast = screen.getByRole("button", { name: "Broadcast input to all panes" });
    expect(broadcast).toHaveAttribute("aria-pressed", "false");
    await user.click(broadcast);
    expect(toggleBroadcastMode).toHaveBeenCalledTimes(1);
    useTerminalStore.setState({ broadcastMode: true });
    rerender(<StatusBar />);
    expect(screen.getByRole("button", { name: "Broadcast input to all panes" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("shows a REC badge while the session is logged", () => {
    useTerminalStore.setState({ loggingPanes: new Set(["p1"]) });
    render(<StatusBar />);
    expect(screen.getByLabelText("Session logging active")).toHaveTextContent("REC");
  });
});

describe("StatusBar theme picker", () => {
  async function openPicker(user: ReturnType<typeof userEvent.setup>) {
    screen.getByRole("button", { name: "Theme: Graphite" }).focus();
    await user.keyboard("{Enter}");
    return screen.findByRole("menu");
  }

  it("lists the themes with the active one checked", async () => {
    const user = userEvent.setup();
    render(<StatusBar />);
    const menu = await openPicker(user);
    const items = within(menu).getAllByRole("menuitemradio");
    expect(items.map((i) => i.textContent)).toEqual(["Graphite", "Frost", "Ember", "Paper"]);
    expect(within(menu).getByRole("menuitemradio", { name: "Graphite" })).toHaveAttribute("aria-checked", "true");
  });

  it("previews while moving and reverts on Escape", async () => {
    const user = userEvent.setup();
    render(<StatusBar />);
    await openPicker(user);
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(useThemeStore.getState().previewThemeId).toBe("frost"));
    expect(useThemeStore.getState().active.id).toBe("frost");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(useThemeStore.getState().previewThemeId).toBeNull();
    expect(useThemeStore.getState().active.id).toBe("graphite");
    expect(invoke).not.toHaveBeenCalledWith("settings_set", expect.anything());
  });

  it("applies and saves the chosen theme", async () => {
    const user = userEvent.setup();
    render(<StatusBar />);
    await openPicker(user);
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    await waitFor(() => expect(useThemeStore.getState().activeThemeId).toBe("ember"));
    expect(useThemeStore.getState().active.id).toBe("ember");
    expect(useThemeStore.getState().previewThemeId).toBeNull();
    expect(invoke).toHaveBeenCalledWith("settings_set", { key: "appearance.themeId", value: "ember" });
  });
});

describe("StatusBar git branch", () => {
  it("renders a long branch on one line, middle-truncated, capped in width", async () => {
    const { useGitStore } = await import("../../stores/git");
    useTerminalStore.setState({
      panes: { p1: { id: "p1", sessionId: "s1", isActive: true, cwd: "/repo", shellType: "zsh", shellPath: "/bin/zsh" } },
    });
    useGitStore.setState({
      status: { branch: "x", ahead: 0, behind: 0, staged: [], modified: [], added: [], deleted: [], untracked: [], conflicted: 0, stashes: 0 },
      currentBranch: "redesign/phase-5-settings",
      fetchStatus: vi.fn(async () => true),
    });
    render(<StatusBar />);
    const label = screen.getByText("redesign/phase-5-settings");
    expect(label.parentElement).toHaveClass("whitespace-nowrap", "min-w-0", "max-w-48");
    expect(label.closest("[data-git-branch]")).toHaveClass("whitespace-nowrap", "shrink-0");
  });

  it("says when a pane's shell integration is inactive, with command blocks on", () => {
    useTerminalStore.setState((s) => ({ panes: { p1: { ...s.panes.p1, integrationInactive: true } } }));
    const { rerender } = render(<StatusBar />);
    expect(screen.getByText("Shell integration: inactive")).toBeInTheDocument();
    const settings = useSettingsStore.getState().settings;
    useSettingsStore.setState({ settings: { ...settings, terminal: { ...settings.terminal, commandBlocks: false } } });
    rerender(<StatusBar />);
    expect(screen.queryByText("Shell integration: inactive")).toBeNull();
  });
});
