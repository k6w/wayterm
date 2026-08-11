import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import FileTable from "./FileTable";
import type { SftpEntry } from "../../types/sftp";

function entry(name: string, isDir = false, size = 10): SftpEntry {
  return { name, path: `/srv/${name}`, size, modified: null, permissions: 0, isDir, isSymlink: false };
}

const ENTRIES = [entry("b.txt", false, 300), entry("logs", true), entry("a.txt", false, 100), entry("c.txt", false, 200)];

function Harness({
  side = "remote",
  entries = ENTRIES,
  onOpen = vi.fn(),
  onAction = vi.fn(),
}: {
  side?: "local" | "remote";
  entries?: SftpEntry[];
  onOpen?: (e: SftpEntry) => void;
  onAction?: (a: string, e: SftpEntry | null) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  return (
    <FileTable
      side={side}
      label="Remote files"
      entries={entries}
      selected={selected}
      onSelectionChange={setSelected}
      onOpen={onOpen}
      onAction={onAction}
    />
  );
}

const names = () =>
  within(screen.getByRole("grid", { name: "Remote files" }))
    .getAllByRole("row")
    .slice(1)
    .map((r) => r.getAttribute("data-path"));

describe("FileTable", () => {
  it("lists folders first, then files by name, and sorts by a clicked header", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(names()).toEqual(["/srv/logs", "/srv/a.txt", "/srv/b.txt", "/srv/c.txt"]);
    expect(screen.getByRole("columnheader", { name: /Name/ })).toHaveAttribute("aria-sort", "ascending");
    await user.click(screen.getByRole("button", { name: "Size" }));
    expect(screen.getByRole("columnheader", { name: /Size/ })).toHaveAttribute("aria-sort", "ascending");
    expect(names()).toEqual(["/srv/logs", "/srv/a.txt", "/srv/c.txt", "/srv/b.txt"]);
    await user.click(screen.getByRole("button", { name: /Size/ }));
    expect(names()).toEqual(["/srv/logs", "/srv/b.txt", "/srv/c.txt", "/srv/a.txt"]);
  });

  it("selects with click, Ctrl+click and Shift+click", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const row = (name: string) => screen.getByRole("row", { name: new RegExp(name) });
    await user.click(row("a.txt"));
    expect(row("a.txt")).toHaveAttribute("aria-selected", "true");
    await user.click(row("c.txt"));
    expect(row("a.txt")).toHaveAttribute("aria-selected", "false");
    await user.keyboard("{Control>}");
    await user.click(row("a.txt"));
    await user.keyboard("{/Control}");
    expect(row("a.txt")).toHaveAttribute("aria-selected", "true");
    expect(row("c.txt")).toHaveAttribute("aria-selected", "true");
    await user.click(row("logs"));
    await user.keyboard("{Shift>}");
    await user.click(row("b.txt"));
    await user.keyboard("{/Shift}");
    expect(screen.getAllByRole("row", { selected: true })).toHaveLength(3);
  });

  it("moves with the arrow keys, extends with Shift and opens folders with Enter", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<Harness onOpen={onOpen} />);
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(screen.getByRole("row", { name: /logs/ })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ name: "logs" }));
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("row", { name: /a\.txt/ })).toHaveFocus();
    expect(screen.getByRole("row", { name: /a\.txt/ })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(screen.getAllByRole("row", { selected: true })).toHaveLength(2);
  });

  it("offers the right context menu for a row and for the empty area", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<Harness onAction={onAction} />);
    fireEvent.contextMenu(screen.getByText("a.txt"));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(onAction).toHaveBeenCalledWith("delete", expect.objectContaining({ name: "a.txt" }));

    fireEvent.contextMenu(screen.getByRole("columnheader", { name: /Modified/ }));
    expect(await screen.findByRole("menuitem", { name: "New folder" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("never offers delete on the local side", async () => {
    render(<Harness side="local" />);
    fireEvent.contextMenu(screen.getByText("a.txt"));
    expect(await screen.findByRole("menuitem", { name: "Upload" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("says when a folder is empty", () => {
    render(<Harness entries={[]} />);
    expect(screen.getByText("Empty folder")).toBeInTheDocument();
  });
});
