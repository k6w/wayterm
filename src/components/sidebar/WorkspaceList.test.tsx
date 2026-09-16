import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkspaceList, { formatWorkspaceDate } from "./WorkspaceList";
import { useWorkspaceStore } from "../../stores/workspace";
import { useTerminalStore } from "../../stores/terminal";
import { useToastStore } from "../../stores/toast";
import type { WorkspaceMeta } from "../../types/workspace";

const save = vi.fn(async () => "new-id" as string | null);
const restore = vi.fn(() => true);
const update = vi.fn(async () => {});
const remove = vi.fn(async () => {});
const rename = vi.fn(async () => {});
const duplicate = vi.fn(async () => "copy-id" as string | null);
const setStartupCommands = vi.fn(async () => {});

const leaf = (paneId: string) => ({ type: "pane" as const, paneId });
const layout = JSON.stringify({
  version: 2,
  activeTab: 0,
  tabs: [
    {
      title: "Dev",
      colorTag: null,
      focusedPane: 0,
      layout: {
        type: "split",
        direction: "horizontal",
        ratio: 0.5,
        children: [
          { type: "pane", pane: { id: null, kind: "local", shellType: "zsh", shellPath: null, cwd: "/repo", sshConnectionId: null, sshQuick: null, sftpConnectionId: null, serialConfig: null, startupCommands: ["npm run dev"] } },
          { type: "pane", pane: { id: null, kind: "sftp", shellType: "sftp", shellPath: null, cwd: null, sshConnectionId: null, sshQuick: null, sftpConnectionId: "c1", serialConfig: null, startupCommands: [] } },
        ],
      },
    },
    {
      title: "Ops",
      colorTag: null,
      focusedPane: 0,
      layout: { type: "pane", pane: { id: null, kind: "local", shellType: "zsh", shellPath: null, cwd: null, sshConnectionId: null, sshQuick: null, sftpConnectionId: null, serialConfig: null, startupCommands: [] } },
    },
  ],
});

const record = (over: Partial<WorkspaceMeta> = {}): WorkspaceMeta => ({
  id: "w1",
  name: "Backend",
  icon: null,
  isDefault: false,
  layout,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: new Date().toISOString(),
  lastOpenedAt: null,
  ...over,
});

function openTabs(count: number) {
  useTerminalStore.setState({
    tabs: Array.from({ length: count }, (_, i) => ({ id: `t${i}`, title: `T${i}`, icon: "terminal", shellType: "zsh" as const, panes: leaf(`p${i}`), isActive: i === 0 })),
  });
}

beforeEach(() => {
  for (const fn of [save, restore, update, remove, rename, duplicate, setStartupCommands]) fn.mockClear();
  restore.mockReturnValue(true);
  useToastStore.setState({ toasts: [] });
  openTabs(1);
  useWorkspaceStore.setState({
    workspaces: [record({ id: "__session__", name: "session" }), record()],
    save,
    restore,
    update,
    remove,
    rename,
    duplicate,
    setStartupCommands,
  });
});

describe("formatWorkspaceDate", () => {
  it("says today, yesterday, days ago, then a date", () => {
    const now = new Date("2026-10-08T12:00:00Z");
    expect(formatWorkspaceDate("2026-10-08T09:00:00Z", now)).toBe("Today");
    expect(formatWorkspaceDate("2026-10-07T09:00:00Z", now)).toBe("Yesterday");
    expect(formatWorkspaceDate("2026-10-04T09:00:00Z", now)).toBe("4d ago");
    expect(formatWorkspaceDate("2026-09-01T09:00:00Z", now)).not.toMatch(/ago|Today|Yesterday/);
  });
});

describe("WorkspaceList rows", () => {
  it("lists saved workspaces without the auto-saved session, with a tab and pane count and the last opened time", () => {
    render(<WorkspaceList />);
    expect(screen.getByRole("region", { name: "Workspaces" })).toHaveTextContent("1");
    expect(screen.queryByText("session")).not.toBeInTheDocument();
    const row = screen.getByRole("button", { name: /Backend/ });
    expect(row).toHaveTextContent("2 tabs · 3 panes");
    expect(row).toHaveTextContent("Never opened");
  });

  it("shows when a workspace was last opened", () => {
    useWorkspaceStore.setState({ workspaces: [record({ lastOpenedAt: new Date().toISOString() })] });
    render(<WorkspaceList />);
    expect(screen.getByRole("button", { name: /Backend/ })).toHaveTextContent("Opened Today");
  });

  it("marks a record that cannot be read", () => {
    useWorkspaceStore.setState({ workspaces: [record({ layout: "garbage" })] });
    render(<WorkspaceList />);
    expect(screen.getByRole("button", { name: /Backend/ })).toHaveTextContent("Unreadable");
  });

  it("shows the empty state at the top when nothing is saved", () => {
    useWorkspaceStore.setState({ workspaces: [] });
    render(<WorkspaceList />);
    expect(screen.getByText("No saved workspaces")).toBeInTheDocument();
  });
});

describe("opening", () => {
  it("opens straight away when no tabs are open", async () => {
    openTabs(0);
    render(<WorkspaceList />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Backend/ }));
    expect(restore).toHaveBeenCalledWith("w1", "replace");
  });

  it("asks whether to replace or add when tabs are open", async () => {
    const user = userEvent.setup();
    render(<WorkspaceList />);
    await user.click(screen.getByRole("button", { name: /Backend/ }));
    expect(restore).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Add to current tabs" }));
    expect(restore).toHaveBeenCalledWith("w1", "add");

    restore.mockClear();
    await user.click(screen.getByRole("button", { name: /Backend/ }));
    await user.click(await screen.findByRole("button", { name: "Replace current tabs" }));
    expect(restore).toHaveBeenCalledWith("w1", "replace");
  });

  it("offers Open as a row action too", async () => {
    openTabs(0);
    render(<WorkspaceList />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Open workspace" }));
    expect(restore).toHaveBeenCalledWith("w1", "replace");
  });

  it("tells the user when a workspace cannot be opened", async () => {
    openTabs(0);
    restore.mockReturnValue(false);
    render(<WorkspaceList />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Backend/ }));
    expect(useToastStore.getState().toasts[0]).toMatchObject({ variant: "error", message: expect.stringContaining("Backend") });
  });
});

describe("saving", () => {
  it("saves the current layout under the typed name on Enter, or a numbered default", async () => {
    const user = userEvent.setup();
    render(<WorkspaceList />);
    await user.type(screen.getByRole("textbox", { name: "Workspace name" }), "Ops{Enter}");
    await waitFor(() => expect(save).toHaveBeenCalledWith("Ops"));
    expect(screen.getByRole("textbox", { name: "Workspace name" })).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Save current layout" }));
    await waitFor(() => expect(save).toHaveBeenLastCalledWith("Workspace 2"));
  });

  it("cannot save when there is nothing open", () => {
    openTabs(0);
    render(<WorkspaceList />);
    expect(screen.getByRole("button", { name: "Save current layout" })).toBeDisabled();
  });

  it("updates a workspace from the current layout", async () => {
    render(<WorkspaceList />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Update from current layout" }));
    expect(update).toHaveBeenCalledWith("w1");
  });
});

describe("row menu", () => {
  async function openMenu(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "More actions" }));
  }

  it("renames through a dialog", async () => {
    const user = userEvent.setup();
    render(<WorkspaceList />);
    await openMenu(user);
    await user.click(await screen.findByRole("menuitem", { name: "Rename" }));
    const dialog = await screen.findByRole("dialog", { name: "Rename workspace" });
    const input = within(dialog).getByRole("textbox");
    expect(input).toHaveValue("Backend");
    await user.clear(input);
    await user.type(input, "Platform{Enter}");
    await waitFor(() => expect(rename).toHaveBeenCalledWith("w1", "Platform"));
  });

  it("duplicates", async () => {
    const user = userEvent.setup();
    render(<WorkspaceList />);
    await openMenu(user);
    await user.click(await screen.findByRole("menuitem", { name: "Duplicate" }));
    expect(duplicate).toHaveBeenCalledWith("w1");
  });

  it("edits startup commands per pane and saves them", async () => {
    const user = userEvent.setup();
    render(<WorkspaceList />);
    await openMenu(user);
    await user.click(await screen.findByRole("menuitem", { name: "Edit startup commands" }));
    const dialog = await screen.findByRole("dialog", { name: "Startup commands" });
    const boxes = within(dialog).getAllByRole("textbox");
    expect(boxes).toHaveLength(2); // the SFTP pane takes no commands
    expect(boxes[0]).toHaveValue("npm run dev");
    await user.type(boxes[1], "htop");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(setStartupCommands).toHaveBeenCalledWith("w1", [["npm run dev"], [], ["htop"]]));
  });

  it("deletes only after confirmation", async () => {
    const user = userEvent.setup();
    render(<WorkspaceList />);
    await openMenu(user);
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(remove).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("w1"));
  });
});
