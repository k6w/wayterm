import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaneContextMenu from "./PaneContextMenu";
import { ContextMenu, ContextMenuTrigger } from "../../ui";
import { useTerminalStore } from "../../stores/terminal";

const registry = vi.hoisted(() => ({
  copySelection: vi.fn(),
  pasteToTerminal: vi.fn(async () => true),
  selectAll: vi.fn(),
  clearBuffer: vi.fn(),
  resetTerminal: vi.fn(),
  hasSelection: vi.fn(() => false),
}));
vi.mock("../../lib/terminal-registry", () => registry);

const split = vi.hoisted(() => vi.fn());
vi.mock("../../lib/keybindings", () => ({ splitActivePane: split }));

const actions = {
  detachPaneToTab: vi.fn(),
  closePaneInTab: vi.fn(),
  setActivePane: vi.fn(),
};

function setup(props: Partial<React.ComponentProps<typeof PaneContextMenu>> = {}) {
  render(
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div data-testid="pane" />
      </ContextMenuTrigger>
      <PaneContextMenu paneId="p1" paneCount={1} {...props} />
    </ContextMenu>,
  );
  fireEvent.contextMenu(screen.getByTestId("pane"), { clientX: 20, clientY: 10 });
  return screen.findByRole("menu");
}

const labels = (menu: HTMLElement) => within(menu).getAllByRole("menuitem").map((i) => i.textContent?.replace(/(Ctrl|⌘|⇧|[A-Z])+$/, "").trim());

beforeEach(() => {
  vi.clearAllMocks();
  registry.hasSelection.mockReturnValue(false);
  useTerminalStore.setState({ panes: { p1: { cwd: "/srv/app" } as never }, ...actions });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(async () => {}) },
  });
});

describe("PaneContextMenu", () => {
  it("lists the single-pane items and hides detach/close", async () => {
    const menu = await setup();
    const names = within(menu).getAllByRole("menuitem").map((i) => i.textContent ?? "");
    for (const expected of ["Copy", "Paste", "Select All", "Clear Buffer", "Reset Terminal", "Split Right", "Split Down", "Copy Path", "Start Session Log"]) {
      expect(names.some((n) => n.startsWith(expected))).toBe(true);
    }
    expect(names.some((n) => n.startsWith("Detach"))).toBe(false);
    expect(names.some((n) => n.startsWith("Close Pane"))).toBe(false);
    expect(labels(menu).length).toBe(names.length);
  });

  it("disables Copy without a selection and enables it with one", async () => {
    const menu = await setup();
    expect(within(menu).getByRole("menuitem", { name: /^Copy(?! Path)/ })).toHaveAttribute("data-disabled");
  });

  it("copies the selection when there is one", async () => {
    registry.hasSelection.mockReturnValue(true);
    const user = userEvent.setup();
    const menu = await setup();
    await user.click(within(menu).getByRole("menuitem", { name: /^Copy(?! Path)/ }));
    expect(registry.copySelection).toHaveBeenCalledWith("p1");
  });

  it.each([
    ["Paste", /^Paste/, registry.pasteToTerminal],
    ["Select All", /^Select All/, registry.selectAll],
    ["Clear Buffer", /^Clear Buffer/, registry.clearBuffer],
    ["Reset Terminal", /^Reset Terminal/, registry.resetTerminal],
  ])("runs %s against the pane", async (_label, name, fn) => {
    const user = userEvent.setup();
    const menu = await setup();
    await user.click(within(menu).getByRole("menuitem", { name }));
    expect(fn).toHaveBeenCalledWith("p1");
  });

  it("activates the pane before splitting", async () => {
    const user = userEvent.setup();
    const menu = await setup();
    await user.click(within(menu).getByRole("menuitem", { name: /^Split Down/ }));
    expect(actions.setActivePane).toHaveBeenCalledWith("p1");
    expect(split).toHaveBeenCalledWith("vertical");
  });

  it("offers detach and close for multi-pane tabs", async () => {
    const user = userEvent.setup();
    const menu = await setup({ paneCount: 2 });
    await user.click(within(menu).getByRole("menuitem", { name: /^Detach to Tab/ }));
    expect(actions.setActivePane).toHaveBeenCalledWith("p1");
    expect(actions.detachPaneToTab).toHaveBeenCalledWith("p1");
  });

  it("closes the pane", async () => {
    const user = userEvent.setup();
    const menu = await setup({ paneCount: 3 });
    await user.click(within(menu).getByRole("menuitem", { name: /^Close Pane/ }));
    expect(actions.closePaneInTab).toHaveBeenCalledWith("p1");
  });

  it("copies the working directory", async () => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, "writeText");
    const menu = await setup();
    await user.click(within(menu).getByRole("menuitem", { name: /^Copy Path/ }));
    expect(write).toHaveBeenCalledWith("/srv/app");
  });

  it("toggles between start and stop session log", async () => {
    const user = userEvent.setup();
    const onStartLog = vi.fn();
    const menu = await setup({ onStartLog });
    await user.click(within(menu).getByRole("menuitem", { name: /^Start Session Log/ }));
    expect(onStartLog).toHaveBeenCalled();
  });

  it("shows Stop Session Log while logging", async () => {
    const user = userEvent.setup();
    const onStopLog = vi.fn();
    const menu = await setup({ isLogging: true, onStopLog });
    expect(within(menu).queryByRole("menuitem", { name: /Start Session Log/ })).toBeNull();
    await user.click(within(menu).getByRole("menuitem", { name: /^Stop Session Log/ }));
    expect(onStopLog).toHaveBeenCalled();
  });
});
