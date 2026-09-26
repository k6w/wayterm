import { beforeEach, describe, expect, it, vi } from "vitest";
import { Terminal } from "@xterm/xterm";
import { BlockTracker } from "./block-tracker";
import { blockText, canRerun, copyBlocks, rerunBlock, rerunInput, shareText } from "./block-actions";
import { removeCachedTerminal, setCachedTerminal, type CachedTerminal } from "../terminal-registry";
import { useClipboardStore } from "../../stores/clipboard";

vi.mock("../ipc", () => ({ terminalWrite: vi.fn(async () => {}), bufferSaveBatch: vi.fn(async () => {}) }));
import { terminalWrite } from "../ipc";

const NONCE = "n";
const A = `\x1b]133;A;nx=${NONCE}\x07`;
const B = "\x1b]133;B\x07";
const C = (cmd?: string) => `\x1b]133;C;${cmd ? `cmdline_url=${encodeURIComponent(cmd)};` : ""}nx=${NONCE}\x07`;
const D = (code: number) => `\x1b]133;D;${code};nx=${NONCE}\x07`;

async function setup(data: string) {
  const term = new Terminal({ cols: 80, rows: 24, allowProposedApi: true });
  let now = 0;
  const tracker = new BlockTracker(term, NONCE, { now: () => (now += 1200) });
  await new Promise<void>((resolve) => term.write(data, resolve));
  tracker.cwd = "/srv";
  setCachedTerminal("p1", { terminal: term, sessionId: "s1", blocks: tracker } as unknown as CachedTerminal);
  return { term, tracker };
}

beforeEach(() => {
  removeCachedTerminal("p1");
  useClipboardStore.setState({ entries: [] });
  Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } });
  vi.mocked(terminalWrite).mockClear();
});

describe("block text", () => {
  it("formats command, output, both and a shareable summary", async () => {
    const { tracker } = await setup(`${A}/srv $ ${B}ls\r\n${C("ls")}a\r\nb\r\n${D(2)}${A}$ `);
    const [b] = tracker.blocks;
    b.cwd = "/srv";
    expect(blockText(tracker, b, "command")).toBe("ls");
    expect(blockText(tracker, b, "output")).toBe("a\nb");
    expect(blockText(tracker, b, "both")).toBe("$ ls\na\nb");
    expect(shareText(tracker, b)).toBe("$ ls\na\nb\n[exit 2, 1.2s, /srv]");
  });

  it("copies every selected block and records it in clipboard history", async () => {
    const { tracker } = await setup(`${A}$ ${B}one\r\n${C("one")}1\r\n${D(0)}${A}$ ${B}two\r\n${C("two")}2\r\n${D(0)}${A}$ `);
    tracker.select(tracker.blocks[0]);
    tracker.select(tracker.blocks[1], true);
    expect(copyBlocks("p1", "output")).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("1\n\n2");
    expect(useClipboardStore.getState().entries[0].content).toBe("1\n\n2");
  });
});

describe("re-run", () => {
  it("runs a trusted command and only pastes an untrusted one", () => {
    expect(rerunInput("ls -l", { bracketed: true, execute: true })).toBe("\x1b[200~ls -l\x1b[201~\r");
    expect(rerunInput("ls -l", { bracketed: true, execute: false })).toBe("\x1b[200~ls -l\x1b[201~");
  });

  it("strips control characters that could break out of the paste", () => {
    expect(rerunInput("echo \x1b[201~; rm -rf ~\x07", { bracketed: true, execute: false })).toBe(
      "\x1b[200~echo [201~; rm -rf ~\x1b[201~",
    );
  });

  it("never lets an unbracketed paste run lines early", () => {
    expect(rerunInput("a\nb", { bracketed: false, execute: false })).toBe("a b");
    expect(rerunInput("a\nb", { bracketed: false, execute: true })).toBe("a\nb\r");
  });

  it("writes to the shell only while it sits at a prompt", async () => {
    const { tracker } = await setup(`${A}$ ${B}make\r\n${C("make")}${D(0)}${A}$ ${B}sleep 9\r\n${C("sleep 9")}`);
    expect(canRerun(tracker)).toBe(false);
    expect(rerunBlock("p1", tracker.blocks[0])).toBe(false);
    expect(terminalWrite).not.toHaveBeenCalled();
  });

  it("types the command and runs it when trusted", async () => {
    const { tracker } = await setup(`${A}$ ${B}make\r\n${C("make")}${D(0)}${A}$ ${B}`);
    expect(rerunBlock("p1", tracker.blocks[0])).toBe(true);
    const bytes = vi.mocked(terminalWrite).mock.calls[0][1];
    expect(new TextDecoder().decode(new Uint8Array(bytes))).toBe("make\r");
  });

  it("only pastes a command from a pane without a nonce (remote marks)", async () => {
    const term = new Terminal({ cols: 80, rows: 24, allowProposedApi: true });
    const tracker = new BlockTracker(term, null);
    await new Promise<void>((resolve) =>
      term.write("\x1b]133;A\x07$ \x1b]133;B\x07rm x\r\n\x1b]133;C\x07\x1b]133;D;0\x07\x1b]133;A\x07$ ", resolve),
    );
    setCachedTerminal("p1", { terminal: term, sessionId: "s1", blocks: tracker } as unknown as CachedTerminal);
    expect(rerunBlock("p1", tracker.blocks[0])).toBe(true);
    const bytes = vi.mocked(terminalWrite).mock.calls[0][1];
    expect(new TextDecoder().decode(new Uint8Array(bytes))).toBe("rm x");
  });
});
