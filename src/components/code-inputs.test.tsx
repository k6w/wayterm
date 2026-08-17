import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import QueryEditor from "./database/QueryEditor";
import SnippetDialog from "./settings/SnippetDialog";
import ConnectionDialog from "./ssh/ConnectionDialog";
import CommandPalette from "./command-palette/CommandPalette";
import { useTerminalStore } from "../stores/terminal";

function expectCodeField(el: HTMLElement) {
  expect(el).toHaveAttribute("spellcheck", "false");
  expect(el).toHaveAttribute("autocorrect", "off");
  expect(el).toHaveAttribute("autocapitalize", "off");
  expect(el).toHaveAttribute("autocomplete", "off");
}

describe("code inputs opt out of macOS text rewriting", () => {
  it("SQL editor", () => {
    render(<QueryEditor query="" onQueryChange={vi.fn()} history={[]} running={false} onRun={vi.fn()} />);
    expectCodeField(screen.getByRole("textbox", { name: "SQL query" }));
  });

  it("snippet command", async () => {
    render(
      <SnippetDialog
        draft={{ name: "", category: "", command: "", description: "" } as never}
        editing={false}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expectCodeField(await screen.findByRole("textbox", { name: "Command" }));
  });

  it("SSH host, username, port and startup commands", async () => {
    render(<ConnectionDialog isOpen onClose={vi.fn()} onSave={vi.fn()} editConnection={null} />);
    for (const name of ["Host", "Port", "Username", "Startup commands"]) {
      expectCodeField(await screen.findByRole("textbox", { name }));
    }
  });

  it("command palette input", async () => {
    useTerminalStore.setState({ commandPaletteOpen: true });
    render(<CommandPalette />);
    expectCodeField(await screen.findByRole("combobox", { name: "Search commands" }));
  });
});
