import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import TunnelsPanel from "./TunnelsPanel";
import { useSshStore } from "../../stores/ssh";
import type { PortForward } from "../../lib/ipc";
import type { SshConnection } from "../../types/ssh";

function conn(id: string, name: string): SshConnection {
  return {
    id,
    name,
    host: `${id}.example.com`,
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
}

function fwd(id: string, connectionId: string, localPort: number, isActive = false): PortForward {
  return {
    id,
    connectionId,
    portForwardType: "local",
    localPort,
    remoteHost: "db.internal",
    remotePort: 5432,
    isActive,
    createdAt: "",
    updatedAt: "",
  };
}

const FORWARDS: Record<string, PortForward[]> = {
  c1: [fwd("f1", "c1", 5433, true)],
  c2: [fwd("f2", "c2", 8080), fwd("f3", "c2", 9090)],
};

beforeEach(() => {
  useSshStore.setState({ connections: [conn("c1", "prod"), conn("c2", "staging")], sessions: [], portForwards: [] });
  vi.mocked(invoke).mockImplementation(async (cmd, args) => {
    if (cmd === "ssh_list_port_forwards") return FORWARDS[(args as { connectionId: string }).connectionId] ?? [];
    return null;
  });
});

afterEach(() => {
  vi.mocked(invoke).mockImplementation(async () => null);
});

describe("TunnelsPanel", () => {
  it("lists the forwards of every connection, grouped by connection", async () => {
    render(<TunnelsPanel />);
    expect(await screen.findByRole("region", { name: "prod" })).toHaveTextContent("5433 → db.internal:5432");
    expect(screen.getByRole("region", { name: "staging" })).toHaveTextContent("8080 → db.internal:5432");
    expect(screen.getByRole("region", { name: "staging" })).toHaveTextContent("9090 → db.internal:5432");
    expect(screen.queryByRole("heading", { name: /port forwards/i })).not.toBeInTheDocument();
  });

  it("starts a stopped forward when its row is selected", async () => {
    const user = userEvent.setup();
    render(<TunnelsPanel />);
    await user.click(await screen.findByRole("button", { name: /8080.*stopped, select to start/ }));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("ssh_toggle_port_forward", { id: "f2", isActive: true, sessionId: undefined })
    );
    expect(await screen.findByRole("button", { name: /8080.*active, select to stop/ })).toBeInTheDocument();
  });

  it("deletes from the row action", async () => {
    const user = userEvent.setup();
    render(<TunnelsPanel />);
    await screen.findByRole("region", { name: "prod" });
    await user.click(screen.getAllByRole("button", { name: "Delete forward" })[0]);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("ssh_delete_port_forward", { id: "f1" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "prod" })).not.toBeInTheDocument());
  });

  it("shows the empty state at the top when there are none", async () => {
    useSshStore.setState({ connections: [] });
    render(<TunnelsPanel />);
    expect(await screen.findByText("No port forwards")).toBeInTheDocument();
  });
});
