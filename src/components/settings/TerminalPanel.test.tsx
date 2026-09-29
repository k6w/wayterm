import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("turns shell integration and command blocks on and off", async () => {
    const user = userEvent.setup();
    render(<TerminalPanel />);
    const blocks = screen.getByRole("switch", { name: "Command blocks" });
    const gutter = screen.getByRole("switch", { name: "Command status in gutter" });
    expect(gutter).toHaveAttribute("data-disabled");
    await user.click(blocks);
    expect(terminal().commandBlocks).toBe(true);
    expect(gutter).not.toHaveAttribute("data-disabled");
    await user.click(screen.getByRole("switch", { name: "Shell integration" }));
    expect(terminal().shellIntegration).toBe(false);
  });

  it("shows a copyable snippet for remote hosts per shell", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<TerminalPanel />);
    expect((screen.getByRole("textbox", { name: "Remote bash snippet" }) as HTMLTextAreaElement).value).toContain("PROMPT_COMMAND");
    await user.click(screen.getByRole("radio", { name: "fish" }));
    const fish = screen.getByRole("textbox", { name: "Remote fish snippet" }) as HTMLTextAreaElement;
    expect(fish.value).toContain("fish_postexec");
    expect(fish).toHaveAttribute("readonly");
    await user.click(screen.getByRole("button", { name: "Copy snippet" }));
    expect(writeText).toHaveBeenCalledWith(fish.value);
  });
});
