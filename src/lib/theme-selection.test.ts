import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { selectTheme } from "./theme-selection";
import { useSettingsStore } from "../stores/settings";
import { useThemeStore } from "../stores/theme";

beforeEach(() => {
  useThemeStore.setState(useThemeStore.getInitialState(), true);
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
});

describe("selectTheme", () => {
  it("activates and persists the theme", async () => {
    await selectTheme("paper");
    expect(useThemeStore.getState().activeThemeId).toBe("paper");
    expect(useSettingsStore.getState().settings.appearance.themeId).toBe("paper");
    expect(invoke).toHaveBeenCalledWith("settings_set", { key: "appearance.themeId", value: "paper" });
  });

  it("ignores unknown ids", async () => {
    await selectTheme("dracula");
    expect(useThemeStore.getState().activeThemeId).toBe("graphite");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("keeps the theme for the session when saving fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(invoke).mockRejectedValueOnce(new Error("db locked"));
    await selectTheme("ember");
    expect(useThemeStore.getState().activeThemeId).toBe("ember");
    expect(warn).toHaveBeenCalled();
  });
});
