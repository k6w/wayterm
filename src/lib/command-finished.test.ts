import { beforeEach, describe, expect, it, vi } from "vitest";
import { Terminal } from "@xterm/xterm";
import { BlockTracker, type Block } from "./blocks/block-tracker";
import { notifyCommandFinished, onBlockFinished } from "./command-finished";
import { useSettingsStore } from "../stores/settings";

vi.mock("./ipc", () => ({ historyAdd: vi.fn(async () => 1) }));
import { historyAdd } from "./ipc";

const notifications: { title: string; body: string }[] = [];
class FakeNotification {
  static permission = "granted";
  static requestPermission = vi.fn(async () => "granted");
  constructor(title: string, options: { body: string }) {
    notifications.push({ title, body: options.body });
  }
}

function settings(general: { notifyOnLongCommands: boolean; longCommandThresholdSeconds: number }, commandBlocks = true) {
  const s = useSettingsStore.getState().settings;
  useSettingsStore.setState({
    settings: { ...s, general: { ...s.general, ...general }, terminal: { ...s.terminal, commandBlocks } },
  });
}

beforeEach(() => {
  notifications.length = 0;
  vi.mocked(historyAdd).mockClear();
  vi.stubGlobal("Notification", FakeNotification);
  settings({ notifyOnLongCommands: true, longCommandThresholdSeconds: 10 });
});

describe("notifyCommandFinished", () => {
  it("notifies past the threshold, with the exit code when it failed", () => {
    notifyCommandFinished(9.9);
    notifyCommandFinished(12.2, 0);
    notifyCommandFinished(30, 2);
    expect(notifications.map((n) => n.body)).toEqual(["Completed in 12s", "Failed (exit 2) after 30s"]);
  });

  it("stays quiet when turned off", () => {
    settings({ notifyOnLongCommands: false, longCommandThresholdSeconds: 0 });
    notifyCommandFinished(100);
    expect(notifications).toEqual([]);
  });
});

describe("onBlockFinished", () => {
  async function finished(nonce: string | null, data: string): Promise<[BlockTracker, Block]> {
    const term = new Terminal({ cols: 80, rows: 24, allowProposedApi: true });
    let now = 0;
    let done: Block | undefined;
    const tracker = new BlockTracker(term, nonce, { now: () => (now += 20_000), onCommandEnd: (b) => (done = b) });
    await new Promise<void>((resolve) => term.write(data, resolve));
    return [tracker, done!];
  }

  it("notifies with the exact duration and records trusted commands in history", async () => {
    const [tracker, block] = await finished(
      "n",
      "\x1b]7;file://h/srv\x07\x1b]133;A;nx=n\x07$ \x1b]133;B\x07make\r\n\x1b]133;C;nx=n\x07\x1b]133;D;2;nx=n\x07",
    );
    onBlockFinished(tracker, block, "s1");
    expect(notifications.map((n) => n.body)).toEqual(["Failed (exit 2) after 20s"]);
    expect(historyAdd).toHaveBeenCalledWith("s1", "make", 2, "/srv");
  });

  it("keeps commands that could have been faked out of history", async () => {
    const [tracker, block] = await finished(
      null,
      "\x1b]133;A\x07$ \x1b]133;B\x07make\r\n\x1b]133;C\x07\x1b]133;D;0\x07",
    );
    onBlockFinished(tracker, block, "s1");
    expect(historyAdd).not.toHaveBeenCalled();
  });

  it("records nothing while command blocks are off", async () => {
    settings({ notifyOnLongCommands: false, longCommandThresholdSeconds: 10 }, false);
    const [tracker, block] = await finished("n", "\x1b]133;A;nx=n\x07$ \x1b]133;B\x07ls\r\n\x1b]133;C;nx=n\x07\x1b]133;D;0;nx=n\x07");
    onBlockFinished(tracker, block, "s1");
    expect(historyAdd).not.toHaveBeenCalled();
  });
});
