import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SaveWorkspaceDialog from "./SaveWorkspaceDialog";
import { openSaveWorkspace } from "./save-workspace";
import { useWorkspaceStore } from "../../stores/workspace";
import { useTerminalStore } from "../../stores/terminal";
import { useToastStore } from "../../stores/toast";

const save = vi.fn(async () => "id" as string | null);

beforeEach(() => {
  save.mockClear();
  useToastStore.setState({ toasts: [] });
  useTerminalStore.setState({
    tabs: [{ id: "t", title: "T", icon: "terminal", shellType: "zsh", panes: { type: "pane", paneId: "p" }, isActive: true }],
  });
  useWorkspaceStore.setState({ workspaces: [], save });
});

describe("SaveWorkspaceDialog", () => {
  it("stays closed until the open event, then saves the current layout under the typed name", async () => {
    const user = userEvent.setup();
    render(<SaveWorkspaceDialog />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => openSaveWorkspace());
    const input = await screen.findByRole("textbox", { name: "Name" });
    expect(input).toHaveValue("Workspace 1");
    await user.clear(input);
    await user.type(input, "Release{Enter}");
    await waitFor(() => expect(save).toHaveBeenCalledWith("Release"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(useToastStore.getState().toasts[0]).toMatchObject({ variant: "success", message: expect.stringContaining("Release") });
  });

  it("explains instead of opening when no tabs are open", () => {
    useTerminalStore.setState({ tabs: [] });
    render(<SaveWorkspaceDialog />);
    act(() => openSaveWorkspace());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useToastStore.getState().toasts[0]).toMatchObject({ variant: "info" });
  });

  it("cancels without saving", async () => {
    const user = userEvent.setup();
    render(<SaveWorkspaceDialog />);
    act(() => openSaveWorkspace());
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(save).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
