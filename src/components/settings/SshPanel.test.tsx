import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SshPanel from "./SshPanel";
import { useSettingsStore } from "../../stores/settings";
import { useSshStore } from "../../stores/ssh";
import { sshImportConfig, sshKnownHostsClear, sshKnownHostsList, sshKnownHostsRemove } from "../../lib/ipc";
import type { SshConnection } from "../../types/ssh";

vi.mock("../../lib/ipc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/ipc")>()),
  sshKnownHostsList: vi.fn(async () => []),
  sshKnownHostsRemove: vi.fn(async () => {}),
  sshKnownHostsClear: vi.fn(async () => {}),
  sshImportConfig: vi.fn(async () => []),
}));

const saved = {
  id: "c1",
  name: "web",
  host: "web.example.com",
  port: 22,
  username: "deploy",
  authMethod: "key",
} as SshConnection;

const saveConnection = vi.fn(async () => {});
const deleteConnection = vi.fn(async () => {});

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useSshStore.setState({ connections: [saved], saveConnection, deleteConnection });
});

afterEach(() => {
  vi.mocked(sshKnownHostsList).mockReset().mockResolvedValue([]);
  vi.mocked(sshImportConfig).mockReset().mockResolvedValue([]);
});

describe("SshPanel", () => {
  it("saves connection defaults as numbers and text", () => {
    render(<SshPanel />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Keepalive interval" }), { target: { value: "45" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Default username" }), { target: { value: "admin" } });
    expect(useSettingsStore.getState().settings.ssh).toMatchObject({ keepaliveInterval: 45, defaultUsername: "admin" });
    expect(screen.getByRole("spinbutton", { name: "Keepalive interval" })).toHaveAccessibleDescription("0 to disable");
  });

  it("deletes a saved connection after confirming", async () => {
    const user = userEvent.setup();
    render(<SshPanel />);
    await user.click(screen.getByRole("button", { name: "Delete web" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete connection" });
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(deleteConnection).toHaveBeenCalledWith("c1");
  });

  it("lists known hosts and removes one", async () => {
    const user = userEvent.setup();
    vi.mocked(sshKnownHostsList).mockResolvedValue([
      { hostname: "git.example.com", keyType: "ssh-ed25519", fingerprintPreview: "SHA256:abc", lineNumber: 3 },
    ]);
    render(<SshPanel />);
    expect(await screen.findByText("git.example.com")).toBeInTheDocument();
    expect(screen.getByText("Known hosts (1)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove git.example.com" }));
    expect(sshKnownHostsRemove).toHaveBeenCalledWith("git.example.com");
  });

  it("clears all known hosts only after a danger confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(sshKnownHostsList).mockResolvedValue([
      { hostname: "a", keyType: "ssh-rsa", fingerprintPreview: "x", lineNumber: 1 },
    ]);
    render(<SshPanel />);
    await user.click(await screen.findByRole("button", { name: "Clear all" }));
    const dialog = await screen.findByRole("dialog", { name: "Clear all known hosts" });
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Clear all" }));
    expect(sshKnownHostsClear).toHaveBeenCalledTimes(1);
  });

  it("imports the chosen hosts from ~/.ssh/config, skipping saved ones", async () => {
    const user = userEvent.setup();
    vi.mocked(sshImportConfig).mockResolvedValue([
      { name: "web", host: "web.example.com", port: 22, username: "deploy", identityFile: null, jumpHost: null },
      { name: "db", host: "db.internal", port: 2222, username: "root", identityFile: "~/.ssh/id", jumpHost: "bastion" },
      { name: "old", host: "old.example.com", port: 22, username: "x", identityFile: null, jumpHost: null },
    ]);
    render(<SshPanel />);
    await user.click(screen.getByRole("button", { name: "Import ~/.ssh/config" }));
    expect(await screen.findByText("via bastion")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /old/ }));
    await user.click(screen.getByRole("button", { name: "Import 2 selected" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Imported 1 connection"));
    expect(saveConnection).toHaveBeenCalledTimes(1);
    expect(saveConnection).toHaveBeenCalledWith(expect.objectContaining({ name: "db", port: 2222, authMethod: "key" }));
  });

  it("shows why the config could not be read", async () => {
    const user = userEvent.setup();
    vi.mocked(sshImportConfig).mockRejectedValueOnce(new Error("no ~/.ssh/config"));
    render(<SshPanel />);
    await user.click(screen.getByRole("button", { name: "Import ~/.ssh/config" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("no ~/.ssh/config");
  });
});
