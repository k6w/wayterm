import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import QuickPortForwardDialog from "./QuickPortForwardDialog";
import { useSshStore } from "../../stores/ssh";
import type { PortForward } from "../../lib/ipc";

const SAVED: PortForward = {
  id: "f1",
  connectionId: "c1",
  portForwardType: "local",
  localPort: 5433,
  remoteHost: "db.internal",
  remotePort: 5432,
  isActive: false,
  createdAt: "",
  updatedAt: "",
};

let stored: PortForward[] = [];

beforeEach(() => {
  stored = [SAVED];
  useSshStore.setState({ portForwards: [] });
  vi.mocked(invoke).mockImplementation(async (cmd, args) => {
    if (cmd === "ssh_list_port_forwards") return stored;
    if (cmd === "ssh_save_port_forward") {
      stored = [...stored, { ...(args as { forward: PortForward }).forward, id: "f2" }];
      return null;
    }
    return null;
  });
});

afterEach(() => {
  vi.mocked(invoke).mockImplementation(async () => null);
});

describe("QuickPortForwardDialog", () => {
  it("lists this connection's forwards and toggles one with its switch", async () => {
    const user = userEvent.setup();
    render(<QuickPortForwardDialog isOpen onClose={() => {}} connectionId="c1" sessionId="s1" />);
    expect(screen.getByRole("dialog", { name: "Port forwards" })).toBeInTheDocument();
    const toggle = await screen.findByRole("switch", { name: "Forward 5433 active" });
    await user.click(toggle);
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("ssh_toggle_port_forward", { id: "f1", isActive: true, sessionId: "s1" })
    );
  });

  it("validates the add form inline instead of snapping bad ports to a default", async () => {
    const user = userEvent.setup();
    render(<QuickPortForwardDialog isOpen onClose={() => {}} connectionId="c1" />);
    await user.click(screen.getByRole("button", { name: "Add port forward" }));
    const local = screen.getByRole("textbox", { name: "Local port" });
    expect(local).toHaveFocus();
    await user.clear(local);
    await user.type(local, "80a");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(local).toHaveAccessibleDescription("Use a port from 1 to 65535.");
    expect(invoke).not.toHaveBeenCalledWith("ssh_save_port_forward", expect.anything());
  });

  it("adds a forward on Enter and reloads so it gets its saved id", async () => {
    const user = userEvent.setup();
    render(<QuickPortForwardDialog isOpen onClose={() => {}} connectionId="c1" />);
    await user.click(screen.getByRole("button", { name: "Add port forward" }));
    await user.clear(screen.getByRole("textbox", { name: "Local port" }));
    await user.type(screen.getByRole("textbox", { name: "Local port" }), "9000{Enter}");
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("ssh_save_port_forward", {
        forward: expect.objectContaining({ connectionId: "c1", localPort: 9000, remoteHost: "localhost", remotePort: 8000 }),
      })
    );
    expect(await screen.findByRole("switch", { name: "Forward 9000 active" })).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "New port forward" })).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<QuickPortForwardDialog isOpen onClose={onClose} connectionId="c1" />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("previews local:port → remote:port as you type in the add form", async () => {
    const user = userEvent.setup();
    render(<QuickPortForwardDialog isOpen onClose={() => {}} connectionId="c1" />);
    await user.click(await screen.findByRole("button", { name: "Add port forward" }));
    const preview = screen.getByRole("group", { name: "Forward preview" });
    expect(preview).toHaveTextContent("localhost:8080 → localhost:8000");
    await user.clear(screen.getByRole("textbox", { name: "Remote host" }));
    await user.type(screen.getByRole("textbox", { name: "Remote host" }), "db.internal");
    await user.clear(screen.getByRole("textbox", { name: "Remote port" }));
    await user.type(screen.getByRole("textbox", { name: "Remote port" }), "5432");
    expect(preview).toHaveTextContent("localhost:8080 → db.internal:5432");
  });
});
