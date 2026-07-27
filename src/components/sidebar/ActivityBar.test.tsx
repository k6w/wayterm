import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActivityBar from "./ActivityBar";
import Sidebar from "./Sidebar";
import { useSidebarStore } from "../../stores/sidebar";
import { useSettingsStore } from "../../stores/settings";

// Panel bodies are restyled in Phase 4 and pull in many stores; stub them.
vi.mock("../git/GitPanel", () => ({ GitPanel: () => <div>git body</div> }));
vi.mock("../database/DatabasePanel", () => ({ DatabasePanel: () => <div>database body</div> }));
vi.mock("../ui/ClipboardPanel", () => ({ ClipboardPanel: () => <div>clipboard body</div> }));
vi.mock("./TunnelsPanel", () => ({ default: () => <div>tunnels body</div> }));
vi.mock("./ConnectionTree", () => ({ default: () => <div>connections body</div> }));
vi.mock("./WorkspaceList", () => ({ default: () => <div>workspaces</div> }));
vi.mock("./QuickActions", () => ({ default: () => <div>quick actions</div> }));

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useSidebarStore.setState(useSidebarStore.getInitialState(), true);
});

describe("ActivityBar", () => {
  it("has one button per existing panel, none pressed while collapsed", () => {
    render(<ActivityBar />);
    const bar = screen.getByRole("toolbar", { name: "Side panels" });
    const buttons = within(bar).getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Connections",
      "Git",
      "Database",
      "Clipboard",
      "Port Forwards",
    ]);
    for (const b of buttons) expect(b).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByTestId("activity-indicator")).not.toBeInTheDocument();
  });

  it("opens a panel, marks it with the accent bar, and collapses on a second click", async () => {
    const user = userEvent.setup();
    render(<ActivityBar />);
    await user.click(screen.getByRole("button", { name: "Git" }));
    expect(useSidebarStore.getState()).toMatchObject({ collapsed: false, section: "git" });
    expect(screen.getByRole("button", { name: "Git" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByTestId("activity-indicator")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Git" }));
    expect(useSidebarStore.getState().collapsed).toBe(true);
  });

  it("is one tab stop moved with Up/Down", async () => {
    const user = userEvent.setup();
    render(<ActivityBar />);
    await user.tab();
    expect(screen.getByRole("button", { name: "Connections" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Git" })).toHaveFocus();
  });

  it("shows the clipboard shortcut in its tooltip", async () => {
    const user = userEvent.setup();
    render(<ActivityBar />);
    await user.tab();
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/^Clipboard\s*Ctrl\s*Shift\s*V$/);
  });
});

describe("Sidebar", () => {
  it("shows the active panel under a header named after it", () => {
    useSidebarStore.setState({ collapsed: false, section: "database" });
    render(<Sidebar />);
    expect(screen.getByRole("heading", { name: "Database" })).toBeInTheDocument();
    expect(screen.getByText("database body")).toBeInTheDocument();
  });

  it("shows connections with the quick actions and workspaces", () => {
    useSidebarStore.setState({ collapsed: false, section: "connections" });
    render(<Sidebar />);
    expect(screen.getByText("quick actions")).toBeInTheDocument();
    expect(screen.getByText("connections body")).toBeInTheDocument();
    expect(screen.getByText("workspaces")).toBeInTheDocument();
  });

  it("hides itself from the header button", async () => {
    const user = userEvent.setup();
    useSidebarStore.setState({ collapsed: false, section: "git" });
    render(<Sidebar />);
    await user.click(screen.getByRole("button", { name: "Hide sidebar" }));
    expect(useSidebarStore.getState().collapsed).toBe(true);
  });

  it("leaves the docked panel open on Escape (Escape belongs to the terminal)", async () => {
    const user = userEvent.setup();
    useSidebarStore.setState({ collapsed: false, section: "git" });
    render(<Sidebar />);
    await user.keyboard("{Escape}");
    expect(useSidebarStore.getState().collapsed).toBe(false);
  });
});
