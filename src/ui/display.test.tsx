import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Badge, EmptyState, Kbd, Spinner } from "./index";

describe("Kbd", () => {
  it("renders one chip per key with a readable label", () => {
    render(<Kbd shortcut="Control+Shift+p" mac={false} />);
    const kbd = screen.getByLabelText("Ctrl+Shift+P");
    expect(kbd.tagName).toBe("KBD");
    expect(kbd).toHaveTextContent("CtrlShiftP");
  });

  it("renders macOS glyphs", () => {
    render(<Kbd shortcut="Meta+w" mac />);
    expect(screen.getByLabelText("⌘W")).toHaveTextContent("⌘W");
  });

  it("is not focusable", () => {
    render(<Kbd shortcut="Control+t" mac={false} />);
    expect(screen.getByLabelText("Ctrl+T")).not.toHaveAttribute("tabindex");
  });
});

describe("Badge", () => {
  it("renders its tone through tokens", () => {
    render(<Badge tone="success">ok</Badge>);
    expect(screen.getByText("ok")).toHaveClass("bg-success-subtle", "text-success");
  });

  it("defaults to the neutral tone", () => {
    render(<Badge>3</Badge>);
    expect(screen.getByText("3")).toHaveClass("bg-hover");
  });
});

describe("Spinner", () => {
  it("announces itself as a status with a label", () => {
    render(<Spinner label="Connecting" />);
    expect(screen.getByRole("status", { name: "Connecting" })).toBeInTheDocument();
  });

  it("defaults the label to Loading", () => {
    render(<Spinner />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renders title, description and a keyboard-reachable action", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <EmptyState
        title="No connections"
        description="Add a host to get started"
        action={
          <button type="button" onClick={onClick}>
            Add host
          </button>
        }
      />
    );
    expect(screen.getByText("No connections")).toBeInTheDocument();
    expect(screen.getByText("Add a host to get started")).toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole("button", { name: "Add host" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
