import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox, Input, SegmentedControl, Select, Switch } from "./index";

describe("Input", () => {
  it("is focusable from the keyboard and accepts typing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input aria-label="Host" onChange={onChange} />);
    await user.tab();
    const input = screen.getByRole("textbox", { name: "Host" });
    expect(input).toHaveFocus();
    await user.keyboard("example.com");
    expect(input).toHaveValue("example.com");
    expect(onChange).toHaveBeenCalled();
  });

  it("reports invalid state", () => {
    render(<Input aria-label="Port" invalid />);
    expect(screen.getByRole("textbox", { name: "Port" })).toHaveAttribute("aria-invalid", "true");
  });

  it("cannot be edited when disabled", async () => {
    const user = userEvent.setup();
    render(<Input aria-label="Host" disabled />);
    await user.type(screen.getByRole("textbox", { name: "Host" }), "x");
    expect(screen.getByRole("textbox", { name: "Host" })).toHaveValue("");
  });
});

function SelectHarness() {
  const [value, setValue] = useState("one");
  return (
    <Select
      aria-label="Count"
      value={value}
      onValueChange={setValue}
      options={[
        { value: "one", label: "One" },
        { value: "two", label: "Two" },
        { value: "three", label: "Three", disabled: true },
      ]}
    />
  );
}

describe("Select", () => {
  it("opens with the keyboard, moves with arrows and picks with Enter", async () => {
    const user = userEvent.setup();
    render(<SelectHarness />);
    const trigger = screen.getByRole("combobox", { name: "Count" });
    expect(trigger).toHaveTextContent("One");
    trigger.focus();
    await user.keyboard("{Enter}");
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getByRole("option", { name: "One" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(trigger).toHaveTextContent("Two");
    expect(trigger).toHaveFocus();
  });

  it("closes on Escape without changing the value", async () => {
    const user = userEvent.setup();
    render(<SelectHarness />);
    const trigger = screen.getByRole("combobox", { name: "Count" });
    trigger.focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("listbox");
    await user.keyboard("{ArrowDown}{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(trigger).toHaveTextContent("One");
    expect(trigger).toHaveFocus();
  });
});

describe("Switch", () => {
  it("toggles with Space", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch label="Vibrancy" onCheckedChange={onCheckedChange} />);
    await user.tab();
    const toggle = screen.getByRole("switch", { name: "Vibrancy" });
    expect(toggle).toHaveFocus();
    await user.keyboard(" ");
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("ignores input when disabled", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch label="Vibrancy" disabled onCheckedChange={onCheckedChange} />);
    await user.click(screen.getByRole("switch", { name: "Vibrancy" }));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});

describe("Checkbox", () => {
  it("toggles from its label and from Space", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Copy on select" onCheckedChange={onCheckedChange} />);
    const box = screen.getByRole("checkbox", { name: "Copy on select" });
    await user.click(screen.getByText("Copy on select"));
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);
    expect(box).toHaveFocus();
    await user.keyboard(" ");
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
  });

  it("reports the indeterminate state as mixed", () => {
    render(<Checkbox label="All" checked="indeterminate" />);
    expect(screen.getByRole("checkbox", { name: "All" })).toHaveAttribute("aria-checked", "mixed");
  });
});

function SegmentedHarness({ onChange }: { onChange: (v: string) => void }) {
  const [value, setValue] = useState<"top" | "bottom" | "left">("top");
  return (
    <SegmentedControl
      aria-label="Tab position"
      value={value}
      onValueChange={(v) => {
        onChange(v);
        setValue(v);
      }}
      options={[
        { value: "top", label: "Top" },
        { value: "bottom", label: "Bottom" },
        { value: "left", label: "Left" },
      ]}
    />
  );
}

describe("SegmentedControl", () => {
  it("moves focus with arrows and selects with Space", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SegmentedHarness onChange={onChange} />);
    await user.tab();
    const top = screen.getByText("Top").closest("button")!;
    const bottom = screen.getByText("Bottom").closest("button")!;
    expect(top).toHaveFocus();
    expect(top).toHaveAttribute("data-state", "on");
    await user.keyboard("{ArrowRight}");
    expect(bottom).toHaveFocus();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith("bottom");
    expect(bottom).toHaveAttribute("data-state", "on");
  });

  it("keeps the selection when the selected segment is clicked again", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SegmentedHarness onChange={onChange} />);
    await user.click(screen.getByText("Top"));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Top").closest("button")).toHaveAttribute("data-state", "on");
  });
});
