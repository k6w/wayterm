import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SearchAddon } from "@xterm/addon-search";
import { SearchBar } from "./SearchBar";
import { useThemeStore } from "../../stores/theme";

type ResultsListener = (event: { resultIndex: number; resultCount: number }) => void;

function fakeAddon() {
  let listener: ResultsListener = () => {};
  const dispose = vi.fn();
  const addon = {
    findNext: vi.fn(() => true),
    findPrevious: vi.fn(() => true),
    clearDecorations: vi.fn(),
    onDidChangeResults: vi.fn((cb: ResultsListener) => {
      listener = cb;
      return { dispose };
    }),
  };
  return {
    addon,
    dispose,
    report: (resultIndex: number, resultCount: number) => act(() => listener({ resultIndex, resultCount })),
  };
}

beforeEach(() => {
  useThemeStore.setState(useThemeStore.getInitialState(), true);
});

function renderBar() {
  const fake = fakeAddon();
  const onClose = vi.fn();
  const view = render(
    <SearchBar terminalId="p1" searchAddon={fake.addon as unknown as SearchAddon} onClose={onClose} />
  );
  return { user: userEvent.setup(), onClose, ...fake, ...view };
}

describe("SearchBar", () => {
  it("focuses the search field on open", () => {
    renderBar();
    expect(screen.getByRole("textbox", { name: "Find in terminal" })).toHaveFocus();
  });

  it("searches as you type with theme-colored highlights", async () => {
    const { user, addon } = renderBar();
    await user.keyboard("err");
    const chrome = useThemeStore.getState().active.chrome;
    expect(addon.findNext).toHaveBeenLastCalledWith(
      "err",
      expect.objectContaining({
        incremental: true,
        caseSensitive: false,
        decorations: expect.objectContaining({ matchBorder: chrome.warning, activeMatchBorder: chrome.accent }),
      })
    );
  });

  it("shows the match count the addon reports", async () => {
    const { user, report } = renderBar();
    await user.keyboard("err");
    report(2, 12);
    expect(screen.getByText("3 of 12")).toBeInTheDocument();
    report(-1, 0);
    expect(screen.getByText("No results")).toBeInTheDocument();
  });

  it("steps with Enter and Shift+Enter", async () => {
    const { user, addon } = renderBar();
    await user.keyboard("err");
    addon.findNext.mockClear();
    await user.keyboard("{Enter}");
    expect(addon.findNext).toHaveBeenCalledWith("err", expect.objectContaining({ incremental: false }));
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(addon.findPrevious).toHaveBeenCalledWith("err", expect.anything());
  });

  it("is one toolbar whose tooltips show the keys for previous, next and close", async () => {
    const { user } = renderBar();
    await user.keyboard("err");
    await user.tab();
    expect(screen.getByRole("button", { name: "Match case" })).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("button", { name: "Previous match" })).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/^Previous match\s*Shift\s*↵$/);
    await user.keyboard("{ArrowRight}");
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/^Next match\s*↵$/);
    await user.keyboard("{End}");
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/^Close search\s*Esc$/);
  });

  it("disables next and previous until there is a query", () => {
    renderBar();
    expect(screen.getByRole("button", { name: "Next match" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous match" })).toBeDisabled();
  });

  it("re-runs the search when an option is toggled", async () => {
    const { user, addon } = renderBar();
    await user.keyboard("err");
    const matchCase = screen.getByRole("button", { name: "Match case" });
    await user.click(matchCase);
    expect(matchCase).toHaveAttribute("aria-pressed", "true");
    expect(addon.findNext).toHaveBeenLastCalledWith("err", expect.objectContaining({ caseSensitive: true }));
  });

  it("clears highlights and the count when the query is emptied", async () => {
    const { user, addon, report } = renderBar();
    await user.keyboard("e");
    report(0, 3);
    await user.keyboard("{Backspace}");
    expect(addon.clearDecorations).toHaveBeenCalled();
    expect(screen.queryByText("1 of 3")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const { user, onClose, addon } = renderBar();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(addon.clearDecorations).toHaveBeenCalled();
  });

  it("clears highlights when it unmounts, however it was closed", () => {
    const { addon, dispose, unmount } = renderBar();
    unmount();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(addon.clearDecorations).toHaveBeenCalledTimes(1);
  });
});
