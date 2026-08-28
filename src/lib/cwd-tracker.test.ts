import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTerminalStore } from "../stores/terminal";
import type { TerminalPane } from "../types/terminal";

vi.mock("./ipc", () => ({ terminalCwd: vi.fn() }));
import { terminalCwd } from "./ipc";
import { startCwdTracking } from "./cwd-tracker";

const pane = (over: Partial<TerminalPane> = {}): TerminalPane => ({
  id: "p1",
  sessionId: "s1",
  isActive: true,
  cwd: "",
  shellType: "zsh",
  ...over,
});

function seed(p: TerminalPane) {
  useTerminalStore.setState({ panes: { [p.id]: p }, activePaneId: p.id });
}

describe("startCwdTracking", () => {
  let stop: () => void;
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    stop?.();
    vi.useRealTimers();
  });

  it("updates the active pane's cwd from the backend, for zsh too", async () => {
    seed(pane());
    vi.mocked(terminalCwd).mockResolvedValue("/Users/me/repo");
    stop = startCwdTracking(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(terminalCwd).toHaveBeenCalledWith("s1");
    expect(useTerminalStore.getState().panes.p1.cwd).toBe("/Users/me/repo");
  });

  it("keeps the previous cwd when the backend cannot tell", async () => {
    seed(pane({ cwd: "/old" }));
    vi.mocked(terminalCwd).mockResolvedValue(null);
    stop = startCwdTracking(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(useTerminalStore.getState().panes.p1.cwd).toBe("/old");
  });

  it("skips panes without a session and SSH panes (the local pty cwd is not the remote one)", async () => {
    seed(pane({ sessionId: "" }));
    stop = startCwdTracking(1000);
    await vi.advanceTimersByTimeAsync(2000);
    stop();
    seed(pane({ sshConnectionId: "c1" }));
    stop = startCwdTracking(1000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(terminalCwd).not.toHaveBeenCalled();
  });

  it("stops polling after stop()", async () => {
    seed(pane());
    vi.mocked(terminalCwd).mockResolvedValue("/a");
    stop = startCwdTracking(1000);
    stop();
    await vi.advanceTimersByTimeAsync(3000);
    expect(terminalCwd).not.toHaveBeenCalled();
  });
});
