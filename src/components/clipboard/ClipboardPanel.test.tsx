import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClipboardPanel } from "./ClipboardPanel";
import { useClipboardStore } from "../../stores/clipboard";
import { useTerminalStore } from "../../stores/terminal";
import { pasteToTerminal } from "../../lib/terminal-registry";

vi.mock("../../lib/terminal-registry", () => ({ pasteToTerminal: vi.fn(async () => true) }));

beforeEach(() => {
  useClipboardStore.setState({
    entries: [
      { id: "a", content: "git status", timestamp: 0, source: "terminal", favorite: false, tags: [] },
      { id: "b", content: "kubectl get pods\n-n prod", timestamp: 0, source: "terminal", favorite: true, tags: [] },
    ],
  });
  useTerminalStore.setState({ activePaneId: "p1" });
});

describe("ClipboardPanel", () => {
  it("lists starred entries first as one-line previews", () => {
    render(<ClipboardPanel />);
    const rows = screen.getAllByRole("button", { name: /git status|kubectl/ });
    expect(rows[0]).toHaveTextContent("kubectl get pods -n prod");
    expect(rows[0]).toHaveTextContent("Starred");
    expect(rows[1]).toHaveTextContent("git status");
  });

  it("filters as you type and says when nothing matches", async () => {
    const user = userEvent.setup();
    render(<ClipboardPanel />);
    await user.type(screen.getByRole("searchbox", { name: "Search clipboard history" }), "GIT");
    expect(screen.getByText("1 item")).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Search clipboard history" }), "zzz");
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  it("writes the entry to the clipboard before pasting it into the active pane", async () => {
    const user = userEvent.setup();
    render(<ClipboardPanel />);
    await user.click(screen.getByRole("button", { name: /git status/ }));
    await waitFor(() => expect(pasteToTerminal).toHaveBeenCalledWith("p1"));
    expect(await navigator.clipboard.readText()).toBe("git status");
  });

  it("stars, deletes and clears from the row and toolbar actions", async () => {
    const user = userEvent.setup();
    render(<ClipboardPanel />);
    await user.click(screen.getByRole("button", { name: "Star" }));
    expect(useClipboardStore.getState().entries.find((e) => e.id === "a")?.favorite).toBe(true);
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    expect(useClipboardStore.getState().entries).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Clear history" }));
    expect(useClipboardStore.getState().entries).toEqual([]);
    expect(screen.getByText("Clipboard history is empty")).toBeInTheDocument();
  });
});
