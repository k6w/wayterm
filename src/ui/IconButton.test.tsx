import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Plus } from "lucide-react";
import { IconButton } from "./index";

describe("IconButton", () => {
  it("uses its label as the accessible name", () => {
    render(<IconButton label="New tab" icon={<Plus />} />);
    expect(screen.getByRole("button", { name: "New tab" })).toBeInTheDocument();
  });

  it("shows the label and shortcut in a tooltip on focus", async () => {
    const user = userEvent.setup();
    render(<IconButton label="New tab" icon={<Plus />} shortcut="Control+t" />);
    await user.tab();
    expect(screen.getByRole("button", { name: "New tab" })).toHaveFocus();
    const tooltip = await screen.findByRole("tooltip");
    // Kbd renders one chip per key: "Ctrl" "T"
    expect(tooltip).toHaveTextContent(/^New tab\s*Ctrl\s*T$/);
  });

  it("activates with the keyboard", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<IconButton label="New tab" icon={<Plus />} onClick={onClick} />);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("exposes toggle state through aria-pressed", () => {
    render(<IconButton label="Broadcast" icon={<Plus />} pressed />);
    expect(screen.getByRole("button", { name: "Broadcast" })).toHaveAttribute("aria-pressed", "true");
  });

  it("can drop the tooltip", async () => {
    const user = userEvent.setup();
    render(<IconButton label="Close" icon={<Plus />} tooltip={false} />);
    await user.tab();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
