import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog, InputDialog } from "./index";

describe("ConfirmDialog", () => {
  function renderConfirm(variant?: "danger" | "default") {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Delete snippet?"
        message="This cannot be undone."
        variant={variant}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    return { user: userEvent.setup(), onConfirm, onCancel };
  }

  it("names the dialog by its title and describes it with the message", async () => {
    renderConfirm();
    const dialog = await screen.findByRole("dialog", { name: "Delete snippet?" });
    expect(dialog).toHaveAccessibleDescription("This cannot be undone.");
  });

  it("starts a danger confirmation on Cancel, so Enter does not delete", async () => {
    const { user, onConfirm, onCancel } = renderConfirm("danger");
    await screen.findByRole("dialog");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("starts a default confirmation on the confirm button", async () => {
    const { user, onConfirm } = renderConfirm("default");
    await screen.findByRole("dialog");
    expect(screen.getByRole("button", { name: "Delete" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("cancels on Escape", async () => {
    const { user, onCancel, onConfirm } = renderConfirm();
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("renders nothing while closed", () => {
    render(<ConfirmDialog open={false} title="x" message="y" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("InputDialog", () => {
  function renderInput(defaultValue = "notes.txt") {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const view = render(
      <InputDialog
        open
        title="Rename"
        label="New name"
        defaultValue={defaultValue}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    return { user: userEvent.setup(), onConfirm, onCancel, ...view };
  }

  it("focuses the field with the default value selected", async () => {
    renderInput();
    const input = await screen.findByRole("textbox", { name: "New name" });
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveValue("notes.txt");
    expect((input as HTMLInputElement).selectionStart).toBe(0);
    expect((input as HTMLInputElement).selectionEnd).toBe("notes.txt".length);
  });

  it("submits the trimmed value with Enter", async () => {
    const { user, onConfirm } = renderInput("");
    const input = await screen.findByRole("textbox", { name: "New name" });
    await user.type(input, "  report.pdf  {Enter}");
    expect(onConfirm).toHaveBeenCalledWith("report.pdf");
  });

  it("will not submit a blank value", async () => {
    const { user, onConfirm } = renderInput("");
    const input = await screen.findByRole("textbox", { name: "New name" });
    expect(screen.getByRole("button", { name: "OK" })).toBeDisabled();
    await user.type(input, "   {Enter}");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("starts again from the default value when reopened", async () => {
    const { user, rerender, onConfirm, onCancel } = renderInput();
    await user.type(await screen.findByRole("textbox", { name: "New name" }), "-draft");
    const props = { title: "Rename", label: "New name", defaultValue: "notes.txt", onConfirm, onCancel };
    rerender(<InputDialog open={false} {...props} />);
    rerender(<InputDialog open {...props} />);
    expect(await screen.findByRole("textbox", { name: "New name" })).toHaveValue("notes.txt");
  });

  it("cancels on Escape", async () => {
    const { user, onCancel } = renderInput();
    await screen.findByRole("dialog", { name: "Rename" });
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
