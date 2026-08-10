import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuickActions from "./QuickActions";
import { useTerminalStore } from "../../stores/terminal";

const addTab = vi.fn(() => "t1");

beforeEach(() => {
  addTab.mockClear();
  useTerminalStore.setState({ addTab });
});

describe("QuickActions", () => {
  it("is the panel's toolbar: new terminal (with its shortcut) and new SSH", async () => {
    const user = userEvent.setup();
    const onNewSsh = vi.fn();
    render(<QuickActions onNewSsh={onNewSsh} />);
    expect(screen.getByRole("toolbar", { name: "Connection actions" })).toBeInTheDocument();
    const newTerminal = screen.getByRole("button", { name: /New terminal/ });
    expect(newTerminal.querySelector("kbd")).not.toBeNull();
    await user.click(newTerminal);
    expect(addTab).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "New SSH" }));
    expect(onNewSsh).toHaveBeenCalledTimes(1);
  });
});
