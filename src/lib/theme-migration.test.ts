import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./ipc", () => ({
  settingsGetAll: vi.fn(async () => ({})),
  settingsSet: vi.fn(async () => {}),
  customThemeList: vi.fn(async () => []),
  customThemeSave: vi.fn(async () => {}),
  customThemeDelete: vi.fn(async () => {}),
}));

import { settingsSet } from "./ipc";
import { applyStartupTheme, resolveStartupTheme } from "./theme-migration";
import { parseThemeFile, toThemeDefinition } from "./theme-schema";
import { useSettingsStore } from "../stores/settings";
import { useThemeStore } from "../stores/theme";
import { useToastStore } from "../stores/toast";
import graphite from "../themes/graphite.json";

function setStoredTheme(themeId: string) {
  useSettingsStore.setState((s) => ({
    settings: { ...s.settings, appearance: { ...s.settings.appearance, themeId } },
  }));
}

beforeEach(() => {
  useThemeStore.setState(useThemeStore.getInitialState(), true);
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useToastStore.setState({ toasts: [] });
  vi.mocked(settingsSet).mockResolvedValue(undefined);
});

describe("resolveStartupTheme", () => {
  const available = ["graphite", "frost", "ember", "paper", "my-custom"];

  it("keeps a theme that still exists", () => {
    expect(resolveStartupTheme("frost", available)).toEqual({
      themeId: "frost",
      retiredThemeName: null,
      needsPersist: false,
    });
    expect(resolveStartupTheme("my-custom", available).themeId).toBe("my-custom");
  });

  it("moves a removed built-in to Graphite and names it", () => {
    expect(resolveStartupTheme("tokyo-night", available)).toEqual({
      themeId: "graphite",
      retiredThemeName: "Tokyo Night",
      needsPersist: true,
    });
  });

  it("moves a deleted custom theme to Graphite without a notice", () => {
    expect(resolveStartupTheme("gone-custom", available)).toEqual({
      themeId: "graphite",
      retiredThemeName: null,
      needsPersist: true,
    });
  });

  it("treats a missing id as Graphite", () => {
    expect(resolveStartupTheme(undefined, available)).toMatchObject({
      themeId: "graphite",
      retiredThemeName: null,
    });
  });
});

describe("applyStartupTheme", () => {
  it("switches a user on a removed theme to Graphite, persists it and shows one notice", async () => {
    setStoredTheme("dracula");
    await applyStartupTheme();

    expect(useThemeStore.getState().activeThemeId).toBe("graphite");
    expect(useSettingsStore.getState().settings.appearance.themeId).toBe("graphite");
    expect(settingsSet).toHaveBeenCalledWith("appearance.themeId", "graphite");
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].variant).toBe("info");
    expect(toasts[0].message).toContain('"Dracula"');
  });

  it("shows the notice only once: the next launch finds Graphite saved", async () => {
    setStoredTheme("dracula");
    await applyStartupTheme();
    vi.mocked(settingsSet).mockClear();

    await applyStartupTheme();

    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(settingsSet).not.toHaveBeenCalled();
  });

  it("keeps a custom theme that reuses a removed built-in id", async () => {
    useThemeStore
      .getState()
      .registerTheme(toThemeDefinition(parseThemeFile({ ...graphite, id: "dracula", name: "My Dracula" })));
    setStoredTheme("dracula");
    await applyStartupTheme();

    expect(useThemeStore.getState().activeThemeId).toBe("dracula");
    expect(useToastStore.getState().toasts).toHaveLength(0);
    expect(settingsSet).not.toHaveBeenCalled();
  });

  it("still switches and notifies when persisting fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(settingsSet).mockRejectedValue(new Error("db locked"));
    setStoredTheme("nord");
    await applyStartupTheme();

    expect(useThemeStore.getState().activeThemeId).toBe("graphite");
    expect(useToastStore.getState().toasts[0].message).toContain('"Nord"');
    expect(warn).toHaveBeenCalled();
  });
});
