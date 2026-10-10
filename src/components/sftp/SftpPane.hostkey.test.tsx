import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import SftpPane from "./SftpPane";
import { useTerminalStore } from "../../stores/terminal";
import { useSshStore } from "../../stores/ssh";
import { useSftpStore } from "../../stores/sftp";
import type { SshConnection } from "../../types/ssh";
import type { HostKeyMismatch } from "../../lib/ipc";

const CONN: SshConnection = {
  id: "c1",
  name: "prod",
  host: "example.com",
  port: 22,
  username: "deploy",
  authMethod: "agent",
  privateKeyId: null,
  jumpHostId: null,
  startupCommands: null,
  colorTag: null,
  folderPath: "/",
  sortOrder: 0,
  createdAt: "",
  updatedAt: "",
};

const PENDING = {
  host: "example.com",
  port: 22,
  keyType: "ssh-ed25519",
  keyData: "AAAA",
  fingerprint: "SHA256:newkeynewkey",
};

const OLD_FP = "SHA256:ANn8TSkGESlxtfcNBritd0+eASn7b4Qk2d2wkUd9m+8";

const MISMATCH: HostKeyMismatch = {
  host: "example.com",
  port: 22,
  knownHostsPath: "/home/u/.ssh/known_hosts",
  oldKeys: [{ keyType: "ssh-ed25519", fingerprint: OLD_FP, lineNumber: 4 }],
  newKeyType: "ssh-ed25519",
  newFingerprint: "SHA256:LBuyLim8IdHpu2wb2n4XlpdeS449E1PMNZHGyxEusKo",
  newKeyB64: "AAAAC3NzaC1lZDI1NTE5AAAAICNbsieyVJqvXuKZPxUkHI3LEHkelfGm1+sUEaCQ9gax",
};

const CHANGED_ERROR =
  "HOST KEY CHANGED for example.com:22! This could indicate a man-in-the-middle attack. The connection was not made." +
  `\nwayterm-host-key-mismatch:${JSON.stringify(MISMATCH)}`;

const connect = vi.fn();

beforeEach(() => {
  connect.mockReset();
  useSshStore.setState({ connections: [CONN] });
  useSftpStore.setState({ connect });
  useTerminalStore.setState({
    panes: { p1: { id: "p1", sessionId: "", isActive: true, cwd: "~", shellType: "sftp", sftpConnectionId: "c1" } },
    activePaneId: "p1",
    settingsOpen: false,
    settingsPanel: null,
  });
});

afterEach(() => {
  vi.mocked(invoke).mockImplementation(async () => null);
});

describe("SftpPane host keys", () => {
  it("asks about an unknown host", async () => {
    connect.mockRejectedValueOnce(new Error("TOFU_REQUIRED:example.com:22"));
    vi.mocked(invoke).mockImplementation(async (cmd) => (cmd === "ssh_get_pending_host_key" ? PENDING : null));
    render(<SftpPane paneId="p1" isActive />);
    expect(await screen.findByRole("dialog", { name: "Unknown host" })).toBeInTheDocument();
  });

  it("cancelling a changed key changes nothing and keeps the error (without its payload)", async () => {
    connect.mockRejectedValueOnce(new Error(CHANGED_ERROR));
    const user = userEvent.setup();
    render(<SftpPane paneId="p1" isActive />);
    await screen.findByRole("dialog", { name: "Host key changed" });
    expect(screen.queryByRole("button", { name: /remove|trust/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText(/HOST KEY CHANGED for example\.com/)).toBeInTheDocument();
    expect(screen.queryByText(/wayterm-host-key-mismatch/)).not.toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("replaces the key with the expected old fingerprint, then reconnects", async () => {
    connect.mockRejectedValueOnce(new Error(CHANGED_ERROR)).mockResolvedValue("sid");
    const user = userEvent.setup();
    render(<SftpPane paneId="p1" isActive />);
    await screen.findByRole("dialog", { name: "Host key changed" });
    await user.type(screen.getByRole("textbox", { name: /last 4 characters/i }), "usKo");
    await user.click(screen.getByRole("button", { name: "Replace key and connect" }));
    await waitFor(() => expect(connect).toHaveBeenCalledTimes(2));
    expect(invoke).toHaveBeenCalledWith("ssh_known_hosts_replace", {
      host: "example.com",
      port: 22,
      expectedOldFingerprint: OLD_FP,
      newKeyType: "ssh-ed25519",
      newKeyB64: MISMATCH.newKeyB64,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps the dialog open with the error and does not reconnect when the replacement fails", async () => {
    connect.mockRejectedValueOnce(new Error(CHANGED_ERROR)).mockResolvedValue("sid");
    vi.mocked(invoke).mockImplementation(async (cmd) => {
      if (cmd === "ssh_known_hosts_replace") throw "known_hosts changed while saving, so nothing was replaced.";
      return null;
    });
    const user = userEvent.setup();
    render(<SftpPane paneId="p1" isActive />);
    const dialog = await screen.findByRole("dialog", { name: "Host key changed" });
    await user.type(screen.getByRole("textbox", { name: /last 4 characters/i }), "usKo");
    await user.click(screen.getByRole("button", { name: "Replace key and connect" }));
    expect(await within(dialog).findByText(/nothing was replaced/)).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Host key changed" })).toBeInTheDocument();
    expect(connect).toHaveBeenCalledTimes(1);
    const writes = vi.mocked(invoke).mock.calls.filter(([cmd]) => cmd !== "ssh_known_hosts_replace");
    expect(writes).toEqual([]);
  });

  it("opens Settings on the SSH panel from the changed-key dialog", async () => {
    connect.mockRejectedValueOnce(new Error(CHANGED_ERROR));
    const user = userEvent.setup();
    render(<SftpPane paneId="p1" isActive />);
    await screen.findByRole("dialog", { name: "Host key changed" });
    await user.click(screen.getByRole("button", { name: "Open SSH settings" }));
    expect(useTerminalStore.getState().settingsOpen).toBe(true);
    expect(useTerminalStore.getState().settingsPanel).toBe("ssh");
    expect(invoke).not.toHaveBeenCalledWith("ssh_known_hosts_remove", expect.anything());
  });

  it("calls add once on a double click and disables Trust and Cancel while it is pending", async () => {
    connect.mockRejectedValueOnce(new Error("TOFU_REQUIRED:example.com:22")).mockResolvedValue("sid");
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(invoke).mockImplementation(async (cmd) => {
      if (cmd === "ssh_get_pending_host_key") return PENDING;
      if (cmd === "ssh_known_hosts_add") await gate;
      return null;
    });
    const user = userEvent.setup();
    render(<SftpPane paneId="p1" isActive />);
    const trust = await screen.findByRole("button", { name: "Trust host" });
    await user.dblClick(trust);
    expect(screen.getByRole("button", { name: "Trust host" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    release();
    await waitFor(() => expect(connect).toHaveBeenCalledTimes(2));
    const adds = vi.mocked(invoke).mock.calls.filter(([cmd]) => cmd === "ssh_known_hosts_add");
    expect(adds).toHaveLength(1);
  });
});
