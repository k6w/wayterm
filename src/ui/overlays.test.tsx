import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Button,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  Dialog,
  DialogContent,
  DialogTrigger,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Toast,
  Toaster,
  ToastProvider,
  ToastViewport,
} from "./index";
import { toast, useToastStore } from "../stores/toast";

describe("Dialog", () => {
  function renderDialog() {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogContent title="Rename tab" description="Pick a new name" footer={<Button>Save</Button>}>
          <Input aria-label="Name" />
        </DialogContent>
      </Dialog>
    );
  }

  it("opens with a title and description and moves focus inside", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Open" }));
    const dialog = await screen.findByRole("dialog", { name: "Rename tab" });
    expect(dialog).toHaveAccessibleDescription("Pick a new name");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Open" })).toHaveFocus();
  });

  it("closes from its Close button", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Open" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("Popover", () => {
  it("opens from its trigger and closes on Escape, returning focus", async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger asChild>
          <Button>Details</Button>
        </PopoverTrigger>
        <PopoverContent aria-label="Details panel">
          <p>Hello</p>
        </PopoverContent>
      </Popover>
    );
    await user.click(screen.getByRole("button", { name: "Details" }));
    expect(await screen.findByText("Hello")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("Hello")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Details" })).toHaveFocus();
  });
});

describe("Menu", () => {
  function renderMenu(onRename = vi.fn()) {
    render(
      <Menu>
        <MenuTrigger asChild>
          <Button>Actions</Button>
        </MenuTrigger>
        <MenuContent>
          <MenuLabel>Tab</MenuLabel>
          <MenuItem shortcut="Control+r" onSelect={onRename}>
            Rename
          </MenuItem>
          <MenuSeparator />
          <MenuItem disabled>Unavailable</MenuItem>
          <MenuRadioGroup value="a">
            <MenuRadioItem value="a">Alpha</MenuRadioItem>
            <MenuRadioItem value="b">Beta</MenuRadioItem>
          </MenuRadioGroup>
        </MenuContent>
      </Menu>
    );
    return onRename;
  }

  it("opens from the keyboard with focus on the first item", async () => {
    const user = userEvent.setup();
    renderMenu();
    screen.getByRole("button", { name: "Actions" }).focus();
    await user.keyboard("{Enter}");
    const menu = await screen.findByRole("menu");
    const rename = within(menu).getByRole("menuitem", { name: /Rename/ });
    await waitFor(() => expect(rename).toHaveFocus());
    expect(within(rename).getByLabelText("Ctrl+R")).toBeInTheDocument();
  });

  it("selects with Enter, closes and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    const onRename = renderMenu();
    screen.getByRole("button", { name: "Actions" }).focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");
    await user.keyboard("{Enter}");
    expect(onRename).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Actions" })).toHaveFocus();
  });

  it("marks disabled items and checked radio items", async () => {
    const user = userEvent.setup();
    renderMenu();
    screen.getByRole("button", { name: "Actions" }).focus();
    await user.keyboard("{Enter}");
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Unavailable" })).toHaveAttribute("data-disabled");
    expect(within(menu).getByRole("menuitemradio", { name: "Alpha" })).toHaveAttribute("aria-checked", "true");
    expect(within(menu).getByRole("menuitemradio", { name: "Beta" })).toHaveAttribute("aria-checked", "false");
  });
});

describe("ContextMenu", () => {
  it("opens on right-click, selects an item and closes", async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    render(
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>Right-click me</div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={onCopy}>Copy path</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
    fireEvent.contextMenu(screen.getByText("Right-click me"), { clientX: 10, clientY: 10 });
    const menu = await screen.findByRole("menu");
    await user.click(within(menu).getByRole("menuitem", { name: "Copy path" }));
    expect(onCopy).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>Target</div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Item</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
    fireEvent.contextMenu(screen.getByText("Target"));
    await screen.findByRole("menu");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });
});

describe("Toast", () => {
  it("shows its message and reports dismissal", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <ToastProvider>
        <Toast open tone="success" message="Saved" onOpenChange={onOpenChange} />
        <ToastViewport />
      </ToastProvider>
    );
    expect((await screen.findAllByText("Saved")).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Toaster renders the toast store and dismisses through it", async () => {
    const user = userEvent.setup();
    useToastStore.setState({ toasts: [] });
    render(<Toaster />);
    act(() => toast.success("Copied"));
    expect((await screen.findAllByText("Copied")).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(0));
  });
});

describe("Dialog layout options", () => {
  it("keeps the accessible name when the header is hidden", async () => {
    render(
      <Dialog open>
        <DialogContent title="Command palette" hideHeader placement="top" flush>
          <Input aria-label="Search commands" />
        </DialogContent>
      </Dialog>
    );
    const dialog = await screen.findByRole("dialog", { name: "Command palette" });
    expect(within(dialog).queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    expect(within(dialog).getByText("Command palette")).toHaveClass("sr-only");
    expect(dialog).toHaveClass("top-[16vh]");
  });

  it("renders no empty body when there are no children", async () => {
    render(
      <Dialog open>
        <DialogContent title="Delete host?" description="This cannot be undone." footer={<Button>Delete</Button>} />
      </Dialog>
    );
    const dialog = await screen.findByRole("dialog", { name: "Delete host?" });
    expect(dialog).toHaveAccessibleDescription("This cannot be undone.");
    expect(dialog.querySelector(".overflow-y-auto")).toBeNull();
  });
});
