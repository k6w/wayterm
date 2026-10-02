/** Where command blocks sit in the viewport. Pure: positions come from marker lines. */

export interface LaidOutBlock<B> {
  block: B;
  index: number;
  /** Viewport row of the block's first line (negative when it starts above the viewport). */
  top: number;
  /** Rows from `top` to the block's last line, inclusive. */
  rows: number;
}

interface Lined {
  promptStart: { line: number };
}

/** Last buffer line of block `i`: the line before the next prompt, else the cursor line. */
export function blockLastLine<B extends Lined>(blocks: readonly B[], i: number, cursorLine: number): number {
  const start = blocks[i].promptStart.line;
  const next = blocks[i + 1];
  return Math.max(start, next ? next.promptStart.line - 1 : cursorLine);
}

/** Index of the last block starting at or above `line`, or 0 when all start below it. */
function firstCandidate<B extends Lined>(blocks: readonly B[], line: number): number {
  let lo = 0;
  let hi = blocks.length - 1;
  let found = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (blocks[mid].promptStart.line <= line) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/**
 * Blocks overlapping the viewport rows [viewportY, viewportY + rows). O(log n + visible).
 */
export function visibleBlocks<B extends Lined>(
  blocks: readonly B[],
  viewportY: number,
  rows: number,
  cursorLine: number,
): LaidOutBlock<B>[] {
  const out: LaidOutBlock<B>[] = [];
  const bottom = viewportY + rows - 1;
  for (let i = firstCandidate(blocks, viewportY); i < blocks.length; i++) {
    const start = blocks[i].promptStart.line;
    if (start < 0) continue;
    if (start > bottom) break;
    const last = blockLastLine(blocks, i, cursorLine);
    if (last < viewportY) continue;
    out.push({ block: blocks[i], index: i, top: start - viewportY, rows: last - start + 1 });
  }
  return out;
}

/** Empty cells kept between a prompt line's text and its duration label. */
const DURATION_GAP = 2;

/**
 * An inline duration label fits on a prompt line of `usedCells` cells: the line does not wrap
 * and leaves the label's width plus a gap free at the right. Otherwise it would cover text.
 */
export function inlineDurationFits(usedCells: number, wrapped: boolean, cols: number, label: string): boolean {
  return !wrapped && usedCells + DURATION_GAP + label.length <= cols;
}
