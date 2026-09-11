import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SshPanel from "./SshPanel";
import { useSettingsStore } from "../../stores/settings";
import { useSshStore } from "../../stores/ssh";
import { sshKnownHostsClear, sshKnownHostsList, sshKnownHostsRemove } from "../../lib/ipc";
import { OPEN_SSH_CONFIG_IMPORT } from "../ssh/ssh-config-import";
import type { SshConnection } from "../../types/ssh";

vi.mock("../../lib/ipc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/ipc")>()),
  sshKnownHostsList: vi.fn(async () => []),
  sshKnownHostsRemove: vi.fn(async () => {}),
  sshKnownHostsClear: vi.fn(async () => {}),
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

  it("opens the ~/.ssh/config import dialog", async () => {
    const user = userEvent.setup();
    const listener = vi.fn();
    window.addEventListener(OPEN_SSH_CONFIG_IMPORT, listener);
    render(<SshPanel />);
    await user.click(screen.getByRole("button", { name: "Import ~/.ssh/config" }));
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_SSH_CONFIG_IMPORT, listener);
  });
});
