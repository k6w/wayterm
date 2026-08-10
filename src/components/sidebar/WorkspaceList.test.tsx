import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkspaceList, { formatWorkspaceDate } from "./WorkspaceList";
import { useWorkspaceStore } from "../../stores/workspace";

const save = vi.fn(async () => {});
const restore = vi.fn();
const update = vi.fn(async () => {});
const remove = vi.fn(async () => {});

beforeEach(() => {
  for (const fn of [save, restore, update, remove]) fn.mockClear();
  useWorkspaceStore.setState({
    workspaces: [
      { id: "__session__", name: "session", icon: null, isDefault: false, updatedAt: new Date().toISOString() },
      { id: "w1", name: "Backend", icon: null, isDefault: false, updatedAt: new Date().toISOString() },
    ],
    save,
    restore,
    update,
    remove,
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

describe("WorkspaceList", () => {
  it("lists saved workspaces without the auto-saved session, and restores on select", async () => {
    const user = userEvent.setup();
    render(<WorkspaceList />);
    expect(screen.getByRole("region", { name: "Workspaces" })).toHaveTextContent("1");
    expect(screen.queryByText("session")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Backend/ }));
    expect(restore).toHaveBeenCalledWith("w1");
  });

  it("saves under the typed name on Enter, or a numbered default", async () => {
    const user = userEvent.setup();
    render(<WorkspaceList />);
    await user.type(screen.getByRole("textbox", { name: "Workspace name" }), "Ops{Enter}");
    await waitFor(() => expect(save).toHaveBeenCalledWith("Ops"));
    expect(screen.getByRole("textbox", { name: "Workspace name" })).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(save).toHaveBeenLastCalledWith("Workspace 2"));
  });

  it("updates in place and deletes only after confirmation", async () => {
    const user = userEvent.setup();
    render(<WorkspaceList />);
    await user.click(screen.getByRole("button", { name: "Update with current session" }));
    expect(update).toHaveBeenCalledWith("w1");
    await user.click(screen.getByRole("button", { name: "Delete workspace" }));
    expect(remove).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("w1"));
  });

  it("shows the empty state at the top when nothing is saved", () => {
    useWorkspaceStore.setState({ workspaces: [] });
    render(<WorkspaceList />);
    expect(screen.getByText("No saved workspaces")).toBeInTheDocument();
  });
});
