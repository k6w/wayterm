import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StartupCommandsDialog from "./StartupCommandsDialog";
import type { StartupTarget } from "../../lib/workspace-snapshot";

const targets: StartupTarget[] = [
  { index: 0, tabIndex: 0, tab: "Dev", number: 1, description: "zsh in /repo", commands: ["npm run dev", "git status"] },
  { index: 1, tabIndex: 0, tab: "Dev", number: 2, description: "SSH", commands: [] },
  { index: 3, tabIndex: 1, tab: "Ops", number: 1, description: "zsh", commands: [] },
];

function setup(over: Partial<React.ComponentProps<typeof StartupCommandsDialog>> = {}) {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  render(<StartupCommandsDialog name="Backend" targets={targets} paneCount={5} open onSave={onSave} onCancel={onCancel} {...over} />);
  return { onSave, onCancel };
}

describe("StartupCommandsDialog", () => {
  it("lists a mono textarea per pane, grouped by tab, filled with the saved commands one per line", () => {
    setup();
    expect(screen.getByRole("dialog", { name: "Startup commands" })).toBeInTheDocument();
    const boxes = screen.getAllByRole("textbox");
    expect(boxes).toHaveLength(3);
    expect(boxes[0]).toHaveValue("npm run dev\ngit status");
    expect(boxes[0]).toHaveAttribute("spellcheck", "false");
    expect(screen.getByText("Dev")).toBeInTheDocument();
    expect(screen.getByText("Ops")).toBeInTheDocument();
    expect(screen.getByText("zsh in /repo")).toBeInTheDocument();
  });

  it("saves one list of commands per pane in snapshot order, leaving panes that take none empty", async () => {
    const user = userEvent.setup();
    const { onSave } = setup();
    await user.type(screen.getAllByRole("textbox")[1], "uptime{Enter}  df -h  ");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith([["npm run dev", "git status"], ["uptime", "df -h"], [], [], []]);
  });

  it("cancels without saving", async () => {
    const user = userEvent.setup();
    const { onSave, onCancel } = setup();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("explains when the workspace has no pane that can run commands", () => {
    setup({ targets: [] });
    expect(screen.getByText(/no shell or SSH panes/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("renders nothing while closed", () => {
    setup({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
