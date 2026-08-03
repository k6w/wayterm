import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import SftpPane from "./SftpPane";
import { useTerminalStore } from "../../stores/terminal";
import { useSshStore } from "../../stores/ssh";
import { useSftpStore } from "../../stores/sftp";
import type { SshConnection } from "../../types/ssh";

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

const connect = vi.fn();

beforeEach(() => {
  connect.mockReset();
  useSshStore.setState({ connections: [CONN] });
  useSftpStore.setState({ connect });
  useTerminalStore.setState({
    panes: { p1: { id: "p1", sessionId: "", isActive: true, cwd: "~", shellType: "sftp", sftpConnectionId: "c1" } },
    activePaneId: "p1",
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

  it("removes the old key after confirmation, then asks about the new one", async () => {
    connect
      .mockRejectedValueOnce(new Error("HOST KEY CHANGED for example.com:22! This could indicate ..."))
      .mockRejectedValueOnce(new Error("TOFU_REQUIRED:example.com:22"));
    vi.mocked(invoke).mockImplementation(async (cmd) => (cmd === "ssh_get_pending_host_key" ? PENDING : null));
    const user = userEvent.setup();
    render(<SftpPane paneId="p1" isActive />);
    await screen.findByRole("dialog", { name: "Host key changed" });
    await user.click(screen.getByRole("checkbox", { name: /I verified the new key/ }));
    await user.click(screen.getByRole("button", { name: "Remove old key and reconnect" }));
    expect(await screen.findByRole("dialog", { name: "Unknown host" })).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("ssh_known_hosts_remove", { hostname: "example.com" });
    expect(invoke).toHaveBeenCalledWith("ssh_known_hosts_remove", { hostname: "[example.com]:22" });
  });

  it("keeps the error and removes nothing when the user closes the warning", async () => {
    connect.mockRejectedValueOnce(new Error("HOST KEY CHANGED for example.com:22! This could indicate ..."));
    const user = userEvent.setup();
    render(<SftpPane paneId="p1" isActive />);
    await screen.findByRole("dialog", { name: "Host key changed" });
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText(/HOST KEY CHANGED for example\.com/)).toBeInTheDocument();
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
