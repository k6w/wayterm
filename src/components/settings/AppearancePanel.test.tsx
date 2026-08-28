import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import AppearancePanel from "./AppearancePanel";
import { useSettingsStore } from "../../stores/settings";
import { useThemeStore } from "../../stores/theme";
import { BUILTIN_THEME_MAP } from "../../themes";
import { pickFile } from "../../lib/pick-file";
import { toThemeFile } from "../../lib/theme-schema";

vi.mock("../../lib/pick-file", () => ({ pickFile: vi.fn(async () => null) }));

const custom = { ...BUILTIN_THEME_MAP.frost, id: "my-frost", name: "My Frost" };

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useThemeStore.setState(useThemeStore.getInitialState(), true);
  // jsdom cannot measure text; the font check then stays quiet.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(pickFile).mockReset();
});

const appearance = () => useSettingsStore.getState().settings.appearance;

function addCustomTheme() {
  act(() =>
    useThemeStore.setState((s) => ({
      themes: { ...s.themes, [custom.id]: custom },
      customThemeIds: new Set([custom.id]),
    }))
  );
}

describe("AppearancePanel", () => {
  it("picks a built-in theme and saves it", async () => {
    const user = userEvent.setup();
    render(<AppearancePanel />);
    expect(screen.getByRole("radio", { name: /Graphite/ })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: /Ember/ }));
    await waitFor(() => expect(appearance().themeId).toBe("ember"));
    expect(useThemeStore.getState().activeThemeId).toBe("ember");
    expect(invoke).toHaveBeenCalledWith("settings_set", { key: "appearance.themeId", value: "ember" });
  });

  it("previews a theme on hover and restores the active one on leave", async () => {
    const user = userEvent.setup();
    render(<AppearancePanel />);
    await user.hover(screen.getByRole("radio", { name: /Paper/ }));
    expect(useThemeStore.getState().active.id).toBe("paper");
    await user.unhover(screen.getByRole("radio", { name: /Paper/ }));
    expect(useThemeStore.getState().active.id).toBe("graphite");
    expect(appearance().themeId).toBe("graphite");
  });

  it("imports a theme file, activates it and saves the choice", async () => {
    const user = userEvent.setup();
    const file = new File([JSON.stringify(toThemeFile(custom))], "my-frost.json");
    Object.defineProperty(file, "text", { value: async () => JSON.stringify(toThemeFile(custom)) });
    vi.mocked(pickFile).mockResolvedValueOnce(file);
    render(<AppearancePanel />);
    expect(screen.getByText("No custom themes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Import theme…" }));
    expect(await screen.findByRole("button", { name: /^My Frost/ })).toHaveAttribute("aria-current", "true");
    expect(appearance().themeId).toBe("my-frost");
    expect(invoke).toHaveBeenCalledWith("custom_theme_save", expect.objectContaining({ id: "my-frost" }));
  });

  it("shows why an import failed", async () => {
    const user = userEvent.setup();
    const file = new File(["x"], "theme.yaml");
    Object.defineProperty(file, "text", { value: async () => "x" });
    vi.mocked(pickFile).mockResolvedValueOnce(file);
    render(<AppearancePanel />);
    await user.click(screen.getByRole("button", { name: "Import theme…" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unsupported file type: .yaml");
  });

  it("deleting the active custom theme saves the default theme", async () => {
    const user = userEvent.setup();
    addCustomTheme();
    act(() => useThemeStore.getState().setTheme(custom.id));
    render(<AppearancePanel />);
    const row = screen.getByRole("button", { name: /^My Frost/ }).parentElement!;
    await user.click(within(row).getByRole("button", { name: "Delete My Frost" }));
    await waitFor(() => expect(appearance().themeId).toBe("graphite"));
    expect(useThemeStore.getState().activeThemeId).toBe("graphite");
    expect(screen.queryByRole("button", { name: /^My Frost/ })).not.toBeInTheDocument();
  });

  it("switches density and saves it", async () => {
    const user = userEvent.setup();
    render(<AppearancePanel />);
    const density = screen.getByRole("radiogroup", { name: "Density" });
    expect(within(density).getByRole("radio", { name: "Compact" })).toBeChecked();
    await user.click(within(density).getByRole("radio", { name: "Comfortable" }));
    expect(appearance().density).toBe("comfortable");
    expect(invoke).toHaveBeenCalledWith("settings_set", { key: "appearance.density", value: "comfortable" });
  });

  it("applies the UI scale only on Apply", async () => {
    const user = userEvent.setup();
    render(<AppearancePanel />);
    const value = screen.getByRole("spinbutton", { name: "UI scale value" });
    fireEvent.change(value, { target: { value: "1.25" } });
    expect(appearance().uiScale).toBe(1);
    await user.click(screen.getByRole("button", { name: "Revert" }));
    expect(value).toHaveValue(1);
    fireEvent.change(value, { target: { value: "3" } });
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(appearance().uiScale).toBe(2);
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  });

  it("keeps the opacity and blur sliders disabled until vibrancy is on", async () => {
    const user = userEvent.setup();
    render(<AppearancePanel />);
    expect(screen.getByRole("slider", { name: "Window opacity" })).toHaveAttribute("data-disabled");
    await user.click(screen.getByRole("switch", { name: "Vibrancy" }));
    expect(screen.getByRole("slider", { name: "Window opacity" })).not.toHaveAttribute("data-disabled");
    expect(screen.getByRole("slider", { name: "Blur intensity" })).not.toHaveAttribute("data-disabled");
  });

  it("resets the accent override", async () => {
    const user = userEvent.setup();
    useSettingsStore.setState((s) => ({
      settings: { ...s.settings, appearance: { ...s.settings.appearance, accentColorOverride: "#ff0000" } },
    }));
    render(<AppearancePanel />);
    expect(screen.getByLabelText("Accent color")).toHaveValue("#ff0000");
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(appearance().accentColorOverride).toBeNull();
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
  });
});

describe("AppearancePanel blur intensity", () => {
  it("shows a percentage, updates live and persists the value", async () => {
    const user = userEvent.setup();
    render(<AppearancePanel />);
    await user.click(screen.getByRole("switch", { name: "Vibrancy" }));
    const slider = screen.getByRole("slider", { name: "Blur intensity" });
    expect(slider).toHaveAttribute("aria-valuetext", "100%");
    slider.focus();
    await user.keyboard("{ArrowLeft}");
    await waitFor(() => expect(appearance().blurIntensity).toBeCloseTo(0.95));
    expect(slider).toHaveAttribute("aria-valuetext", "95%");
    expect(invoke).toHaveBeenCalledWith(
      "settings_set",
      expect.objectContaining({ key: "appearance.blurIntensity" })
    );
  });
});
