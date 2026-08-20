import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input, SegmentedControl, Switch } from "../../ui";
import { NumberInput, SettingRow, SettingsCard } from "./SettingRow";

describe("SettingRow", () => {
  it("names its control by the label and describes it", () => {
    render(
      <SettingsCard>
        <SettingRow label="Copy on select" description="Copy the selection right away">
          {(control) => <Switch {...control} checked={false} />}
        </SettingRow>
      </SettingsCard>
    );
    const toggle = screen.getByRole("switch", { name: "Copy on select" });
    expect(toggle).toHaveAccessibleDescription("Copy the selection right away");
  });

  it("toggles its switch when the label is clicked", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <SettingRow label="Cursor blink">
        {(control) => <Switch {...control} checked={false} onCheckedChange={onCheckedChange} />}
      </SettingRow>
    );
    await user.click(screen.getByText("Cursor blink"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("accepts a plain control that names itself", () => {
    render(
      <SettingRow label="Cursor style">
        <SegmentedControl
          aria-label="Cursor style"
          value="bar"
          onValueChange={vi.fn()}
          options={[
            { value: "block", label: "Block" },
            { value: "bar", label: "Bar" },
          ]}
        />
      </SettingRow>
    );
    expect(screen.getByRole("radiogroup", { name: "Cursor style" })).toBeInTheDocument();
  });

  it("stacks a wide control under its label", () => {
    render(
      <SettingRow label="Public key" stacked>
        {(control) => <Input {...control} />}
      </SettingRow>
    );
    const row = screen.getByRole("textbox", { name: "Public key" }).closest("[data-setting]");
    expect(row).toHaveClass("flex-col");
    expect(row).toHaveAttribute("data-setting", "Public key");
  });
});

function NumberHarness({ onValue }: { onValue: (value: number) => void }) {
  const [value, setValue] = useState<number | null>(30);
  return (
    <SettingRow label="Keepalive interval">
      {(control) => (
        <NumberInput
          {...control}
          value={value}
          unit="s"
          onValueChange={(next) => {
            setValue(next);
            onValue(next);
          }}
        />
      )}
    </SettingRow>
  );
}

describe("NumberInput", () => {
  it("reports numbers as they are typed and shows its unit", async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<NumberHarness onValue={onValue} />);
    const input = screen.getByRole("spinbutton", { name: "Keepalive interval" });
    expect(screen.getByText("s")).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "45");
    expect(onValue).toHaveBeenLastCalledWith(45);
    expect(input).toHaveValue(45);
  });

  it("shows an empty field for a null value", () => {
    render(<NumberInput aria-label="Font size" value={null} onValueChange={vi.fn()} />);
    expect(screen.getByRole("spinbutton", { name: "Font size" })).toHaveValue(null);
  });
});
