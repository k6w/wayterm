import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaneControls from "./PaneControls";
import { SearchBar } from "../search/SearchBar";

describe("PaneControls", () => {
  it("renders detach then close, both clickable", async () => {
    const onDetach = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<PaneControls searchOpen={false} onDetach={onDetach} onClose={onClose} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("title"))).toEqual(["Detach to tab", "Close pane"]);
    await user.click(buttons[0]);
    await user.click(buttons[1]);
    expect(onDetach).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("sits at the top edge when search is closed and below the search bar when open", () => {
    const { rerender } = render(<PaneControls searchOpen={false} onDetach={vi.fn()} onClose={vi.fn()} />);
    const group = screen.getByTestId("pane-controls");
    expect(group).toHaveClass("top-2");
    expect(group).not.toHaveAttribute("data-below-search");
    rerender(<PaneControls searchOpen onDetach={vi.fn()} onClose={vi.fn()} />);
    expect(group).toHaveClass("top-11");
    expect(group).not.toHaveClass("top-2");
    expect(group).toHaveAttribute("data-below-search");
  });

  it("is offset by at least the search bar height (h-9)", () => {
    render(
      <>
        <SearchBar terminalId="p" searchAddon={null} onClose={vi.fn()} />
        <PaneControls searchOpen onDetach={vi.fn()} onClose={vi.fn()} />
      </>
    );
    expect(screen.getByRole("search")).toHaveClass("h-9");
    // top-11 (44px) clears h-9 (36px) plus a gap.
    expect(screen.getByTestId("pane-controls")).toHaveClass("top-11");
  });
});
