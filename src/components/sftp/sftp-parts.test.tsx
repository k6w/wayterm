import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TransferQueue from "./TransferQueue";
import FileConflictDialog, { nextAvailableName } from "./FileConflictDialog";
import PathBreadcrumb from "./PathBreadcrumb";
import { useSettingsStore } from "../../stores/settings";
import type { Transfer } from "../../types/sftp";

function transfer(id: string, status: Transfer["status"], bytes = 50): Transfer {
  return {
    id,
    direction: id.startsWith("u") ? "upload" : "download",
    localPath: `/tmp/${id}`,
    remotePath: `/srv/${id}`,
    fileName: `${id}.bin`,
    totalBytes: 100,
    bytesTransferred: bytes,
    status,
    error: status === "error" ? "Permission denied" : null,
  };
}

describe("TransferQueue", () => {
  it("is hidden without transfers", () => {
    const { container } = render(<TransferQueue transfers={[]} onClearCompleted={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("starts collapsed with a count and expands to progress bars", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(
      <TransferQueue
        transfers={[transfer("u1", "in_progress", 40), transfer("d2", "completed"), transfer("d3", "error")]}
        onClearCompleted={onClear}
      />
    );
    const toggle = screen.getByRole("button", { name: "Transfers" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    await user.click(toggle);
    expect(screen.getByRole("progressbar", { name: "u1.bin" })).toHaveAttribute("aria-valuenow", "40");
    expect(screen.getByRole("progressbar", { name: "d2.bin" })).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("Failed")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear finished" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

describe("FileConflictDialog", () => {
  it("numbers the copy past existing names", () => {
    expect(nextAvailableName("a.txt", new Set(["a.txt", "a (1).txt"]))).toBe("a (2).txt");
    expect(nextAvailableName("Makefile", new Set())).toBe("Makefile (1)");
  });

  it("starts on Skip and keeps both under the next free name", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    const onSkip = vi.fn();
    render(
      <FileConflictDialog
        open
        fileName="a.txt"
        remoteNames={new Set(["a.txt"])}
        remoteDir="/srv/"
        onReplace={() => {}}
        onRename={onRename}
        onSkip={onSkip}
      />
    );
    expect(screen.getByRole("dialog", { name: "File already exists" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Keep both" }));
    expect(onRename).toHaveBeenCalledWith("/srv/a (1).txt");
    await user.keyboard("{Escape}");
    expect(onSkip).toHaveBeenCalled();
  });
});

describe("PathBreadcrumb", () => {
  beforeEach(() => {
    useSettingsStore.setState(useSettingsStore.getInitialState(), true);
    useSettingsStore.setState((s) => ({ settings: { ...s.settings, sftpBookmarks: [] } }));
  });

  it("navigates to any crumb and marks the current folder", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<PathBreadcrumb path="/srv/app" onNavigate={onNavigate} label="Remote" />);
    const nav = screen.getByRole("navigation", { name: "Remote path" });
    expect(screen.getByRole("button", { name: "app" })).toHaveAttribute("aria-current", "location");
    await user.click(screen.getByRole("button", { name: "srv" }));
    expect(onNavigate).toHaveBeenCalledWith("/srv");
    expect(nav).toBeInTheDocument();
  });

  it("bookmarks the current path and opens a bookmark from the list", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const { rerender } = render(<PathBreadcrumb path="/srv/app" onNavigate={onNavigate} showBookmarks />);
    await user.click(screen.getByRole("button", { name: "Bookmark this path" }));
    expect(useSettingsStore.getState().settings.sftpBookmarks).toEqual([
      expect.objectContaining({ name: "app", path: "/srv/app" }),
    ]);
    rerender(<PathBreadcrumb path="/" onNavigate={onNavigate} showBookmarks />);
    await user.click(screen.getByRole("button", { name: "Bookmarks" }));
    await user.click(await screen.findByRole("button", { name: /^app/ }));
    expect(onNavigate).toHaveBeenCalledWith("/srv/app");
  });
});
