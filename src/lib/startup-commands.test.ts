import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStartupRunner } from "./startup-commands";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("startup runner for a local shell", () => {
  it("types each command with a carriage return once the shell has gone quiet after its first output", () => {
    const send = vi.fn();
    const runner = createStartupRunner({ commands: ["cd app", "npm run dev"], send });
    vi.advanceTimersByTime(300);
    expect(send).not.toHaveBeenCalled(); // no output yet: the shell is not up
    runner.output("user@host ~ % ");
    vi.advanceTimersByTime(399);
    expect(send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenNthCalledWith(1, "cd app\r");
    vi.advanceTimersByTime(60);
    expect(send).toHaveBeenNthCalledWith(2, "npm run dev\r");
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("waits while the shell is still printing", () => {
    const send = vi.fn();
    const runner = createStartupRunner({ commands: ["ls"], send });
    runner.output("motd line 1\n");
    vi.advanceTimersByTime(300);
    runner.output("motd line 2\n");
    vi.advanceTimersByTime(300);
    expect(send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(send).toHaveBeenCalledWith("ls\r");
  });

  it("runs only once, even if output keeps arriving", () => {
    const send = vi.fn();
    const runner = createStartupRunner({ commands: ["ls"], send });
    runner.output("$ ");
    vi.advanceTimersByTime(1000);
    runner.output("more");
    vi.advanceTimersByTime(1000);
    expect(send).toHaveBeenCalledTimes(1);
    expect(runner.done).toBe(true);
  });

  it("falls back to running after a maximum wait if the shell never prints anything", () => {
    const send = vi.fn();
    createStartupRunner({ commands: ["ls"], send, maxWaitMs: 2000 });
    vi.advanceTimersByTime(1999);
    expect(send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledWith("ls\r");
  });

  it("sends nothing after dispose", () => {
    const send = vi.fn();
    const runner = createStartupRunner({ commands: ["ls"], send });
    runner.output("$ ");
    runner.dispose();
    vi.advanceTimersByTime(5000);
    expect(send).not.toHaveBeenCalled();
  });

  it("does nothing for an empty list", () => {
    const send = vi.fn();
    const runner = createStartupRunner({ commands: [], send });
    runner.output("$ ");
    vi.advanceTimersByTime(5000);
    expect(send).not.toHaveBeenCalled();
    expect(runner.done).toBe(true);
  });
});

describe("startup runner for ssh", () => {
  it("does not run while connecting, however quiet the connection is", () => {
    const send = vi.fn();
    const runner = createStartupRunner({ commands: ["uptime"], send, ssh: true });
    runner.output("Connecting...\n");
    vi.advanceTimersByTime(60_000);
    expect(send).not.toHaveBeenCalled();
    runner.connected();
    vi.advanceTimersByTime(400);
    expect(send).toHaveBeenCalledWith("uptime\r");
  });

  it("holds off at a password prompt until the user answered and the host stopped asking", () => {
    const send = vi.fn();
    const runner = createStartupRunner({ commands: ["uptime"], send, ssh: true });
    runner.output("me@box's password: ");
    runner.authPrompt();
    vi.advanceTimersByTime(60_000);
    expect(send).not.toHaveBeenCalled();

    runner.input();
    runner.output("\r\n");
    runner.output("Permission denied, please try again.\r\nme@box's password: ");
    vi.advanceTimersByTime(60_000);
    expect(send).not.toHaveBeenCalled();

    runner.input();
    runner.output("Last login: Mon Oct  5\r\nme@box:~$ ");
    vi.advanceTimersByTime(1499);
    expect(send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledWith("uptime\r");
  });

  it("never runs if the process exits before it connected", () => {
    const send = vi.fn();
    const runner = createStartupRunner({ commands: ["uptime"], send, ssh: true });
    runner.dispose();
    runner.connected();
    vi.advanceTimersByTime(5000);
    expect(send).not.toHaveBeenCalled();
  });
});
