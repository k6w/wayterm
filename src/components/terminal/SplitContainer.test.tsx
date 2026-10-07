import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SplitContainer from "./SplitContainer";
import { useTerminalStore } from "../../stores/terminal";
import { useSettingsStore } from "../../stores/settings";
import type { SplitNode, TerminalTab } from "../../types/terminal";

// The real panes spawn PTYs and xterm; render a labelled stub instead.
vi.mock("./TerminalPane", () => ({
  default: ({ paneId, isActive }: { paneId: string; isActive: boolean }) => (
    <div data-testid={`pane-${paneId}`} data-active={String(isActive)} />
  ),
}));
vi.mock("./SerialPane", () => ({ default: ({ paneId }: { paneId: string }) => <div data-testid={`pane-${paneId}`} /> }));
vi.mock("../sftp/SftpPane", () => ({ default: ({ paneId }: { paneId: string }) => <div data-testid={`pane-${paneId}`} /> }));

const split: SplitNode = {
  type: "split",
  direction: "horizontal",
  ratio: 0.5,
  children: [
    { type: "pane", paneId: "p1" },
    { type: "pane", paneId: "p2" },
  ],
};

function setup(tree: SplitNode, activePaneId = "p1", zoomedPaneId: string | null = null) {
  const tab: TerminalTab = { id: "t1", title: "zsh", icon: "", shellType: "zsh", panes: tree, isActive: true };
  useTerminalStore.setState({
    tabs: [tab],
    activeTabId: "t1",
    activePaneId,
    zoomedPaneId,
    panes: {
      p1: { id: "p1", sessionId: "", isActive: true, cwd: "", shellType: "zsh" },
      p2: { id: "p2", sessionId: "", isActive: false, cwd: "", shellType: "zsh" },
    },
  });
  return render(<SplitContainer node={tree} />);
}

const dimOf = (paneId: string) =>
  screen.getByTestId(`pane-${paneId}`).closest("[data-pane-frame]")!.querySelector('[data-testid="pane-dim"]')!;

const dimVar = (paneId: string) => (dimOf(paneId) as HTMLElement).style.getPropertyValue("--nx-dyn-pane-dim");

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useTerminalStore.setState({ zoomedPaneId: null });
});

describe("SplitContainer", () => {
  it("separates split panes with one 1px hairline divider", () => {
    setup(split);
    const divider = screen.getByRole("separator", { name: "Resize panes left and right" });
    expect(divider).toHaveClass("w-px", "bg-border");
  });

  it("dims the unfocused pane and not the focused one", () => {
    setup(split, "p2");
    expect(dimVar("p1")).toBe("0.15");
    expect(dimVar("p2")).toBe("0");
    expect(dimOf("p1")).toHaveClass("pointer-events-none");
  });

  it("uses the dim strength setting as the scrim opacity", () => {
    useSettingsStore.setState((s) => ({
      settings: { ...s.settings, appearance: { ...s.settings.appearance, inactivePaneDim: 0.4 } },
    }));
    setup(split, "p2");
    expect(dimVar("p1")).toBe("0.4");
  });

  it("renders no scrim when dimming is off", () => {
    useSettingsStore.setState((s) => ({
      settings: { ...s.settings, appearance: { ...s.settings.appearance, dimInactivePanes: false } },
    }));
    setup(split, "p2");
    expect(screen.queryByTestId("pane-dim")).not.toBeInTheDocument();
  });

  it("never dims a lone pane", () => {
    setup({ type: "pane", paneId: "p1" }, "p2");
    expect(dimVar("p1")).toBe("0");
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });

  it("keeps keyboard resizing between 10% and 90%", async () => {
    const user = userEvent.setup();
    setup(split);
    const divider = screen.getByRole("separator");
    divider.focus();
    await user.keyboard("{ArrowRight}");
    expect(divider).toHaveAttribute("aria-valuenow", "55");
    await user.keyboard("{End}");
    expect(divider).toHaveAttribute("aria-valuenow", "90");
    await user.keyboard("{Home}");
    expect(divider).toHaveAttribute("aria-valuenow", "10");
  });

  it("renders only the zoomed pane, undimmed", () => {
    setup(split, "p1", "p2");
    expect(screen.queryByTestId("pane-p1")).not.toBeInTheDocument();
    expect(screen.getByTestId("pane-p2")).toHaveAttribute("data-active", "true");
    expect(dimVar("p2")).toBe("0");
  });
});

describe("pane backing", () => {
  const frameOf = (paneId: string) => screen.getByTestId(`pane-${paneId}`).closest("[data-pane-frame]")!;

  it("puts every pane in the same sidebar glass backing, focused or not", () => {
    setup(split, "p1");
    for (const id of ["p1", "p2"]) {
      expect(frameOf(id)).toHaveClass("bg-panel-glass", "nx-blur");
    }
  });

  it("gives SFTP and serial panes the same backing as terminals", async () => {
    setup(split, "p1");
    useTerminalStore.setState((st) => ({
      panes: { ...st.panes, p1: { ...st.panes.p1, shellType: "sftp" }, p2: { ...st.panes.p2, shellType: "serial" } },
    }));
    cleanup();
    render(<SplitContainer node={split} />);
    for (const id of ["p1", "p2"]) {
      expect((await screen.findByTestId(`pane-${id}`)).closest("[data-pane-frame]")).toHaveClass("bg-panel-glass");
    }
  });

  it("keeps the backing for a lone pane and a zoomed pane", () => {
    setup({ type: "pane", paneId: "p1" });
    expect(frameOf("p1")).toHaveClass("bg-panel-glass");
  });

  it("keeps the backing when a pane is zoomed", () => {
    setup(split, "p1", "p2");
    expect(frameOf("p2")).toHaveClass("bg-panel-glass");
  });

  it("keeps the backing with dimming off", () => {
    useSettingsStore.setState((s) => ({
      settings: { ...s.settings, appearance: { ...s.settings.appearance, dimInactivePanes: false } },
    }));
    setup(split, "p1");
    expect(frameOf("p2")).toHaveClass("bg-panel-glass");
  });
});
