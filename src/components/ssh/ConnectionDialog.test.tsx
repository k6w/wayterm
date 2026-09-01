import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConnectionDialog from "./ConnectionDialog";
import { useSshStore } from "../../stores/ssh";
import { useThemeStore } from "../../stores/theme";
import { useTerminalStore } from "../../stores/terminal";
import type { SshConnection } from "../../types/ssh";

const EXISTING: SshConnection = {
  id: "c1",
  name: "prod",
  host: "10.0.0.5",
  port: 2222,
  username: "deploy",
  authMethod: "password",
  privateKeyId: null,
  jumpHostId: null,
  startupCommands: null,
  colorTag: "blue",
  folderPath: "/work",
  sortOrder: 3,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  envVars: {},
};

beforeEach(() => {
  useThemeStore.setState(useThemeStore.getInitialState(), true);
  useSshStore.setState({ keys: [], connections: [EXISTING] });
  useTerminalStore.setState(useTerminalStore.getInitialState(), true);
});

function renderDialog(editConnection: SshConnection | null = null) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(<ConnectionDialog isOpen onClose={onClose} onSave={onSave} editConnection={editConnection} />);
  return { user: userEvent.setup(), onSave, onClose };
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole("textbox", { name: "Name" }), "dev");
  await user.type(screen.getByRole("textbox", { name: "Host" }), "dev.local");
  await user.type(screen.getByRole("textbox", { name: "Username" }), "me");
}

describe("ConnectionDialog", () => {
  it("opens with focus on the name field and groups the form in sections", async () => {
    renderDialog();
    const dialog = await screen.findByRole("dialog", { name: "New connection" });
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();
    expect(within(dialog).getByRole("region", { name: "Connection" })).toBeInTheDocument();
    expect(within(dialog).getByRole("region", { name: "Authentication" })).toBeInTheDocument();
  });

  it("uses the standard input size for the environment variable fields", async () => {
    const { user } = renderDialog();
    await user.click(await screen.findByRole("button", { name: /Advanced/ }));
    const standard = screen.getByRole("textbox", { name: "Name" });
    for (const name of ["Variable name", "Variable value"]) {
      const field = screen.getByRole("textbox", { name });
      expect(field).toHaveClass("h-control");
      expect(field).not.toHaveClass("h-6");
    }
    expect(standard).toHaveClass("h-control");
  });

  it("keeps Advanced collapsed until it is expanded", async () => {
    const { user } = renderDialog();
    const toggle = await screen.findByRole("button", { name: /Advanced/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Agent forwarding")).not.toBeInTheDocument();
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("switch", { name: "Agent forwarding" })).toBeInTheDocument();
  });

  it("shows inline errors instead of saving an incomplete form, and focuses the first one", async () => {
    const { user, onSave } = renderDialog();
    const port = await screen.findByRole("textbox", { name: "Port" });
    await user.clear(port);
    await user.type(port, "0");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).not.toHaveBeenCalled();
    const name = screen.getByRole("textbox", { name: "Name" });
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("Enter a name for this connection.");
    expect(port).toHaveAccessibleDescription("Use a port from 1 to 65535.");
    await waitFor(() => expect(name).toHaveFocus());
    await user.type(name, "dev");
    expect(name).not.toHaveAttribute("aria-invalid");
  });

  it("saves with Mod+Enter from any field", async () => {
    const { user, onSave } = renderDialog();
    await screen.findByRole("dialog");
    await fillRequired(user);
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ name: "dev", host: "dev.local", port: 22, username: "me" });
  });

  it("shows the Esc and Mod+Enter hints in the footer", async () => {
    renderDialog();
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Esc")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Ctrl+↵")).toBeInTheDocument();
  });

  it("previews user@host:port as you type, with placeholders until filled", async () => {
    const { user } = renderDialog();
    const preview = await screen.findByRole("group", { name: "Connection preview" });
    expect(preview).toHaveTextContent("user@host:22");
    await fillRequired(user);
    await user.clear(screen.getByRole("textbox", { name: "Port" }));
    await user.type(screen.getByRole("textbox", { name: "Port" }), "2200");
    expect(preview).toHaveTextContent("me@dev.local:2200");
  });

  it("counts the Advanced settings that differ from their defaults", async () => {
    const { user } = renderDialog({ ...EXISTING, agentForwarding: true, envVars: { A: "1" } });
    await screen.findByRole("dialog");
    expect(screen.getByTestId("disclosure-count")).toHaveTextContent("2");
    await user.click(screen.getByRole("button", { name: /Advanced/ }));
    await user.click(screen.getByRole("switch", { name: "Agent forwarding" }));
    expect(screen.getByTestId("disclosure-count")).toHaveTextContent("1");
  });

  it("cancels with Escape without saving", async () => {
    const { user, onSave, onClose } = renderDialog();
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("switches the auth fields with the segmented control", async () => {
    useSshStore.setState({
      keys: [{ id: "k1", name: "laptop", algorithm: "ed25519", publicKey: "", fingerprint: "", createdAt: "" }],
    });
    const { user } = renderDialog();
    await screen.findByRole("dialog");
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Key" }));
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Stored key" })).toHaveTextContent("Use the key path below");
    expect(screen.getByRole("textbox", { name: "Private key path" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Agent" }));
    expect(screen.getByText(/SSH agent forwarding will be used/)).toBeInTheDocument();
  });

  it("edits an existing connection, keeping its identity and advanced settings", async () => {
    const { user, onSave } = renderDialog(EXISTING);
    await screen.findByRole("dialog", { name: "Edit connection" });
    expect(screen.getByRole("button", { name: "Blue" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: /Advanced/ }));
    await user.click(screen.getByRole("switch", { name: "Agent forwarding" }));
    await user.type(screen.getByRole("textbox", { name: "Variable name" }), "LANG");
    await user.type(screen.getByRole("textbox", { name: "Variable value" }), "C{Enter}");
    expect(screen.getByText("LANG=C")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "c1",
        port: 2222,
        folderPath: "/work",
        colorTag: "blue",
        agentForwarding: true,
        envVars: { LANG: "C" },
      })
    );
  });

  it("lists other connections as jump hosts, but not the one being edited", async () => {
    useSshStore.setState({ connections: [EXISTING, { ...EXISTING, id: "c2", name: "bastion", host: "b.example" }] });
    const { user } = renderDialog(EXISTING);
    await user.click(await screen.findByRole("button", { name: /Advanced/ }));
    await user.click(screen.getByRole("combobox", { name: "Jump host (ProxyJump)" }));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getByRole("option", { name: "bastion (b.example:2222)" })).toBeInTheDocument();
    expect(within(listbox).queryByRole("option", { name: /^prod/ })).not.toBeInTheDocument();
  });

  it("saves without connecting when Save is pressed", async () => {
    const { user, onSave } = renderDialog();
    await screen.findByRole("dialog");
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(useTerminalStore.getState().tabs).toHaveLength(0);
  });

  it("saves, then opens an SSH tab for it, with Save & Connect and with Mod+Enter", async () => {
    const { user, onSave } = renderDialog();
    await screen.findByRole("dialog");
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: /Save & Connect/ }));
    await waitFor(() => expect(useTerminalStore.getState().tabs).toHaveLength(1));
    const saved = onSave.mock.calls[0][0];
    const state = useTerminalStore.getState();
    expect(Object.values(state.panes).map((pane) => pane.sshConnectionId)).toEqual([saved.id]);
    expect(state.tabs[0].title).toBe("dev");
  });

  it("does not connect when saving fails", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("nope"));
    const user = userEvent.setup();
    render(<ConnectionDialog isOpen onClose={vi.fn()} onSave={onSave} editConnection={null} />);
    await screen.findByRole("dialog");
    await fillRequired(user);
    await user.keyboard("{Control>}{Enter}{/Control}");
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(useTerminalStore.getState().tabs).toHaveLength(0);
  });

  it("connects on Mod+Enter", async () => {
    const { user } = renderDialog();
    await screen.findByRole("dialog");
    await fillRequired(user);
    await user.keyboard("{Control>}{Enter}{/Control}");
    await waitFor(() => expect(useTerminalStore.getState().tabs).toHaveLength(1));
  });

  it("says the password is not saved", async () => {
    renderDialog();
    await screen.findByRole("dialog");
    expect(screen.getByText(/not saved/i)).toBeInTheDocument();
    expect(screen.queryByText(/stored in memory/i)).not.toBeInTheDocument();
  });

  it("shows an inline error and stays open when saving is rejected", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("invalid args `profile`: expected a string"));
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ConnectionDialog isOpen onClose={onClose} onSave={onSave} editConnection={null} />);
    await screen.findByRole("dialog");
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Save" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/could not save/i);
    expect(alert).toHaveTextContent(/expected a string/);
    expect(onClose).not.toHaveBeenCalled();
  });
});
