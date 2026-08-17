import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SftpPane from "./SftpPane";
import { useSftpStore } from "../../stores/sftp";
import { useTerminalStore } from "../../stores/terminal";
import type { SftpEntry } from "../../types/sftp";

function entry(dir: string, name: string, isDir = false): SftpEntry {
  return { name, path: `${dir}/${name}`, size: 10, modified: null, permissions: 0, isDir, isSymlink: false };
}

const ops = {
  connect: vi.fn(async () => "s2"),
  upload: vi.fn(async () => {}),
  download: vi.fn(async () => {}),
  remoteRemove: vi.fn(async () => {}),
  remoteMkdir: vi.fn(async () => {}),
  remoteRename: vi.fn(async () => {}),
  loadRemoteDir: vi.fn(async () => {}),
  loadLocalDir: vi.fn(async () => {}),
};

beforeEach(() => {
  for (const fn of Object.values(ops)) fn.mockClear();
  useTerminalStore.setState({
    panes: { p1: { id: "p1", sessionId: "s1", isActive: true, cwd: "~", shellType: "sftp", sftpConnectionId: "c1" } },
    activePaneId: "p1",
  });
  useSftpStore.setState({
    sessions: { s1: { id: "s1", connectionId: "c1", connectionName: "prod", remoteCwd: "/srv", localCwd: "/home/me" } },
    remoteEntries: { s1: [entry("/srv", "app", true), entry("/srv", "notes.txt")] },
    localEntries: { s1: [entry("/home/me", "notes.txt"), entry("/home/me", "new.txt")] },
    localCollapsed: { s1: false },
    transfers: [],
    ...ops,
  });
});

describe("SftpPane", () => {
  it("reuses the pane's live session and shows local and remote files side by side", async () => {
    render(<SftpPane paneId="p1" isActive />);
    expect(await screen.findByRole("region", { name: "Local files" })).toBeInTheDocument();
    expect(ops.connect).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "Remote files" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Remote path" })).toHaveTextContent("srv");
    expect(screen.getByRole("toolbar", { name: "Remote actions" })).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Resize local and remote files" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close pane" })).not.toBeInTheDocument();
  });

  it("hides and shows the local side", async () => {
    const user = userEvent.setup();
    render(<SftpPane paneId="p1" isActive />);
    await user.click(await screen.findByRole("button", { name: "Hide local files" }));
    expect(screen.queryByRole("region", { name: "Local files" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show local files" }));
    expect(screen.getByRole("region", { name: "Local files" })).toBeInTheDocument();
  });

  it("uploads a new file directly and asks before overwriting an existing one", async () => {
    const user = userEvent.setup();
    render(<SftpPane paneId="p1" isActive />);
    const local = await screen.findByRole("region", { name: "Local files" });
    await user.click(within(local).getByRole("row", { name: /new\.txt/ }));
    await user.click(screen.getByRole("button", { name: "Upload selected" }));
    expect(ops.upload).toHaveBeenCalledWith("s1", "/home/me/new.txt", "/srv/new.txt");

    await user.click(within(local).getByRole("row", { name: /notes\.txt/ }));
    await user.click(screen.getByRole("button", { name: "Upload selected" }));
    expect(await screen.findByRole("dialog", { name: "File already exists" })).toBeInTheDocument();
    expect(ops.upload).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Replace" }));
    expect(ops.upload).toHaveBeenLastCalledWith("s1", "/home/me/notes.txt", "/srv/notes.txt");
  });

  it("deletes remote entries after confirmation", async () => {
    const user = userEvent.setup();
    render(<SftpPane paneId="p1" isActive />);
    const remote = await screen.findByRole("region", { name: "Remote files" });
    await user.click(within(remote).getByRole("row", { name: /notes\.txt/ }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(ops.remoteRemove).not.toHaveBeenCalled();
    await user.click(within(await screen.findByRole("dialog", { name: /Delete "notes.txt"/ })).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(ops.remoteRemove).toHaveBeenCalledWith("s1", "/srv/notes.txt", false));
  });

  it("opens a folder on double-click and goes up from the path bar", async () => {
    const user = userEvent.setup();
    render(<SftpPane paneId="p1" isActive />);
    const remote = await screen.findByRole("region", { name: "Remote files" });
    await user.dblClick(within(remote).getByRole("row", { name: /app/ }));
    expect(ops.loadRemoteDir).toHaveBeenCalledWith("s1", "/srv/app");
    await user.click(within(remote).getByRole("button", { name: "Up one folder" }));
    expect(ops.loadRemoteDir).toHaveBeenLastCalledWith("s1", "/");
  });

  it("offers detach and close only inside a split", async () => {
    render(<SftpPane paneId="p1" isActive paneCount={2} />);
    expect(await screen.findByRole("button", { name: "Close pane" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Detach to tab" })).toBeInTheDocument();
  });
});
