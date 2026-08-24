import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import GeneralPanel, { applySettingsFile } from "./GeneralPanel";
import { useSettingsStore } from "../../stores/settings";
import { useWorkspaceStore } from "../../stores/workspace";
import { enable } from "@tauri-apps/plugin-autostart";

vi.mock("@tauri-apps/plugin-autostart", () => ({
  enable: vi.fn(async () => {}),
  disable: vi.fn(async () => {}),
}));

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true);
});

const general = () => useSettingsStore.getState().settings.general;

describe("GeneralPanel", () => {
  it("names every switch by its row label and saves changes", async () => {
    const user = userEvent.setup();
    render(<GeneralPanel />);
    const confirm = screen.getByRole("switch", { name: "Confirm on close" });
    expect(confirm).toBeChecked();
    expect(confirm).toHaveAccessibleDescription("Ask before quitting with open sessions");
    await user.click(confirm);
    expect(general().confirmOnClose).toBe(false);
    expect(invoke).toHaveBeenCalledWith("settings_set", { key: "general.confirmOnClose", value: false });
  });

  it("maps the system default shell to an empty path", async () => {
    const user = userEvent.setup();
    useSettingsStore.setState((s) => ({ settings: { ...s.settings, general: { ...s.settings.general, defaultShell: "/bin/sh" } } }));
    render(<GeneralPanel />);
    const shell = screen.getByRole("combobox", { name: "Default shell" });
    expect(shell).toHaveTextContent("Shell");
    await user.click(shell);
    await user.click(await screen.findByRole("option", { name: "System default" }));
    expect(general().defaultShell).toBe("");
  });

  it("shows a configured shell that is not in the detected list", () => {
    useSettingsStore.setState((s) => ({ settings: { ...s.settings, general: { ...s.settings.general, defaultShell: "/opt/homebrew/bin/zsh" } } }));
    render(<GeneralPanel />);
    expect(screen.getByRole("combobox", { name: "Default shell" })).toHaveTextContent("/opt/homebrew/bin/zsh");
  });

  it("shows the workspace picker only for the workspace startup mode", async () => {
    const user = userEvent.setup();
    render(<GeneralPanel />);
    expect(screen.queryByRole("combobox", { name: "Workspace" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Workspace" }));
    expect(general().startupBehavior).toBe("workspace");
    expect(screen.getByRole("combobox", { name: "Workspace" })).toHaveTextContent("No saved workspaces");
  });

  it("disables the threshold while long-command notifications are off", async () => {
    const user = userEvent.setup();
    render(<GeneralPanel />);
    const threshold = screen.getByRole("slider", { name: "Threshold" });
    expect(threshold).toHaveAttribute("aria-valuetext", "10s");
    expect(threshold).toHaveAttribute("data-disabled");
    await user.click(screen.getByRole("switch", { name: "Notify on long commands" }));
    expect(screen.getByRole("slider", { name: "Threshold" })).not.toHaveAttribute("data-disabled");
  });

  it("turns launch on startup on through the autostart plugin", async () => {
    const user = userEvent.setup();
    render(<GeneralPanel />);
    await user.click(screen.getByRole("switch", { name: "Launch on startup" }));
    await waitFor(() => expect(general().launchOnStartup).toBe(true));
    expect(enable).toHaveBeenCalledTimes(1);
  });

  it("leaves launch on startup off when autostart is unavailable", async () => {
    const user = userEvent.setup();
    vi.mocked(enable).mockRejectedValueOnce(new Error("unsupported"));
    render(<GeneralPanel />);
    await user.click(screen.getByRole("switch", { name: "Launch on startup" }));
    await waitFor(() => expect(enable).toHaveBeenCalledTimes(1));
    expect(general().launchOnStartup).toBe(false);
    expect(screen.getByRole("switch", { name: "Launch on startup" })).not.toBeChecked();
  });
});

describe("applySettingsFile", () => {
  it("applies every object section of an exported file", async () => {
    const file = JSON.stringify({ version: 1, settings: { terminal: { copyOnSelect: true }, profiles: [] } });
    await expect(applySettingsFile(file)).resolves.toBe(true);
    expect(useSettingsStore.getState().settings.terminal.copyOnSelect).toBe(true);
  });

  it("ignores files that are not settings exports", async () => {
    await expect(applySettingsFile("not json")).resolves.toBe(false);
    await expect(applySettingsFile(JSON.stringify({ settings: {} }))).resolves.toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });
});
