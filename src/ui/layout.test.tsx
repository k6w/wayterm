import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Button,
  IconButton,
  ListRow,
  Panel,
  Section,
  SplitPane,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Toolbar,
  ToolbarButton,
  ToolbarSeparator,
} from "./index";

describe("Panel", () => {
  it("uses the panel surface, or the glass surface when asked", () => {
    render(
      <>
        <Panel data-testid="solid" />
        <Panel data-testid="glass" glass elevation="raised" />
      </>
    );
    expect(screen.getByTestId("solid")).toHaveClass("bg-panel", "border-border");
    expect(screen.getByTestId("glass")).toHaveClass("bg-raised-glass", "nx-blur");
    expect(screen.getByTestId("glass")).not.toHaveClass("bg-raised");
  });
});

describe("Section", () => {
  it("is a region named by its title", () => {
    render(
      <Section title="Appearance" description="Colors and fonts">
        <p>body</p>
      </Section>
    );
    expect(screen.getByRole("region", { name: "Appearance" })).toHaveTextContent("body");
  });
});

describe("ListRow", () => {
  it("selects on click, Enter and Space", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ListRow label="prod-db" description="10.0.0.4" onSelect={onSelect} shortcut="Control+1" />);
    const row = screen.getByRole("button", { name: /prod-db/ });
    await user.click(row);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onSelect).toHaveBeenCalledTimes(3);
    expect(row).toHaveFocus();
    expect(screen.getByLabelText("Ctrl+1")).toBeInTheDocument();
  });

  it("marks the selected row", () => {
    render(<ListRow label="prod-db" selected />);
    expect(screen.getByRole("button", { name: "prod-db" })).toHaveAttribute("aria-current", "true");
  });
});

describe("Tabs", () => {
  it("moves and activates with arrow keys, Home and End", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="general">
        <TabsList aria-label="Settings">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="terminal">Terminal</TabsTrigger>
          <TabsTrigger value="ssh">SSH</TabsTrigger>
        </TabsList>
        <TabsContent value="general">General body</TabsContent>
        <TabsContent value="terminal">Terminal body</TabsContent>
        <TabsContent value="ssh">SSH body</TabsContent>
      </Tabs>
    );
    await user.tab();
    expect(screen.getByRole("tab", { name: "General" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Terminal" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Terminal body");
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "SSH" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute("aria-selected", "true");
  });
});

function SplitHarness({ direction = "horizontal" as "horizontal" | "vertical" }) {
  const [ratio, setRatio] = useState(0.5);
  return (
    <SplitPane
      direction={direction}
      ratio={ratio}
      onRatioChange={setRatio}
      min={0.2}
      max={0.8}
      first={<div>left</div>}
      second={<div>right</div>}
    />
  );
}

describe("SplitPane", () => {
  it("resizes with arrow keys and clamps with Home/End", async () => {
    const user = userEvent.setup();
    render(<SplitHarness />);
    const handle = screen.getByRole("separator", { name: "Resize panes" });
    expect(handle).toHaveAttribute("aria-valuenow", "50");
    expect(handle).toHaveAttribute("aria-orientation", "vertical");
    await user.tab();
    expect(handle).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(handle).toHaveAttribute("aria-valuenow", "55");
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(handle).toHaveAttribute("aria-valuenow", "45");
    await user.keyboard("{End}");
    expect(handle).toHaveAttribute("aria-valuenow", "80");
    await user.keyboard("{ArrowRight}");
    expect(handle).toHaveAttribute("aria-valuenow", "80");
    await user.keyboard("{Home}");
    expect(handle).toHaveAttribute("aria-valuenow", "20");
  });

  it("uses Up/Down when stacked vertically", async () => {
    const user = userEvent.setup();
    render(<SplitHarness direction="vertical" />);
    const handle = screen.getByRole("separator");
    handle.focus();
    await user.keyboard("{ArrowDown}");
    expect(handle).toHaveAttribute("aria-valuenow", "55");
    await user.keyboard("{ArrowRight}");
    expect(handle).toHaveAttribute("aria-valuenow", "55");
  });
});

describe("SplitPane divider", () => {
  it("has an 8px hit area centred on the 1px line, stacked above the panes", () => {
    render(<SplitHarness />);
    const cls = screen.getByRole("separator").className;
    expect(cls).toContain("w-px");
    expect(cls).toContain("z-[var(--z-divider)]");
    expect(cls).toContain("cursor-col-resize");
    expect(cls).toContain("before:-inset-x-[3.5px]");
  });

  it("uses a row-resize hit area when stacked", () => {
    render(<SplitHarness direction="vertical" />);
    const cls = screen.getByRole("separator").className;
    expect(cls).toContain("cursor-row-resize");
    expect(cls).toContain("before:-inset-y-[3.5px]");
    expect(cls).toContain("z-[var(--z-divider)]");
  });

  it("is accent only while hovered or dragging, and back to normal after the drag", () => {
    render(<SplitHarness />);
    const handle = screen.getByRole("separator");
    handle.setPointerCapture = vi.fn();
    handle.releasePointerCapture = vi.fn();
    expect(handle).not.toHaveClass("bg-accent");
    fireEvent.pointerEnter(handle);
    expect(handle).toHaveClass("bg-accent");
    fireEvent.pointerLeave(handle);
    expect(handle).not.toHaveClass("bg-accent");
    fireEvent.pointerEnter(handle);
    // jsdom has no PointerEvent, so build one from a MouseEvent (keeps `button`).
    fireEvent(handle, new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
    fireEvent.pointerLeave(handle);
    expect(handle).toHaveClass("bg-accent");
    fireEvent(handle, new MouseEvent("pointerup", { bubbles: true }));
    expect(handle).not.toHaveClass("bg-accent");
    expect(handle).toHaveClass("bg-border");
  });
});

describe("Toolbar", () => {
  it("is a single tab stop with arrow-key navigation", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Toolbar aria-label="Status">
          <ToolbarButton>
            <Button size="xs">zsh</Button>
          </ToolbarButton>
          <ToolbarSeparator />
          <ToolbarButton>
            <IconButton label="Split right" icon={<span>|</span>} />
          </ToolbarButton>
        </Toolbar>
        <button type="button">after</button>
      </>
    );
    expect(screen.getByRole("toolbar", { name: "Status" })).toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole("button", { name: "zsh" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Split right" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "after" })).toHaveFocus();
  });
});

function PxSplitHarness({ collapsed = false, probe }: { collapsed?: boolean; probe?: () => void }) {
  const [width, setWidth] = useState(260);
  return (
    <SplitPane
      unit="px"
      ratio={width}
      onRatioChange={setWidth}
      min={200}
      max={420}
      step={10}
      collapsed={collapsed}
      separatorLabel="Resize sidebar"
      first={<div>side</div>}
      second={<Probe onMount={probe} />}
    />
  );
}

function Probe({ onMount }: { onMount?: () => void }) {
  const [mounted] = useState(() => {
    onMount?.();
    return true;
  });
  return <div>{mounted ? "main" : null}</div>;
}

describe("SplitPane in px", () => {
  it("sizes the first pane in pixels and steps by px", async () => {
    const user = userEvent.setup();
    render(<PxSplitHarness />);
    const handle = screen.getByRole("separator", { name: "Resize sidebar" });
    expect(handle).toHaveAttribute("aria-valuenow", "260");
    expect(handle).toHaveAttribute("aria-valuemin", "200");
    expect(handle).toHaveAttribute("aria-valuemax", "420");
    expect(screen.getByText("side").parentElement).toHaveStyle({ flexBasis: "260px" });
    handle.focus();
    await user.keyboard("{ArrowRight}");
    expect(handle).toHaveAttribute("aria-valuenow", "270");
    await user.keyboard("{End}");
    expect(handle).toHaveAttribute("aria-valuenow", "420");
    await user.keyboard("{Home}");
    expect(handle).toHaveAttribute("aria-valuenow", "200");
  });

  it("hides the first pane and divider when collapsed without remounting the second", () => {
    const probe = vi.fn();
    const { rerender } = render(<PxSplitHarness probe={probe} />);
    rerender(<PxSplitHarness collapsed probe={probe} />);
    expect(screen.queryByText("side")).not.toBeInTheDocument();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    rerender(<PxSplitHarness probe={probe} />);
    expect(screen.getByText("side")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(probe).toHaveBeenCalledTimes(1);
  });
});
