import { beforeEach, describe, expect, it } from "vitest";
import { useTerminalStore } from "./terminal";

beforeEach(() => {
  useTerminalStore.setState({
    panes: { p1: { id: "p1", sessionId: "", isActive: true, cwd: "/gone", shellType: "zsh", checkCwd: true, startupCommands: ["ls"] } },
  });
});

describe("updatePane", () => {
  it("merges a patch into an existing pane", () => {
    useTerminalStore.getState().updatePane("p1", { cwd: "/home/me", checkCwd: false, notice: "moved" });
    expect(useTerminalStore.getState().panes.p1).toMatchObject({ cwd: "/home/me", checkCwd: false, notice: "moved", startupCommands: ["ls"] });
  });

  it("drops a field patched to undefined", () => {
    useTerminalStore.getState().updatePane("p1", { startupCommands: undefined });
    expect("startupCommands" in useTerminalStore.getState().panes.p1).toBe(false);
  });

  it("does not bring back a pane that was closed meanwhile", () => {
    useTerminalStore.getState().updatePane("ghost", { cwd: "/x" });
    expect(useTerminalStore.getState().panes.ghost).toBeUndefined();
  });
});
