/// <reference types="vite/client" />
import { describe, expect, it, vi } from "vitest";
import { Terminal } from "@xterm/xterm";
import { BlockTracker, parseOsc7, type Block } from "./block-tracker";

// Fixtures are raw `script -q` recordings of Nexterm's integration scripts in
// real shells (80x24, HOME=/home/user, nonce "fixture-nonce").
const NONCE = "fixture-nonce";

const fixtures = import.meta.glob<string>("./__fixtures__/*.txt", { query: "?raw", import: "default", eager: true });

function fixture(name: string): string {
  const data = fixtures[`./__fixtures__/${name}.txt`];
  if (data === undefined) throw new Error(`no fixture ${name}`);
  return data;
}

function makeTerm(scrollback = 1000) {
  return new Terminal({ cols: 80, rows: 24, scrollback, allowProposedApi: true });
}

function write(term: Terminal, data: string | Uint8Array): Promise<void> {
  return new Promise((resolve) => term.write(data, resolve));
}

async function track(name: string, nonce: string | null = NONCE, onCwd?: (cwd: string) => void) {
  const term = makeTerm();
  const tracker = new BlockTracker(term, nonce, { onCwd });
  await write(term, fixture(name));
  return { term, tracker };
}

/** Adds this session's nonce to the A, C and D marks in `data`, as our scripts send them. */
function sign(data: string): string {
  const [head, ...marks] = data.split("\x1b]133;");
  return [
    head,
    ...marks.map((m) => {
      const end = m.indexOf("\x07");
      const body = m.slice(0, end);
      return "ACD".includes(m[0]) && !body.includes("nx=") ? `${body};nx=${NONCE}${m.slice(end)}` : m;
    }),
  ].join("\x1b]133;");
}

const summary = (tracker: BlockTracker, b: Block) => ({
  command: tracker.getCommandText(b),
  output: tracker.getOutputText(b),
  exitCode: b.exitCode,
  state: b.state,
});

describe("BlockTracker on recorded zsh", () => {
  it("splits a themed two-line prompt session into blocks", async () => {
    const { tracker } = await track("zsh-theme");
    expect(tracker.active).toBe(true);
    expect(tracker.blocks.map((b) => summary(tracker, b))).toEqual([
      { command: "echo hello", output: "hello", exitCode: 0, state: "done" },
      { command: "false", output: "", exitCode: 1, state: "done" },
      { command: "cd 'my dir'", output: "", exitCode: 0, state: "done" },
      { command: "printf 'one\\ntwo\\nthree\\n'", output: "one\ntwo\nthree", exitCode: 0, state: "done" },
      { command: "cd", output: "", exitCode: 0, state: "done" },
      { command: "exit", output: "", exitCode: undefined, state: "running" },
    ]);
    expect(tracker.blocks.every((b) => b.trusted)).toBe(true);
    expect(tracker.blocks.map((b) => b.cwd)).toEqual([
      "/home/user",
      "/home/user",
      "/home/user",
      "/home/user/my dir",
      "/home/user/my dir",
      "/home/user",
    ]);
    for (const b of tracker.blocks.slice(0, 5)) {
      expect(b.startedAt).toBeTypeOf("number");
      expect(b.endedAt).toBeGreaterThanOrEqual(b.startedAt!);
    }
  });

  it("reports cwd changes from OSC 7", async () => {
    const onCwd = vi.fn();
    await track("zsh-theme", NONCE, onCwd);
    expect(onCwd).toHaveBeenCalledWith("/home/user/my dir");
    expect(onCwd).toHaveBeenLastCalledWith("/home/user");
  });

  it("keeps Ctrl+C'd commands and drops prompts abandoned with Ctrl+C", async () => {
    const { tracker } = await track("ctrl-c");
    expect(tracker.blocks.map((b) => summary(tracker, b))).toEqual([
      { command: "sleep 5", output: "^C", exitCode: 130, state: "done" },
      { command: "echo after", output: "after", exitCode: 0, state: "done" },
      { command: "exit", output: "", exitCode: undefined, state: "running" },
    ]);
  });

  it("treats a shell without integration inside a block as that block's output", async () => {
    const { tracker } = await track("nested-shell");
    expect(tracker.blocks.map((b) => summary(tracker, b))).toEqual([
      { command: "echo outer", output: "outer", exitCode: 0, state: "done" },
      { command: "/bin/sh", output: "sh-3.2$ echo inner\ninner\nsh-3.2$ exit 4\nexit", exitCode: 4, state: "done" },
      { command: "echo back", output: "back", exitCode: 0, state: "done" },
      { command: "exit", output: "", exitCode: undefined, state: "running" },
    ]);
  });

  it("drops the blocks a clear wiped from the screen", async () => {
    const { tracker } = await track("clear");
    expect(tracker.blocks.map((b) => tracker.getCommandText(b))).toEqual(["echo two", "exit"]);
    expect(tracker.getOutputText(tracker.blocks[0])).toBe("two");
  });
});

describe("BlockTracker on recorded bash", () => {
  for (const name of ["bash5", "bash32"]) {
    it(`reads ${name} commands from the screen`, async () => {
      const { tracker } = await track(name);
      expect(tracker.blocks.map((b) => summary(tracker, b))).toEqual([
        { command: "echo hello", output: "hello", exitCode: 0, state: "done" },
        { command: "false", output: "", exitCode: 1, state: "done" },
        { command: "cd 'my dir'", output: "", exitCode: 0, state: "done" },
        { command: "printf 'one\\ntwo\\nthree\\n'", output: "one\ntwo\nthree", exitCode: 0, state: "done" },
        { command: "cd", output: "", exitCode: 0, state: "done" },
        { command: "exit", output: "exit", exitCode: undefined, state: "running" },
      ]);
      expect(tracker.blocks.every((b) => b.trusted && b.command === undefined)).toBe(true);
    });
  }
});

describe("BlockTracker trust", () => {
  it("ignores every mark signed with another nonce", async () => {
    const { tracker } = await track("zsh-theme", "the-real-nonce");
    expect(tracker.active).toBe(false);
    expect(tracker.blocks).toHaveLength(0);
  });

  for (const name of ["spoof-zsh", "spoof-bash"]) {
    it(`is not fooled by fake prompt, command and exit marks in output (${name})`, async () => {
      const { tracker } = await track(name);
      const blocks = tracker.blocks.map((b) => summary(tracker, b));
      expect(blocks.map((b) => b.command)).toEqual([
        "echo before",
        expect.stringMatching(/^printf '\\033\]133;D;0/),
        "echo after",
        "exit",
      ]);
      expect(blocks[1].output).toBe("fake$ \ntail");
      expect(blocks[1].exitCode).toBe(0);
      expect(tracker.blocks.every((b) => b.trusted)).toBe(true);
    });
  }

  it("does not trust anything without a nonce", async () => {
    const { tracker } = await track("bash5", null);
    expect(tracker.blocks.some((b) => b.trusted)).toBe(false);
  });

  it("ignores a spoofed command report printed by a running command", async () => {
    const term = makeTerm();
    const tracker = new BlockTracker(term, NONCE);
    await write(term, sign("\x1b]133;A\x07$ \x1b]133;B\x07cat evil\r\n\x1b]133;C;cmdline_url=cat%20evil;nx=fixture-nonce\x07"));
    await write(term, "\x1b]133;C;cmdline_url=rm%20-rf%20~;nx=guess\x07text\r\n");
    expect(tracker.blocks).toHaveLength(1);
    expect(tracker.getCommandText(tracker.blocks[0])).toBe("cat evil");
    expect(tracker.blocks[0].trusted).toBe(true);
  });

  it("uses only the signed marks when the shell also sends its own (fish 4)", async () => {
    const term = makeTerm();
    const tracker = new BlockTracker(term, NONCE);
    await write(term, `\x1b]133;A;click_events=1\x07\x1b]133;A;nx=${NONCE}\x07> \x1b]133;B\x07ls\r\n`);
    await write(term, `\x1b]133;C;cmdline_url=ls\x07\x1b]133;C;cmdline_url=ls;nx=${NONCE}\x07a b\r\n`);
    await write(term, `\x1b]133;D;0\x07\x1b]133;D;0;nx=${NONCE}\x07\x1b]133;A;click_events=1\x07\x1b]133;A;nx=${NONCE}\x07> `);
    expect(tracker.blocks.map((b) => summary(tracker, b))).toEqual([
      { command: "ls", output: "a b", exitCode: 0, state: "done" },
      { command: "", output: "", exitCode: undefined, state: "prompt" },
    ]);
    expect(tracker.blocks[0].trusted).toBe(true);
  });

  it("caps the stored command line", async () => {
    const term = makeTerm();
    const tracker = new BlockTracker(term, NONCE);
    await write(term, sign(`\x1b]133;A\x07$ \x1b]133;C;cmdline_url=${"x".repeat(5000)};nx=${NONCE}\x07`));
    expect(tracker.blocks[0].command).toHaveLength(4096);
  });
});

describe("parseOsc7", () => {
  it("decodes the path and ignores the host", () => {
    expect(parseOsc7("file://host/home/user/my%20dir")).toBe("/home/user/my dir");
    expect(parseOsc7("file:///tmp/%C3%A9")).toBe("/tmp/é");
  });

  it("rejects anything else", () => {
    expect(parseOsc7("http://host/x")).toBeUndefined();
    expect(parseOsc7("file://host")).toBeUndefined();
    expect(parseOsc7("file://host/%E0%A4%A")).toBeUndefined();
  });
});

describe("BlockTracker state machine", () => {
  it("is inactive until the first prompt mark", async () => {
    const term = makeTerm();
    const tracker = new BlockTracker(term, NONCE);
    await write(term, "plain shell $ ls\r\n\x1b]133;D;0\x07");
    expect(tracker.active).toBe(false);
    expect(tracker.blocks).toHaveLength(0);
    await write(term, sign("\x1b]133;A\x07"));
    expect(tracker.active).toBe(true);
  });

  it("ignores exit reports for prompts that ran nothing", async () => {
    const term = makeTerm();
    const tracker = new BlockTracker(term, NONCE);
    await write(term, sign("\x1b]133;A\x07$ \x1b]133;B\x07\r\n\x1b]133;D;0\x07\x1b]133;A\x07$ "));
    expect(tracker.blocks).toHaveLength(1);
    expect(tracker.blocks[0].state).toBe("prompt");
  });

  it("does not add a block when a prompt is redrawn on the same line", async () => {
    const term = makeTerm();
    const tracker = new BlockTracker(term, NONCE);
    await write(term, sign("\x1b]133;A\x07$ \x1b]133;B\x07\r\x1b]133;A\x07$ \x1b]133;B\x07"));
    expect(tracker.blocks).toHaveLength(1);
    expect(tracker.blocks[0].state).toBe("input");
  });

  it("records only times on the alternate screen", async () => {
    const term = makeTerm();
    const tracker = new BlockTracker(term, NONCE);
    await write(term, sign("\x1b]133;A\x07$ \x1b]133;B\x07vim\r\n\x1b]133;C;cmdline_url=vim;nx=fixture-nonce\x07\x1b[?1049h"));
    await write(term, sign("\x1b]133;A\x07\x1b]133;D;2\x07"));
    expect(tracker.blocks).toHaveLength(1);
    expect(tracker.blocks[0].exitCode).toBe(2);
    expect(tracker.blocks[0].endedAt).toBeTypeOf("number");
    expect(tracker.blocks[0].end).toBeUndefined();
  });

  it("finds the block at a buffer line", async () => {
    const { tracker } = await track("bash5");
    const [first, second] = tracker.blocks;
    expect(tracker.blockAtLine(first.promptStart.line)).toBe(first);
    expect(tracker.blockAtLine(first.promptStart.line + 1)).toBe(first);
    expect(tracker.blockAtLine(second.promptStart.line)).toBe(second);
    expect(tracker.blockAtLine(first.promptStart.line - 1)).toBeUndefined();
    expect(tracker.blockAtLine(10_000)).toBe(tracker.blocks[tracker.blocks.length - 1]);
  });

  it("notifies subscribers on changes", async () => {
    const term = makeTerm();
    const tracker = new BlockTracker(term, NONCE);
    const fn = vi.fn();
    const unsubscribe = tracker.subscribe(fn);
    await write(term, sign("\x1b]133;A\x07"));
    expect(fn).toHaveBeenCalled();
    unsubscribe();
    fn.mockClear();
    await write(term, "\x1b]133;B\x07");
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("BlockTracker memory", () => {
  it("drops blocks and their markers when scrollback trims them", async () => {
    const term = makeTerm(50);
    const tracker = new BlockTracker(term, NONCE);
    await write(term, sign("\x1b]133;A\x07$ \x1b]133;B\x07seq\r\n\x1b]133;C;nx=fixture-nonce\x07"));
    const first = tracker.blocks[0];
    await write(term, Array.from({ length: 200 }, (_, i) => `${i}\r\n`).join(""));
    await write(term, sign("\x1b]133;D;0\x07\x1b]133;A\x07$ "));
    expect(tracker.blocks).toHaveLength(1);
    expect(tracker.blocks[0]).not.toBe(first);
    expect(first.promptStart.isDisposed).toBe(true);
    expect(first.outputStart?.isDisposed).toBe(true);
    // Dropped while running: its exit report then had no block to end.
    expect(first.end).toBeUndefined();
  });

  for (const how of ["clear", "reset"] as const) {
    it(`drops every block on term.${how}()`, async () => {
      const { term, tracker } = await track("bash5");
      const markers = tracker.blocks.map((b) => b.promptStart);
      term[how]();
      if (how === "reset") tracker.reset();
      await write(term, "");
      expect(tracker.blocks.filter((b) => b.promptStart.line >= 0)).toEqual([]);
      expect(markers.every((m) => m.isDisposed || m.line < 0)).toBe(true);
    });
  }

  it("drops every block when a program resets the terminal (RIS)", async () => {
    const { term, tracker } = await track("bash5");
    const markers = tracker.blocks.map((b) => b.promptStart);
    await write(term, "\x1bc");
    expect(tracker.blocks).toEqual([]);
    expect(markers.every((m) => m.isDisposed)).toBe(true);
  });

  it("keeps at most maxBlocks blocks", async () => {
    const term = makeTerm();
    const tracker = new BlockTracker(term, NONCE, { maxBlocks: 3 });
    for (let i = 0; i < 5; i++) {
      await write(term, sign(`\x1b]133;A\x07$ \x1b]133;B\x07c${i}\r\n\x1b]133;C;nx=fixture-nonce\x07\x1b]133;D;0\x07`));
    }
    expect(tracker.blocks.map((b) => tracker.getCommandText(b))).toEqual(["c2", "c3", "c4"]);
  });

  it("stops tracking after dispose", async () => {
    const term = makeTerm();
    const tracker = new BlockTracker(term, NONCE);
    await write(term, sign("\x1b]133;A\x07"));
    const marker = tracker.blocks[0].promptStart;
    tracker.dispose();
    await write(term, sign("\r\n\x1b]133;A\x07"));
    expect(tracker.blocks).toHaveLength(0);
    expect(marker.isDisposed).toBe(true);
  });
});

describe("BlockTracker selection and status", () => {
  it("selects, extends and moves through finished blocks", async () => {
    const { tracker } = await track("bash5");
    const [b0, b1, b2] = tracker.blocks;
    expect(tracker.moveSelection(-1)).toBe(tracker.blocks[5]);
    expect(tracker.moveSelection(-1)).toBe(tracker.blocks[4]);
    tracker.select(b1);
    tracker.select(b2, true);
    expect(tracker.selection).toEqual([b1, b2]);
    tracker.moveSelection(-1, true);
    tracker.moveSelection(-1, true);
    expect(tracker.selection).toEqual([b0, b1]);
    expect(tracker.moveSelection(-1)).toBe(b0);
    expect(tracker.selection).toEqual([b0]);
    tracker.clearSelection();
    expect(tracker.selection).toEqual([]);
    expect(tracker.moveSelection(1)).toBeUndefined();
  });

  it("forgets a selection whose blocks were dropped", async () => {
    const { term, tracker } = await track("bash5");
    tracker.select(tracker.blocks[0]);
    term.reset();
    tracker.reset();
    expect(tracker.selection).toEqual([]);
  });

  it("reports a pane whose shell never marked a prompt, until it does", async () => {
    const term = makeTerm();
    const tracker = new BlockTracker(term, NONCE);
    expect(tracker.integrated).toBe(true);
    tracker.markInactive();
    expect(tracker.inactive).toBe(true);
    await write(term, sign("\x1b]133;A\x07"));
    expect(tracker.inactive).toBe(false);
    tracker.markInactive();
    expect(tracker.inactive).toBe(false);
  });

  it("calls onCommandEnd with the finished block", async () => {
    const ended: Block[] = [];
    const term = makeTerm();
    new BlockTracker(term, NONCE, { onCommandEnd: (b) => ended.push(b) });
    await write(term, fixture("bash5"));
    expect(ended.map((b) => b.exitCode)).toEqual([0, 1, 0, 0, 0]);
  });

  it("bumps its version on every change", async () => {
    const term = makeTerm();
    const tracker = new BlockTracker(term, NONCE);
    const v = tracker.version;
    await write(term, sign("\x1b]133;A\x07"));
    expect(tracker.version).toBeGreaterThan(v);
  });
});
