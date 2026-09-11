import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuickActions from "./QuickActions";
import { useTerminalStore } from "../../stores/terminal";
import { OPEN_SSH_CONFIG_IMPORT } from "../ssh/ssh-config-import";

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

  it("opens the ~/.ssh/config import from the toolbar", async () => {
    const user = userEvent.setup();
    const listener = vi.fn();
    window.addEventListener(OPEN_SSH_CONFIG_IMPORT, listener);
    render(<QuickActions />);
    await user.click(screen.getByRole("button", { name: "Import from ~/.ssh/config" }));
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_SSH_CONFIG_IMPORT, listener);
  });
});
