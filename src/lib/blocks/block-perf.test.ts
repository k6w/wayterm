import { describe, expect, it } from "vitest";
import { Terminal } from "@xterm/xterm";
import { BlockTracker } from "./block-tracker";
import { visibleBlocks } from "./layout";

const N = "n";
const block = (cmd: string, out: string) =>
  `\x1b]133;A;wt=${N}\x07$ \x1b]133;B\x07${cmd}\r\n\x1b]133;C;wt=${N}\x07${out}\x1b]133;D;0;wt=${N}\x07`;

function write(term: Terminal, data: string): Promise<void> {
  return new Promise((resolve) => term.write(data, resolve));
}

async function timeWrite(withTracker: boolean, data: string): Promise<{ ms: number; tracker: BlockTracker | null }> {
  const term = new Terminal({ cols: 120, rows: 40, scrollback: 10_000, allowProposedApi: true });
  const tracker = withTracker ? new BlockTracker(term, N) : null;
  const t0 = performance.now();
  await write(term, data);
  return { ms: performance.now() - t0, tracker };
}

// Budgets are loose (CI machines vary); the point is that blocks add no per-line cost.
describe("command blocks at 10k lines", () => {
  const seq = Array.from({ length: 10_000 }, (_, i) => `${i + 1}\r\n`).join("");

  it("parses a 10k-line command output without extra cost per line", async () => {
    const data = block("seq 10000", seq) + `\x1b]133;A;wt=${N}\x07$ `;
    const plain = await timeWrite(false, data);
    const tracked = await timeWrite(true, data);
    const tracker = tracked.tracker!;
    const t0 = performance.now();
    const output = tracker.getOutputText(tracker.blocks[0]);
    const extractMs = performance.now() - t0;
    expect(output.split("\n")).toHaveLength(10_000);
    expect(tracked.ms).toBeLessThan(plain.ms * 2 + 200);
    expect(extractMs).toBeLessThan(500);
  });

  it("tracks thousands of blocks and lays out the viewport in well under a frame", async () => {
    const data = Array.from({ length: 3_000 }, (_, i) => block(`echo ${i}`, `${i}\r\n`)).join("");
    const { ms, tracker } = await timeWrite(true, data);
    const blocks = tracker!.blocks;
    expect(blocks).toHaveLength(3_000);
    const t0 = performance.now();
    for (let y = 0; y < 10_000; y += 40) visibleBlocks(blocks, y, 40, 10_040);
    const layoutMs = (performance.now() - t0) / 250;
    expect(ms).toBeLessThan(5_000);
    expect(layoutMs).toBeLessThan(1);
  });
});
