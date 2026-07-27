import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NoTabsState from "./NoTabsState";
import { useTerminalStore } from "../stores/terminal";
import { useSettingsStore } from "../stores/settings";

const toggleCommandPalette = vi.fn();

beforeEach(() => {
  toggleCommandPalette.mockClear();
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useTerminalStore.setState({ toggleCommandPalette });
});

describe("NoTabsState", () => {
  it("offers the three primary actions with their shortcuts", () => {
    render(<NoTabsState onNewTerminal={vi.fn()} onNewSsh={vi.fn()} />);
    expect(screen.getByText("No open tabs")).toBeInTheDocument();
    const terminal = screen.getByRole("button", { name: /New terminal/ });
    expect(within(terminal).getByLabelText("Ctrl+T")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New SSH connection/ })).toBeInTheDocument();
    const palette = screen.getByRole("button", { name: /Command palette/ });
    expect(within(palette).getByLabelText("Ctrl+Shift+P")).toBeInTheDocument();
  });

  it("runs each action", async () => {
    const user = userEvent.setup();
    const onNewTerminal = vi.fn();
    const onNewSsh = vi.fn();
    render(<NoTabsState onNewTerminal={onNewTerminal} onNewSsh={onNewSsh} />);
    await user.click(screen.getByRole("button", { name: /New terminal/ }));
    await user.click(screen.getByRole("button", { name: /New SSH connection/ }));
    await user.click(screen.getByRole("button", { name: /Command palette/ }));
    expect(onNewTerminal).toHaveBeenCalledTimes(1);
    expect(onNewSsh).toHaveBeenCalledTimes(1);
    expect(toggleCommandPalette).toHaveBeenCalledTimes(1);
  });

  it("puts New terminal first in tab order", async () => {
    const user = userEvent.setup();
    render(<NoTabsState onNewTerminal={vi.fn()} onNewSsh={vi.fn()} />);
    await user.tab();
    expect(screen.getByRole("button", { name: /New terminal/ })).toHaveFocus();
  });
});
