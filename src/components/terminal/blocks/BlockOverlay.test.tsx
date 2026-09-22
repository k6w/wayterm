import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Terminal } from "@xterm/xterm";
import { BlockTracker } from "../../../lib/blocks/block-tracker";
import { BlockOverlay } from "./BlockOverlay";

const NONCE = "n";
const A = `\x1b]133;A;nx=${NONCE}\x07`;
const B = "\x1b]133;B\x07";
const C = `\x1b]133;C;nx=${NONCE}\x07`;
const D = (code: number) => `\x1b]133;D;${code};nx=${NONCE}\x07`;

const measure = () => ({ left: 20, top: 6, width: 640, cellHeight: 16 });

async function setup(data: string) {
  const term = new Terminal({ cols: 80, rows: 24, allowProposedApi: true });
  let now = 1000;
  const tracker = new BlockTracker(term, NONCE, { now: () => (now += 1500) });
  await new Promise<void>((resolve) => term.write(data, resolve));
  return { term, tracker };
}

async function frame() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
}

describe("BlockOverlay", () => {
  it("marks finished, failed and running blocks in the gutter with their durations", async () => {
    const { term, tracker } = await setup(
      `${A}$ ${B}true\r\n${C}${D(0)}${A}$ ${B}false\r\n${C}${D(2)}${A}$ ${B}sleep 9\r\n${C}`,
    );
    render(<BlockOverlay term={term} tracker={tracker} showGutter showDurations measure={measure} />);
    await frame();
    expect(screen.getByLabelText("Command block: Succeeded")).toBeInTheDocument();
    expect(screen.getByLabelText("Command block: Failed with exit code 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Command block: Running")).toBeInTheDocument();
    expect(screen.getAllByText("1.5s")).toHaveLength(2);
  });

  it("selects a block from its gutter mark, shift extends", async () => {
    const { term, tracker } = await setup(`${A}$ ${B}a\r\n${C}${D(0)}${A}$ ${B}b\r\n${C}${D(0)}${A}$ `);
    render(<BlockOverlay term={term} tracker={tracker} showGutter showDurations={false} measure={measure} />);
    await frame();
    const [first, second] = screen.getAllByLabelText("Command block: Succeeded");
    act(() => {
      first.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    await frame();
    expect(tracker.selection.map((b) => tracker.getCommandText(b))).toEqual(["a"]);
    act(() => {
      second.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, shiftKey: true }));
    });
    await frame();
    expect(tracker.selection).toHaveLength(2);
    expect(screen.getAllByTestId("block-selection")).toHaveLength(2);
  });

  it("draws nothing on the alternate screen or with the gutter off", async () => {
    const { term, tracker } = await setup(`${A}$ ${B}vim\r\n${C}`);
    const { rerender } = render(
      <BlockOverlay term={term} tracker={tracker} showGutter={false} showDurations measure={measure} />,
    );
    await frame();
    expect(screen.queryByLabelText(/Command block/)).toBeNull();
    rerender(<BlockOverlay term={term} tracker={tracker} showGutter showDurations measure={measure} />);
    await frame();
    expect(screen.getByLabelText("Command block: Running")).toBeInTheDocument();
    await act(async () => {
      await new Promise<void>((resolve) => term.write("\x1b[?1049h", resolve));
    });
    await frame();
    expect(screen.queryByLabelText(/Command block/)).toBeNull();
  });
});
