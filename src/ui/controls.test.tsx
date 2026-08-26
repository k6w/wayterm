import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox, Field, Input, SegmentedControl, Select, Slider, Switch, Textarea } from "./index";

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

  it("plain variant is borderless with no focus ring", () => {
    render(<Input aria-label="Plain" variant="plain" />);
    const input = screen.getByRole("textbox", { name: "Plain" });
    expect(input).toHaveClass("border-0", "outline-none");
    expect(input.className).not.toMatch(/focus-visible/);
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

  it("sizes its list to at least the trigger width, with no competing min-width", async () => {
    const user = userEvent.setup();
    render(<SelectHarness />);
    await user.click(screen.getByRole("combobox", { name: "Count" }));
    const content = (await screen.findByRole("listbox")).closest("[data-radix-popper-content-wrapper]")?.firstElementChild;
    expect(content).toHaveClass("min-w-(--radix-select-trigger-width)");
    expect(content).not.toHaveClass("min-w-44");
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

describe("Field", () => {
  it("labels its control and announces the hint", () => {
    render(
      <Field label="Host" hint="Name or IP address">
        {(control) => <Input {...control} />}
      </Field>
    );
    const input = screen.getByRole("textbox", { name: "Host" });
    expect(input).toHaveAccessibleDescription("Name or IP address");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("shows an error instead of the hint and marks the control invalid", () => {
    render(
      <Field label="Port" hint="Usually 22" error="Port must be between 1 and 65535">
        {(control) => <Input {...control} />}
      </Field>
    );
    const input = screen.getByRole("textbox", { name: "Port" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Port must be between 1 and 65535");
    expect(screen.queryByText("Usually 22")).not.toBeInTheDocument();
  });
});

describe("code fields", () => {
  const CODE_ATTRS = { spellcheck: "false", autocorrect: "off", autocapitalize: "off", autocomplete: "off" };

  it("Input code turns off text rewriting and uses the mono font", () => {
    render(<Input aria-label="Host" code />);
    const input = screen.getByRole("textbox", { name: "Host" });
    for (const [name, value] of Object.entries(CODE_ATTRS)) expect(input).toHaveAttribute(name, value);
    expect(input).toHaveClass("font-mono");
  });

  it("Textarea code turns off text rewriting and uses the mono font", () => {
    render(<Textarea aria-label="Query" code />);
    const area = screen.getByRole("textbox", { name: "Query" });
    for (const [name, value] of Object.entries(CODE_ATTRS)) expect(area).toHaveAttribute(name, value);
    expect(area).toHaveClass("font-mono");
  });

  it("Input plainText turns off text rewriting but keeps the UI font", () => {
    render(<Input aria-label="Filter" plainText />);
    const input = screen.getByRole("textbox", { name: "Filter" });
    for (const [name, value] of Object.entries(CODE_ATTRS)) expect(input).toHaveAttribute(name, value);
    expect(input).not.toHaveClass("font-mono");
  });

  it("leaves prose fields alone by default", () => {
    render(<Input aria-label="Notes" />);
    const input = screen.getByRole("textbox", { name: "Notes" });
    expect(input).not.toHaveAttribute("autocorrect");
    expect(input).not.toHaveClass("font-mono");
  });
});

describe("Textarea", () => {
  it("accepts multi-line typing and reports invalid state", async () => {
    const user = userEvent.setup();
    render(<Textarea aria-label="Startup commands" invalid />);
    const box = screen.getByRole("textbox", { name: "Startup commands" });
    await user.type(box, "cd /srv{Enter}ls");
    expect(box).toHaveValue("cd /srv\nls");
    expect(box).toHaveAttribute("aria-invalid", "true");
  });
});

function SliderHarness({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState(14);
  return (
    <Slider
      aria-label="Font size"
      value={value}
      onValueChange={setValue}
      min={8}
      max={24}
      format={(v) => `${v}px`}
      disabled={disabled}
    />
  );
}

describe("Slider", () => {
  it("exposes its name, range and formatted value", () => {
    render(<SliderHarness />);
    const thumb = screen.getByRole("slider", { name: "Font size" });
    expect(thumb).toHaveAttribute("aria-valuemin", "8");
    expect(thumb).toHaveAttribute("aria-valuemax", "24");
    expect(thumb).toHaveAttribute("aria-valuenow", "14");
    expect(thumb).toHaveAttribute("aria-valuetext", "14px");
    expect(screen.getByText("14px")).toBeInTheDocument();
  });

  it("steps with the arrow keys and jumps with Home and End", async () => {
    const user = userEvent.setup();
    render(<SliderHarness />);
    await user.tab();
    const thumb = screen.getByRole("slider", { name: "Font size" });
    expect(thumb).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(thumb).toHaveAttribute("aria-valuenow", "16");
    await user.keyboard("{ArrowLeft}");
    expect(thumb).toHaveAttribute("aria-valuenow", "15");
    await user.keyboard("{End}");
    expect(thumb).toHaveAttribute("aria-valuenow", "24");
    await user.keyboard("{Home}");
    expect(thumb).toHaveAttribute("aria-valuenow", "8");
  });

  it("ignores the keyboard while disabled", async () => {
    const user = userEvent.setup();
    render(<SliderHarness disabled />);
    const thumb = screen.getByRole("slider", { name: "Font size" });
    thumb.focus();
    await user.keyboard("{ArrowRight}");
    expect(thumb).toHaveAttribute("aria-valuenow", "14");
  });
});

describe("Select description", () => {
  it("passes aria-describedby to its trigger", () => {
    render(
      <>
        <p id="shell-help">Used for new tabs</p>
        <Select aria-label="Shell" aria-describedby="shell-help" value="a" onValueChange={vi.fn()} options={[{ value: "a", label: "A" }]} />
      </>
    );
    expect(screen.getByRole("combobox", { name: "Shell" })).toHaveAccessibleDescription("Used for new tabs");
  });
});
