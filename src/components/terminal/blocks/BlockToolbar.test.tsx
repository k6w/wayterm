import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Terminal } from "@xterm/xterm";
import { BlockTracker } from "../../../lib/blocks/block-tracker";
import { removeCachedTerminal, setCachedTerminal, type CachedTerminal } from "../../../lib/terminal-registry";
import { BlockToolbar } from "./BlockToolbar";
import { BlockOutputDialog, useBlockViewer } from "./BlockOutputDialog";

const A = "\x1b]133;A;wt=n\x07";
const B = "\x1b]133;B\x07";
const C = "\x1b]133;C;cmdline_url=ls;wt=n\x07";
const D = "\x1b]133;D;0;wt=n\x07";

async function setup(data: string, nonce: string | null = "n") {
  const term = new Terminal({ cols: 80, rows: 24, allowProposedApi: true });
  const tracker = new BlockTracker(term, nonce);
  await new Promise<void>((resolve) => term.write(data, resolve));
  setCachedTerminal("p1", { terminal: term, sessionId: "s1", blocks: tracker } as unknown as CachedTerminal);
  return tracker;
}

beforeEach(() => {
  removeCachedTerminal("p1");
  useBlockViewer.setState({ view: null });
  Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } });
});

describe("BlockToolbar", () => {
  it("copies the block and opens its output in the viewer", async () => {
    const tracker = await setup(`${A}$ ${B}ls\r\n${C}a.txt\r\n${D}${A}$ `);
    render(
      <>
        <BlockToolbar paneId="p1" tracker={tracker} block={tracker.blocks[0]} />
        <BlockOutputDialog paneId="p1" />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy command" }));
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith("ls");
    fireEvent.click(screen.getByRole("button", { name: "Copy command and output" }));
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith("$ ls\na.txt");
    fireEvent.click(screen.getByRole("button", { name: "View output" }));
    expect(await screen.findByText("a.txt")).toBeInTheDocument();
    const dialog = screen.getByRole("dialog", { name: "Command output" });
    // Escape closes the read-only viewer, it does not cancel anything.
    expect(within(dialog).queryByText("Cancel")).toBeNull();
    expect(within(dialog).getAllByText("Close")).toHaveLength(2);
  });

  it("offers re-run only while the shell waits at a prompt", async () => {
    const tracker = await setup(`${A}$ ${B}ls\r\n${C}${D}${A}$ ${B}sleep 9\r\n\x1b]133;C;wt=n\x07`);
    render(<BlockToolbar paneId="p1" tracker={tracker} block={tracker.blocks[0]} />);
    expect(screen.getByRole("button", { name: "Re-run (the shell is busy)" })).toBeDisabled();
  });

  it("only pastes commands that could have been faked", async () => {
    const tracker = await setup("\x1b]133;A\x07$ \x1b]133;B\x07ls\r\n\x1b]133;C\x07\x1b]133;D;0\x07\x1b]133;A\x07$ ", null);
    render(<BlockToolbar paneId="p1" tracker={tracker} block={tracker.blocks[0]} />);
    expect(screen.getByRole("button", { name: "Paste command" })).toBeEnabled();
  });

  it("shows the duration the prompt line had no room for", async () => {
    const tracker = await setup(`${A}$ ${B}ls\r\n${C}${D}${A}$ `);
    const { rerender } = render(<BlockToolbar paneId="p1" tracker={tracker} block={tracker.blocks[0]} duration="2.0s" />);
    expect(screen.getByRole("toolbar")).toHaveTextContent("2.0s");
    rerender(<BlockToolbar paneId="p1" tracker={tracker} block={tracker.blocks[0]} duration={null} />);
    expect(screen.getByRole("toolbar")).not.toHaveTextContent("2.0s");
  });
});
