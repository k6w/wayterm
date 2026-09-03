import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaneControls from "./PaneControls";

describe("PaneControls", () => {
  it("renders detach then close, both clickable", async () => {
    const onDetach = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<PaneControls searchOpen={false} onDetach={onDetach} onClose={onClose} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual(["Detach to tab", "Close pane"]);
    await user.click(buttons[0]);
    await user.click(buttons[1]);
    expect(onDetach).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("is hidden until the pane is hovered, on a solid chip, and never latched by pane focus", () => {
    render(<PaneControls searchOpen={false} onDetach={vi.fn()} onClose={vi.fn()} />);
    const group = screen.getByTestId("pane-controls");
    expect(group).toHaveClass("opacity-0", "group-hover/pane:opacity-100", "focus-within:opacity-100");
    expect(group).toHaveClass("bg-raised", "absolute");
    // Terminal focus stays in the pane after the pointer leaves; it must not keep the chip shown.
    expect(group.className).not.toContain("group-focus-within/pane");
  });

  it("sits in the reserved top strip, clear of the first terminal row", () => {
    render(<PaneControls searchOpen={false} onDetach={vi.fn()} onClose={vi.fn()} />);
    const group = screen.getByTestId("pane-controls");
    expect(group).toHaveClass("top-0.5");
    expect(group).not.toHaveClass("top-2");
  });

  it("is not rendered while the search bar covers the top edge", () => {
    render(<PaneControls searchOpen onDetach={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByTestId("pane-controls")).toBeNull();
  });
});
