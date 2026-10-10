import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import { WelcomeWizard } from "./WelcomeWizard";
import { useSettingsStore } from "../../stores/settings";
import { useThemeStore } from "../../stores/theme";
import { getDefaultShellsVerified } from "../../lib/shell-detect";

vi.mock("../../lib/shell-detect", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/shell-detect")>()),
  getDefaultShellsVerified: vi.fn(async () => [
    { type: "zsh", path: "/bin/zsh", label: "Zsh" },
    { type: "bash", path: "/bin/bash", label: "Bash" },
  ]),
}));

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useThemeStore.setState(useThemeStore.getInitialState(), true);
});

afterEach(() => {
  vi.mocked(getDefaultShellsVerified).mockClear();
});

const continueButton = () => screen.getByRole("button", { name: "Continue" });

describe("WelcomeWizard", () => {
  it("starts on the theme step with the title focused", () => {
    render(<WelcomeWizard onDismiss={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Welcome to wayterm" })).toHaveFocus();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("applies and saves the picked theme right away", async () => {
    const user = userEvent.setup();
    render(<WelcomeWizard onDismiss={vi.fn()} />);
    await user.click(screen.getByRole("radio", { name: /Frost/ }));
    await waitFor(() => expect(useSettingsStore.getState().settings.appearance.themeId).toBe("frost"));
    expect(useThemeStore.getState().activeThemeId).toBe("frost");
    expect(invoke).toHaveBeenCalledWith("settings_set", { key: "appearance.themeId", value: "frost" });
  });

  it("saves the default shell when leaving the shell step", async () => {
    const user = userEvent.setup();
    render(<WelcomeWizard onDismiss={vi.fn()} />);
    await user.click(continueButton());
    expect(screen.getByRole("heading", { name: "Shell and font" })).toHaveFocus();
    const shell = await screen.findByRole("combobox", { name: "Default shell" });
    await waitFor(() => expect(shell).toHaveTextContent("Zsh"));
    await user.click(shell);
    await user.click(await screen.findByRole("option", { name: "Bash" }));
    expect(shell).toHaveAccessibleDescription("/bin/bash");
    expect(useSettingsStore.getState().settings.general.defaultShell).toBe("");
    await user.click(continueButton());
    expect(useSettingsStore.getState().settings.general.defaultShell).toBe("/bin/bash");
  });

  it("changes the terminal font size live", async () => {
    const user = userEvent.setup();
    render(<WelcomeWizard onDismiss={vi.fn()} />);
    await user.click(continueButton());
    screen.getByRole("slider", { name: "Terminal font size" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(useSettingsStore.getState().settings.appearance.terminalFontSize).toBe(15);
  });

  it("ends on a shortcut cheat-sheet and finishes", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<WelcomeWizard onDismiss={onDismiss} />);
    await user.click(continueButton());
    await user.click(continueButton());
    expect(screen.getByRole("heading", { name: "You're all set" })).toBeInTheDocument();
    // jsdom is not macOS, so Mod is Ctrl.
    expect(within(screen.getByText("New tab").parentElement!).getByLabelText("Ctrl+T")).toBeInTheDocument();
    expect(within(screen.getByText("Command palette").parentElement!).getByLabelText("Ctrl+Shift+P")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start using wayterm" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("goes back a step and can be skipped from any step", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<WelcomeWizard onDismiss={onDismiss} />);
    await user.click(continueButton());
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Welcome to wayterm" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().settings.general.defaultShell).toBe("");
  });
});
