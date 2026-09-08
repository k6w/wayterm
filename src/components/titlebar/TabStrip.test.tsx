import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TabStrip from "./TabStrip";
import DropZoneOverlay from "../terminal/DropZoneOverlay";
import { useTerminalStore } from "../../stores/terminal";
import { useSettingsStore } from "../../stores/settings";
import type { TerminalTab } from "../../types/terminal";

function makeTab(id: string, title: string, isActive: boolean): TerminalTab {
  return { id, title, icon: "", shellType: "zsh", panes: { type: "pane", paneId: `${id}-pane` }, isActive };
}

const actions = {
  setActiveTab: vi.fn(),
  removeTab: vi.fn(),
  addTab: vi.fn(() => "new"),
  renameTab: vi.fn(),
  mergeTabIntoPane: vi.fn(),
  reorderTabs: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useTerminalStore.setState({
    tabs: [makeTab("t1", "zsh", true), makeTab("t2", "logs", false), makeTab("t3", "db", false)],
    activeTabId: "t1",
    panes: {},
    draggingTabId: null,
    dragOverPaneId: null,
    dragOverZone: null,
    ...actions,
  });
});

describe("TabStrip", () => {
  it("never scrolls vertically or shows a scrollbar along the top", () => {
    render(<TabStrip />);
    const strip = screen.getByRole("tablist", { name: "Terminal tabs" }).parentElement!;
    expect(strip).toHaveClass("overflow-y-hidden", "scrollbar-none");
  });

  it("anchors the active indicator to the bar bottom whatever the control height", () => {
    const { container } = render(<TabStrip />);
    const indicator = container.querySelector("span.bg-accent.h-0\\.5")!;
    expect(indicator.className).toContain("bottom-[calc((var(--nx-control-h)-35px)/2)]");
    expect(indicator.className).not.toContain("-bottom-[3px]");
  });

  it("renders one tab per terminal tab with the active one selected", () => {
    render(<TabStrip />);
    const list = screen.getByRole("tablist", { name: "Terminal tabs" });
    const tabs = within(list).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["zsh", "logs", "db"]);
    expect(within(list).getByRole("tab", { name: "zsh" })).toHaveAttribute("aria-selected", "true");
  });

  it("activates a tab on click", async () => {
    const user = userEvent.setup();
    render(<TabStrip />);
    await user.click(screen.getByRole("tab", { name: "logs" }));
    expect(actions.setActiveTab).toHaveBeenCalledWith("t2");
  });

  it("is reachable with Tab and switches tabs with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<TabStrip />);
    await user.tab();
    expect(screen.getByRole("tab", { name: "zsh" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "logs" })).toHaveFocus();
    expect(actions.setActiveTab).toHaveBeenCalledWith("t2");
  });

  it("closes the focused tab with Delete and from its close button", async () => {
    const user = userEvent.setup();
    render(<TabStrip />);
    await user.tab();
    await user.keyboard("{Delete}");
    expect(actions.removeTab).toHaveBeenCalledWith("t1");
    await user.click(screen.getByRole("button", { name: "Close logs" }));
    expect(actions.removeTab).toHaveBeenCalledWith("t2");
  });

  it("renames with F2 and Enter", async () => {
    const user = userEvent.setup();
    render(<TabStrip />);
    await user.tab();
    await user.keyboard("{F2}");
    const input = screen.getByRole("textbox", { name: "Tab name" });
    expect(input).toHaveFocus();
    await user.clear(input);
    await user.keyboard("build{Enter}");
    expect(actions.renameTab).toHaveBeenCalledWith("t1", "build");
  });

  it("opens the context menu with shortcut hints on right-click", async () => {
    render(<TabStrip />);
    fireEvent.contextMenu(screen.getByRole("tab", { name: "logs" }), { clientX: 20, clientY: 10 });
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: /Rename Tab/ })).toBeInTheDocument();
    const close = within(menu).getByRole("menuitem", { name: /^Close Tab(?!s)/ });
    expect(within(close).getByLabelText("Ctrl+W")).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /Move Left/ })).not.toHaveAttribute("data-disabled");
  });

  it("starts a tab with the default shell and offers other shells in a menu", async () => {
    const user = userEvent.setup();
    render(<TabStrip />);
    await user.click(screen.getByRole("button", { name: /^New tab/ }));
    expect(actions.addTab).toHaveBeenCalledTimes(1);

    screen.getByRole("button", { name: "Choose shell" }).focus();
    await user.keyboard("{Enter}");
    const menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    expect(items.length).toBeGreaterThan(0);
    await user.keyboard("{Enter}");
    await waitFor(() => expect(actions.addTab).toHaveBeenCalledTimes(2));
  });
});

/** Stands in for a TerminalPane: same [data-pane-id] hook and overlay condition. */
function FakePane({ paneId }: { paneId: string }) {
  const show = useTerminalStore((s) => s.draggingTabId !== null && s.dragOverPaneId === paneId);
  const zone = useTerminalStore((s) => s.dragOverZone);
  return <div data-pane-id={paneId}>{show && <DropZoneOverlay activeZone={zone} />}</div>;
}

describe("TabStrip drag to split", () => {
  // The visible pane belongs to the active tab t1; the user drags t2 onto it.
  function setup() {
    const user = userEvent.setup();
    const { container } = render(
      <>
        <TabStrip />
        <FakePane paneId="t1-pane" />
      </>
    );
    const pane = container.querySelector<HTMLElement>('[data-pane-id="t1-pane"]')!;
    pane.getBoundingClientRect = () => ({ left: 0, top: 100, width: 400, height: 300, right: 400, bottom: 400, x: 0, y: 100, toJSON: () => ({}) });
    document.elementFromPoint = vi.fn(() => pane);
    const tab = screen.getByRole("tab", { name: "logs" });
    return { user, tab, pane };
  }

  it("a click without movement selects the tab", async () => {
    const { user, tab } = setup();
    await user.pointer([{ keys: "[MouseLeft>]", target: tab, coords: { clientX: 10, clientY: 10 } }, { coords: { clientX: 12, clientY: 11 } }, { keys: "[/MouseLeft]" }]);
    expect(actions.setActiveTab).toHaveBeenCalledWith("t2");
    expect(useTerminalStore.getState().draggingTabId).toBeNull();
  });

  it("pressing a tab does not select it; dragging past the threshold starts a drag", async () => {
    const { user, tab } = setup();
    await user.pointer({ keys: "[MouseLeft>]", target: tab, coords: { clientX: 10, clientY: 10 } });
    expect(actions.setActiveTab).not.toHaveBeenCalled();
    await user.pointer({ coords: { clientX: 20, clientY: 10 } });
    expect(useTerminalStore.getState().draggingTabId).toBe("t2");
    // Released back over the same tab: the browser's click must not select it.
    await user.pointer({ keys: "[/MouseLeft]", coords: { clientX: 20, clientY: 10 } });
    expect(actions.setActiveTab).not.toHaveBeenCalled();
    expect(useTerminalStore.getState().draggingTabId).toBeNull();
  });

  it("over a pane, sets the hovered pane and zone and shows the drop-zone overlay", async () => {
    const { user, tab } = setup();
    expect(screen.queryByText("Split Right")).not.toBeInTheDocument();
    await user.pointer([{ keys: "[MouseLeft>]", target: tab, coords: { clientX: 10, clientY: 10 } }, { coords: { clientX: 380, clientY: 250 } }]);
    expect(useTerminalStore.getState().dragOverPaneId).toBe("t1-pane");
    expect(useTerminalStore.getState().dragOverZone).toBe("right");
    expect(screen.getByText("Split Right")).toBeInTheDocument();
    await user.pointer({ keys: "[/MouseLeft]" });
  });

  it("dropping on a pane splits it with the dragged tab", async () => {
    const { user, tab } = setup();
    await user.pointer([{ keys: "[MouseLeft>]", target: tab, coords: { clientX: 10, clientY: 10 } }, { coords: { clientX: 200, clientY: 110 } }, { keys: "[/MouseLeft]" }]);
    expect(actions.mergeTabIntoPane).toHaveBeenCalledWith("t2", "t1-pane", "top");
    expect(actions.setActiveTab).not.toHaveBeenCalled();
    expect(useTerminalStore.getState()).toMatchObject({ draggingTabId: null, dragOverPaneId: null });
    expect(screen.queryByText("Split Up")).not.toBeInTheDocument();
  });

  it("Escape cancels the drag without splitting", async () => {
    const { user, tab } = setup();
    await user.pointer([{ keys: "[MouseLeft>]", target: tab, coords: { clientX: 10, clientY: 10 } }, { coords: { clientX: 380, clientY: 250 } }]);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(useTerminalStore.getState()).toMatchObject({ draggingTabId: null, dragOverPaneId: null });
    expect(screen.queryByText("Split Right")).not.toBeInTheDocument();
    await user.pointer({ keys: "[/MouseLeft]" });
    expect(actions.mergeTabIntoPane).not.toHaveBeenCalled();
  });

  it("dragging a tab over its own pane offers no drop zone", async () => {
    const { user } = setup();
    const own = screen.getByRole("tab", { name: "zsh" });
    await user.pointer([{ keys: "[MouseLeft>]", target: own, coords: { clientX: 10, clientY: 10 } }, { coords: { clientX: 380, clientY: 250 } }]);
    expect(useTerminalStore.getState().draggingTabId).toBe("t1");
    expect(useTerminalStore.getState().dragOverPaneId).toBeNull();
    await user.pointer({ keys: "[/MouseLeft]" });
    expect(actions.mergeTabIntoPane).not.toHaveBeenCalled();
  });
});
