import { describe, expect, it } from "vitest";
import { blockLastLine, inlineDurationFits, visibleBlocks } from "./layout";

const at = (...lines: number[]) => lines.map((line, i) => ({ id: i, promptStart: { line } }));

describe("visibleBlocks", () => {
  it("lays out the blocks overlapping the viewport", () => {
    const blocks = at(0, 5, 12, 30, 41);
    // viewport rows 10..33, cursor on 45
    expect(visibleBlocks(blocks, 10, 24, 45).map(({ index, top, rows }) => ({ index, top, rows }))).toEqual([
      { index: 1, top: -5, rows: 7 },
      { index: 2, top: 2, rows: 18 },
      { index: 3, top: 20, rows: 11 },
    ]);
  });

  it("runs the last block to the cursor line", () => {
    expect(blockLastLine(at(0, 3), 1, 9)).toBe(9);
    expect(blockLastLine(at(0, 3), 1, 2)).toBe(3);
    expect(visibleBlocks(at(0, 3), 0, 24, 9)[1]).toMatchObject({ top: 3, rows: 7 });
  });

  it("returns nothing without blocks and skips disposed markers", () => {
    expect(visibleBlocks([], 0, 24, 0)).toEqual([]);
    expect(visibleBlocks(at(-1, 2), 0, 24, 4).map((b) => b.index)).toEqual([1]);
  });

  it("stays fast with 10k blocks", () => {
    const blocks = at(...Array.from({ length: 10_000 }, (_, i) => i * 3));
    const t0 = performance.now();
    for (let y = 0; y < 30_000; y += 30) visibleBlocks(blocks, y, 40, 30_000);
    const perCall = (performance.now() - t0) / 1000;
    expect(perCall).toBeLessThan(0.5);
  });
});

describe("inlineDurationFits", () => {
  it("needs the label and a two-cell gap free on an unwrapped line", () => {
    expect(inlineDurationFits(74, false, 80, "1.5s")).toBe(true);
    expect(inlineDurationFits(75, false, 80, "1.5s")).toBe(false);
    expect(inlineDurationFits(10, true, 80, "1.5s")).toBe(false);
  });
});
