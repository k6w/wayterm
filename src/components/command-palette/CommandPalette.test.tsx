import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import CommandPalette from "./CommandPalette";
import { useTerminalStore } from "../../stores/terminal";
import { useSettingsStore } from "../../stores/settings";
import { useThemeStore } from "../../stores/theme";

vi.mock("../../lib/terminal-registry", () => ({
  clearBuffer: vi.fn(),
  resetTerminal: vi.fn(),
  writeToTerminal: vi.fn(),
  getCachedTerminal: vi.fn(),
  copySelection: vi.fn(),
  pasteToTerminal: vi.fn(),
}));

beforeEach(() => {
  useThemeStore.setState(useThemeStore.getInitialState(), true);
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useTerminalStore.setState({ commandPaletteOpen: true, activePaneId: "p1" });
});

async function openPalette() {
  const user = userEvent.setup();
  render(<CommandPalette />);
  const input = await screen.findByRole("combobox", { name: "Search commands" });
  return { user, input };
}

function activeOption(input: HTMLElement) {
  const id = input.getAttribute("aria-activedescendant");
  return id ? document.getElementById(id) : null;
}

describe("CommandPalette", () => {
  it("renders nothing while closed", () => {
    useTerminalStore.setState({ commandPaletteOpen: false });
    render(<CommandPalette />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens as a named dialog with focus in the search field", async () => {
    const { input } = await openPalette();
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it("groups commands under section labels and shows shortcuts as Kbd glyphs", async () => {
    await openPalette();
    const actions = screen.getByRole("group", { name: "Actions" });
    const split = within(actions).getByRole("option", { name: /Split Horizontal/ });
    expect(within(split).getByLabelText("Ctrl+Shift+D")).toBeInTheDocument();
    expect(split).not.toHaveTextContent("Control");
    expect(screen.getByRole("group", { name: "New Tab" })).toBeInTheDocument();
  });

  it("walks the options in the order they are shown, wrapping at both ends", async () => {
    const { user, input } = await openPalette();
    const options = screen.getAllByRole("option");
    expect(activeOption(input)).toBe(options[0]);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    for (let i = 1; i < options.length; i++) {
      await user.keyboard("{ArrowDown}");
      expect(activeOption(input)).toBe(options[i]);
    }
    await user.keyboard("{ArrowDown}");
    expect(activeOption(input)).toBe(options[0]);
    await user.keyboard("{ArrowUp}");
    expect(activeOption(input)).toBe(options[options.length - 1]);
  });

  it("filters as you type and shows an empty state when nothing matches", async () => {
    const { user, input } = await openPalette();
    await user.type(input, "scratch");
    expect(screen.getAllByRole("option").every((o) => /scratch/i.test(o.textContent ?? ""))).toBe(true);
    await user.clear(input);
    await user.type(input, "zzzz");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent('No matching commandsNothing matches "zzzz".');
  });

  it("runs the chosen command with Enter and closes", async () => {
    const opened = vi.fn();
    window.addEventListener("nexterm:open-serial", opened);
    const { user, input } = await openPalette();
    await user.type(input, "serial");
    await user.keyboard("{Enter}");
    expect(useTerminalStore.getState().commandPaletteOpen).toBe(false);
    await waitFor(() => expect(opened).toHaveBeenCalledTimes(1));
    window.removeEventListener("nexterm:open-serial", opened);
  });

  it("runs a command on click", async () => {
    const opened = vi.fn();
    window.addEventListener("nexterm:open-serial", opened);
    const { user } = await openPalette();
    await user.click(screen.getByRole("option", { name: /New Serial/ }));
    await waitFor(() => expect(opened).toHaveBeenCalledTimes(1));
    window.removeEventListener("nexterm:open-serial", opened);
  });

  it("closes on Escape", async () => {
    const { user } = await openPalette();
    await user.keyboard("{Escape}");
    expect(useTerminalStore.getState().commandPaletteOpen).toBe(false);
  });

  it("lists recent commands under History", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([{ id: 7, command: "git status", cwd: null }]);
    await openPalette();
    const history = await screen.findByRole("group", { name: "History" });
    expect(within(history).getByRole("option", { name: "git status" })).toBeInTheDocument();
  });

  describe("theme list", () => {
    async function openThemes() {
      const opened = await openPalette();
      await opened.user.type(opened.input, "change theme");
      await opened.user.keyboard("{Enter}");
      const input = screen.getByRole("combobox", { name: "Search themes" });
      return { ...opened, input };
    }

    it("previews themes with the arrow keys and persists the chosen one", async () => {
      const { user, input } = await openThemes();
      expect(input).toHaveValue("");
      expect(screen.getByRole("listbox", { name: "Themes" })).toBeInTheDocument();
      await user.keyboard("{ArrowDown}");
      expect(useThemeStore.getState().previewThemeId).toBe("frost");
      await user.keyboard("{Enter}");
      expect(useThemeStore.getState().activeThemeId).toBe("frost");
      expect(useTerminalStore.getState().commandPaletteOpen).toBe(false);
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith("settings_set", { key: "appearance.themeId", value: "frost" })
      );
    });

    it("drops the preview when the palette closes without a choice", async () => {
      const { user } = await openThemes();
      await user.keyboard("{ArrowDown}");
      expect(useThemeStore.getState().active.id).toBe("frost");
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(useThemeStore.getState().previewThemeId).toBeNull();
      expect(useThemeStore.getState().active.id).toBe("graphite");
      expect(invoke).not.toHaveBeenCalledWith("settings_set", expect.anything());
    });

    it("goes back to the commands with Backspace on an empty query, dropping the preview", async () => {
      const { user } = await openThemes();
      await user.keyboard("{ArrowDown}{Backspace}");
      expect(screen.getByRole("combobox", { name: "Search commands" })).toHaveFocus();
      expect(useThemeStore.getState().previewThemeId).toBeNull();
    });

    it("marks the current theme", async () => {
      await openThemes();
      expect(screen.getByRole("option", { name: /Graphite \(current\)/ })).toBeInTheDocument();
    });
  });

  describe("focus on close", () => {
    function renderWithPanes() {
      useTerminalStore.setState({ commandPaletteOpen: false, activePaneId: "p1" });
      const panes = render(
        <>
          <div data-pane-id="p1">
            <textarea aria-label="term-1" />
          </div>
          <div data-pane-id="p2">
            <textarea aria-label="term-2" />
          </div>
          <CommandPalette />
        </>
      );
      return panes;
    }

    it("returns focus to the terminal that had it before opening", async () => {
      const user = userEvent.setup();
      renderWithPanes();
      screen.getByLabelText("term-2").focus();
      act(() => useTerminalStore.setState({ commandPaletteOpen: true }));
      await screen.findByRole("combobox", { name: "Search commands" });
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.getByLabelText("term-2")).toHaveFocus());
    });

    it("falls back to the active terminal when nothing useful had focus", async () => {
      const user = userEvent.setup();
      renderWithPanes();
      (document.activeElement as HTMLElement | null)?.blur();
      act(() => useTerminalStore.setState({ commandPaletteOpen: true }));
      await screen.findByRole("combobox", { name: "Search commands" });
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.getByLabelText("term-1")).toHaveFocus());
    });

    it("goes to the active terminal when a button opened the palette", async () => {
      const user = userEvent.setup();
      renderWithPanes();
      const opener = document.createElement("button");
      document.body.appendChild(opener);
      opener.focus();
      act(() => useTerminalStore.setState({ commandPaletteOpen: true }));
      await screen.findByRole("combobox", { name: "Search commands" });
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.getByLabelText("term-1")).toHaveFocus());
      opener.remove();
    });
  });
});
