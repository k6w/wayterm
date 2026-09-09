import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SnippetsPanel from "./SnippetsPanel";
import { useSettingsStore } from "../../stores/settings";
import type { Snippet } from "../../types/settings";

const update = vi.fn(async () => {});

function setSnippets(snippets: Snippet[]) {
  useSettingsStore.setState((s) => ({ settings: { ...s.settings, snippets }, update }));
}

beforeEach(() => {
  update.mockClear();
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  setSnippets([
    { id: "1", name: "logs", command: "journalctl -f", category: "ops" },
    { id: "2", name: "status", command: "git status" },
  ]);
});

describe("SnippetsPanel", () => {
  it("groups snippets by category with uncategorized last", () => {
    render(<SnippetsPanel />);
    expect(screen.getByRole("region", { name: "ops" })).toHaveTextContent("logs");
    expect(screen.getByRole("region", { name: "Uncategorized" })).toHaveTextContent("git status");
    expect(screen.getByRole("region", { name: "Snippets" })).toBeInTheDocument();
  });

  it("adds a snippet from the dialog with Mod+Enter", async () => {
    const user = userEvent.setup();
    render(<SnippetsPanel />);
    await user.click(screen.getByRole("button", { name: "New snippet" }));
    const dialog = await screen.findByRole("dialog", { name: "New snippet" });
    expect(within(dialog).getByRole("button", { name: /Save/ })).toBeDisabled();
    expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveFocus();
    await user.type(within(dialog).getByRole("textbox", { name: "Name" }), "uptime");
    await user.click(within(dialog).getByRole("button", { name: "{{hostname}}" }));
    await user.type(within(dialog).getByRole("textbox", { name: "Command" }), "{Control>}{Enter}{/Control}");
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        "snippets",
        expect.arrayContaining([expect.objectContaining({ name: "uptime", command: "{{hostname}}" })])
      )
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("edits a snippet when its row is selected", async () => {
    const user = userEvent.setup();
    render(<SnippetsPanel />);
    await user.click(screen.getByRole("button", { name: /^logs/ }));
    const dialog = screen.getByRole("dialog", { name: "Edit snippet" });
    const name = within(dialog).getByRole("textbox", { name: "Name" });
    expect(name).toHaveValue("logs");
    await user.clear(name);
    await user.type(name, "tail{Enter}");
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("snippets", [
        { id: "1", name: "tail", command: "journalctl -f", category: "ops" },
        { id: "2", name: "status", command: "git status" },
      ])
    );
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("deletes only after confirmation", async () => {
    const user = userEvent.setup();
    render(<SnippetsPanel />);
    await user.click(screen.getAllByRole("button", { name: "Delete snippet" })[0]);
    expect(update).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith("snippets", [{ id: "2", name: "status", command: "git status" }]));
  });

  it("collapses a category", async () => {
    const user = userEvent.setup();
    render(<SnippetsPanel />);
    await user.click(within(screen.getByRole("region", { name: "ops" })).getByRole("button", { name: "Collapse" }));
    expect(screen.getByRole("region", { name: "ops" })).not.toHaveTextContent("journalctl");
  });

  it("offers to create the first snippet when there are none", () => {
    setSnippets([]);
    render(<SnippetsPanel />);
    expect(screen.getByText("No snippets yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
  });
});
