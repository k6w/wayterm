import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConnectionTree from "./ConnectionTree";
import { useSshStore } from "../../stores/ssh";
import { useTerminalStore } from "../../stores/terminal";
import type { SshConnection } from "../../types/ssh";

function conn(id: string, folderPath: string, sortOrder: number, colorTag: string | null = null): SshConnection {
  return {
    id,
    name: id,
    host: `${id}.example.com`,
    port: 22,
    username: "deploy",
    authMethod: "agent",
    privateKeyId: null,
    jumpHostId: null,
    startupCommands: null,
    colorTag,
    folderPath,
    sortOrder,
    createdAt: "",
    updatedAt: "",
  };
}

const addTab = vi.fn(() => "tab-1");
const deleteConnection = vi.fn(async () => {});

beforeEach(() => {
  addTab.mockClear();
  deleteConnection.mockClear();
  useSshStore.setState({
    connections: [conn("web", "prod", 1, "red"), conn("db", "prod", 0), conn("laptop", "/", 2)],
    deleteConnection,
  });
  useTerminalStore.setState({ panes: {}, tabs: [], addTab });
});

describe("ConnectionTree", () => {
  it("shows folders and connections as one tree with a single tab stop", () => {
    render(<ConnectionTree />);
    const tree = screen.getByRole("tree", { name: "Connections" });
    const items = screen.getAllByRole("treeitem");
    expect(tree).toContainElement(items[0]);
    expect(items.map((i) => i.getAttribute("tabindex"))).toEqual(["0", "-1", "-1", "-1"]);
    expect(items[0]).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("treeitem", { name: /web/ })).toHaveAttribute("aria-level", "2");
    expect(screen.getByRole("treeitem", { name: /laptop/ })).toHaveAttribute("aria-level", "1");
    expect(screen.getByRole("treeitem", { name: /web/ })).toHaveClass("pl-6");
  });

  it("never lists a quick-connect (transient) connection", () => {
    useSshStore.setState((s) => ({ connections: [...s.connections, { ...conn("adhoc", "/", 9), transient: true }] }));
    render(<ConnectionTree />);
    expect(screen.queryByRole("treeitem", { name: /adhoc/ })).not.toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: /laptop/ })).toBeInTheDocument();
  });

  it("walks the tree with arrows, folds with Left/Right and connects on Enter", async () => {
    const user = userEvent.setup();
    render(<ConnectionTree />);
    await user.tab();
    expect(screen.getByRole("treeitem", { name: /prod/ })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("treeitem", { name: /db/ })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("treeitem", { name: /prod/ })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("treeitem", { name: /prod/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("treeitem", { name: /web/ })).not.toBeInTheDocument();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowDown}{Enter}");
    expect(addTab).toHaveBeenCalledWith("ssh", undefined, "web");
  });

  it("marks a connection that has a tab open and shows its color tag", () => {
    useTerminalStore.setState({
      panes: { p1: { id: "p1", sessionId: "s1", isActive: true, cwd: "~", shellType: "ssh", sshConnectionId: "laptop" } },
    });
    render(<ConnectionTree />);
    expect(screen.getByRole("treeitem", { name: /laptop/ })).toContainElement(screen.getByRole("img", { name: "Open in a tab" }));
    expect(screen.getByRole("treeitem", { name: /web/ }).querySelector("[data-testid=tag-dot]")).toHaveStyle({
      "--nx-dyn-tag": "#ef4444",
    });
  });

  it("reserves the tag slot on untagged rows so names align", () => {
    render(<ConnectionTree />);
    const web = screen.getByRole("treeitem", { name: /web/ });
    const laptop = screen.getByRole("treeitem", { name: /laptop/ });
    expect(web.querySelector("[data-testid=tag-slot]")).toBeInTheDocument();
    expect(laptop.querySelector("[data-testid=tag-slot]")).toBeInTheDocument();
    expect(laptop.querySelector("[data-testid=tag-dot]")).not.toBeInTheDocument();
  });

  it("offers every action in the context menu, and asks before deleting", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<ConnectionTree onEditConnection={onEdit} />);
    fireEvent.contextMenu(screen.getByRole("treeitem", { name: /laptop/ }));
    expect(await screen.findByRole("menuitem", { name: "Connect" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Open SFTP" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "laptop" }));

    fireEvent.contextMenu(screen.getByRole("treeitem", { name: /laptop/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(deleteConnection).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(deleteConnection).toHaveBeenCalledWith("laptop"));
  });

  it("does not move the tree's focus while its context menu takes arrow keys", async () => {
    const user = userEvent.setup();
    render(<ConnectionTree />);
    fireEvent.contextMenu(screen.getByRole("treeitem", { name: /laptop/ }));
    await screen.findByRole("menuitem", { name: "Connect" });
    await user.keyboard("{ArrowDown}{ArrowDown}{Escape}");
    expect(screen.getByRole("treeitem", { name: /prod/ })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("treeitem", { name: /db/ })).toHaveAttribute("tabindex", "-1");
  });

  it("keeps inline actions out of the tab order", () => {
    render(<ConnectionTree />);
    for (const label of ["Connect", "Open SFTP", "Edit", "Delete"]) {
      for (const button of screen.getAllByRole("button", { name: label })) expect(button).toHaveAttribute("tabindex", "-1");
    }
  });

  it("offers to add the first connection when there are none", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    useSshStore.setState({ connections: [] });
    render(<ConnectionTree onAddConnection={onAdd} />);
    expect(screen.getByText("No connections")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "New SSH connection" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
