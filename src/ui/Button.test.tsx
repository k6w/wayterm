import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./index";

describe("Button", () => {
  it("calls onClick on click, Enter and Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    await user.click(button);
    expect(button).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("shows a visible focus ring when focused from the keyboard", async () => {
    const user = userEvent.setup();
    render(<Button>Save</Button>);
    await user.tab();
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveFocus();
    expect(button.className).toContain("focus-visible:outline-focus");
  });

  it("is skipped by Tab and ignores clicks when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <Button disabled onClick={onClick}>
          Off
        </Button>
        <Button>On</Button>
      </>
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "On" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Off" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("disables itself and reports busy while loading", () => {
    render(<Button loading>Connect</Button>);
    const button = screen.getByRole("button", { name: /Connect/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status", { name: "Working" })).toBeInTheDocument();
  });

  it("renders a shortcut hint", () => {
    render(<Button shortcut="Control+s">Save</Button>);
    expect(screen.getByLabelText("Ctrl+S").tagName).toBe("KBD");
  });

  it("styles variants with tokens", () => {
    render(<Button variant="primary">Go</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-accent", "text-fg-on-accent");
  });
});
