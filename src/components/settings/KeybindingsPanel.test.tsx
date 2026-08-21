import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import KeybindingsPanel from "./KeybindingsPanel";
import { useSettingsStore } from "../../stores/settings";

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
});

function rowFor(label: string) {
  return screen.getByRole("rowheader", { name: label }).closest("tr")!;
}

describe("KeybindingsPanel", () => {
  it("shows each action's shortcut as Kbd glyphs", () => {
    render(<KeybindingsPanel />);
    // jsdom is not macOS, so Mod is Ctrl.
    expect(within(rowFor("New Tab")).getByLabelText("Ctrl+T")).toBeInTheDocument();
    expect(within(rowFor("Command Palette")).getByLabelText("Ctrl+Shift+P")).toBeInTheDocument();
  });

  it("flags actions that share a shortcut", () => {
    render(<KeybindingsPanel />);
    // Off macOS, Paste (Ctrl+Shift+V) and Clipboard Manager (Mod+Shift+V) collide.
    expect(within(rowFor("Paste")).getByText("Conflicts with Clipboard Manager")).toBeInTheDocument();
    expect(within(rowFor("Clipboard Manager")).getByText("Conflicts with Paste")).toBeInTheDocument();
    expect(within(rowFor("New Tab")).queryByText(/Conflicts with/)).not.toBeInTheDocument();
  });

  it("filters by action name or shortcut", async () => {
    const user = userEvent.setup();
    render(<KeybindingsPanel />);
    const search = screen.getByRole("searchbox", { name: "Search shortcuts" });
    await user.type(search, "split");
    expect(screen.getAllByRole("rowheader").map((cell) => cell.textContent)).toEqual([
      "Split Horizontal",
      "Split Vertical",
    ]);
    await user.clear(search);
    await user.type(search, "ctrl+shift+p");
    expect(screen.getAllByRole("rowheader").map((cell) => cell.textContent)).toEqual(["Command Palette"]);
    await user.clear(search);
    await user.type(search, "zzz");
    expect(screen.getByText('No shortcuts match "zzz"')).toBeInTheDocument();
  });

  it("records a new shortcut and saves it", async () => {
    const user = userEvent.setup();
    render(<KeybindingsPanel />);
    await user.click(screen.getByRole("button", { name: "Change shortcut for New Tab" }));
    expect(within(rowFor("New Tab")).getByRole("status")).toHaveTextContent("Press keys…");
    expect(screen.getByRole("button", { name: "Cancel recording for New Tab" })).toHaveAttribute("aria-pressed", "true");
    await user.keyboard("{Control>}{Shift>}y{/Shift}{/Control}");
    expect(useSettingsStore.getState().settings.keybindings["new-tab"]).toBe("Control+Shift+y");
    expect(invoke).toHaveBeenCalledWith("settings_set", { key: "keybindings.new-tab", value: "Control+Shift+y" });
    expect(within(rowFor("New Tab")).getByLabelText("Ctrl+Shift+Y")).toBeInTheDocument();
  });

  it("cancels recording on Escape without saving", async () => {
    const user = userEvent.setup();
    render(<KeybindingsPanel />);
    await user.click(screen.getByRole("button", { name: "Change shortcut for New Tab" }));
    await user.keyboard("{Escape}");
    expect(within(rowFor("New Tab")).queryByRole("status")).not.toBeInTheDocument();
    expect(useSettingsStore.getState().settings.keybindings["new-tab"]).toBeUndefined();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("shows a new conflict as soon as a recorded shortcut clashes", async () => {
    const user = userEvent.setup();
    render(<KeybindingsPanel />);
    await user.click(screen.getByRole("button", { name: "Change shortcut for New Tab" }));
    await user.keyboard("{Control>}w{/Control}");
    expect(within(rowFor("New Tab")).getByText("Conflicts with Close Tab")).toBeInTheDocument();
  });
});
