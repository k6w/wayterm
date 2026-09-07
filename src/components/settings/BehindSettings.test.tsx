import { beforeEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { BehindSettings } from "./BehindSettings";
import { useTerminalStore } from "../../stores/terminal";

beforeEach(() => {
  useTerminalStore.setState(useTerminalStore.getInitialState(), true);
});

let mounts = 0;
let unmounts = 0;
function FakeTerminal() {
  useEffect(() => {
    mounts++;
    return () => {
      unmounts++;
    };
  }, []);
  return <div data-testid="terminal">scrollback</div>;
}

describe("BehindSettings", () => {
  it("hides the app layout while Settings is open without unmounting terminals", () => {
    mounts = 0;
    unmounts = 0;
    render(
      <BehindSettings>
        <FakeTerminal />
      </BehindSettings>
    );
    const terminal = screen.getByTestId("terminal");
    const wrapper = terminal.parentElement as HTMLElement;
    expect(wrapper).not.toHaveClass("invisible");

    act(() => useTerminalStore.setState({ settingsOpen: true }));
    // visibility:hidden, not display:none: the layout keeps its size so xterm does not refit.
    expect(wrapper).toHaveClass("invisible");
    expect(wrapper).not.toHaveClass("hidden");
    expect(screen.getByTestId("terminal")).toBe(terminal);

    act(() => useTerminalStore.setState({ settingsOpen: false }));
    expect(wrapper).not.toHaveClass("invisible");
    expect(screen.getByTestId("terminal")).toBe(terminal);
    expect(mounts).toBe(1);
    expect(unmounts).toBe(0);
  });
});
