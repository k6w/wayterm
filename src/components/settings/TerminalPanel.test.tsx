import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import TerminalPanel from "./TerminalPanel";
import { useSettingsStore } from "../../stores/settings";

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
});

const terminal = () => useSettingsStore.getState().settings.terminal;

describe("TerminalPanel", () => {
  it("saves switches, segmented choices and selects", async () => {
    const user = userEvent.setup();
    render(<TerminalPanel />);
    await user.click(screen.getByRole("switch", { name: "Copy on select" }));
    expect(terminal().copyOnSelect).toBe(true);
    expect(invoke).toHaveBeenCalledWith("settings_set", { key: "terminal.copyOnSelect", value: true });

    await user.click(screen.getByRole("radio", { name: "Paste" }));
    expect(terminal().rightClickBehavior).toBe("paste");

    await user.click(screen.getByRole("combobox", { name: "Bell style" }));
    await user.click(await screen.findByRole("option", { name: "Visual" }));
    expect(terminal().bellStyle).toBe("visual");
  });

  it("saves the scrollback as a number", () => {
    render(<TerminalPanel />);
    const scrollback = screen.getByRole("spinbutton", { name: "Scrollback lines" });
    expect(scrollback).toHaveValue(10000);
    fireEvent.change(scrollback, { target: { value: "20000" } });
    expect(terminal().scrollbackLines).toBe(20000);
  });

  it("edits word separators in a mono field", () => {
    render(<TerminalPanel />);
    const separators = screen.getByRole("textbox", { name: "Word separators" });
    expect(separators).toHaveClass("font-mono");
    expect(separators).toHaveAccessibleDescription("Break word selection on double-click");
    fireEvent.change(separators, { target: { value: " ()" } });
    expect(terminal().wordSeparators).toBe(" ()");
  });
});
