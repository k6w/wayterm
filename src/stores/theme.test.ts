import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/ipc", () => ({
  customThemeList: vi.fn(async () => []),
  customThemeSave: vi.fn(async () => {}),
  customThemeDelete: vi.fn(async () => {}),
}));

import { customThemeDelete, customThemeList, customThemeSave } from "../lib/ipc";
import graphite from "../themes/graphite.json";
import { applyThemeToDom, useThemeStore } from "./theme";

const LEGACY_CUSTOM = {
  id: "my-legacy",
  name: "My Legacy",
  variant: "dark",
  terminal: {
    foreground: "#d4d4d4",
    background: "#101014",
    cursor: "#528bff",
    cursorAccent: "#101014",
    selection: "rgba(82, 139, 255, 0.25)",
    ansi: Array.from({ length: 16 }, () => "#808080"),
  },
  ui: {
    bgPrimary: "#101014",
    bgSecondary: "#16161c",
    bgTertiary: "#1e1e26",
    textPrimary: "#eaeaf0",
    textSecondary: "#c4c4d4",
    textMuted: "#8a8aa0",
    accent: "#528bff",
    accentHover: "#6b9fff",
    border: "rgba(255, 255, 255, 0.08)",
    borderFocus: "#528bff",
    success: "#a6e3a1",
    warning: "#f9e2af",
    error: "#f38ba8",
  },
};

function newSchemaTheme(id = "my-theme") {
  return { ...graphite, id, name: "My Theme" };
}

beforeEach(() => {
  useThemeStore.setState(useThemeStore.getInitialState(), true);
  vi.mocked(customThemeList).mockResolvedValue([]);
});

describe("theme store", () => {
  it("starts on Graphite with only the four built-in themes", () => {
    const state = useThemeStore.getState();
    expect(state.activeThemeId).toBe("graphite");
    expect(state.active.id).toBe("graphite");
    expect(Object.keys(state.themes).sort()).toEqual(["ember", "frost", "graphite", "paper"]);
  });

  it("ignores unknown theme ids", () => {
    useThemeStore.getState().setTheme("dracula");
    expect(useThemeStore.getState().activeThemeId).toBe("graphite");
  });

  it("previews a theme and restores the active one", () => {
    useThemeStore.getState().previewTheme("paper");
    expect(useThemeStore.getState().active.id).toBe("paper");
    expect(useThemeStore.getState().previewThemeId).toBe("paper");
    useThemeStore.getState().previewTheme(null);
    expect(useThemeStore.getState().active.id).toBe("graphite");
    expect(useThemeStore.getState().previewThemeId).toBeNull();
  });
});

describe("importTheme", () => {
  it("imports a theme in the current schema and stores it without the legacy ui block", async () => {
    const theme = await useThemeStore.getState().importTheme(JSON.stringify(newSchemaTheme()));
    expect(theme.id).toBe("my-theme");
    expect(customThemeSave).toHaveBeenCalledTimes(1);
    const [savedId, savedJson] = vi.mocked(customThemeSave).mock.calls[0];
    expect(savedId).toBe("my-theme");
    const saved = JSON.parse(savedJson);
    expect(saved.chrome.canvas).toBe(graphite.chrome.canvas);
    expect(saved).not.toHaveProperty("ui");
    expect(useThemeStore.getState().themes["my-theme"]).toBeDefined();
    expect(useThemeStore.getState().customThemeIds.has("my-theme")).toBe(true);
  });

  it("still accepts a pre-redesign theme file", async () => {
    const theme = await useThemeStore.getState().importTheme(JSON.stringify(LEGACY_CUSTOM));
    expect(theme.chrome.canvas).toBe("#101014");
  });

  it("rejects an invalid token, naming the field, and saves nothing", async () => {
    const bad = newSchemaTheme();
    bad.chrome = { ...bad.chrome, canvas: "rgba(0, 0, 0, 1)" };
    await expect(useThemeStore.getState().importTheme(JSON.stringify(bad))).rejects.toThrow(
      /^Invalid theme: chrome\.canvas/
    );
    expect(customThemeSave).not.toHaveBeenCalled();
    expect(useThemeStore.getState().themes["my-theme"]).toBeUndefined();
  });

  it("rejects malformed JSON", async () => {
    await expect(useThemeStore.getState().importTheme("{")).rejects.toThrow("Invalid JSON");
  });

  it("rejects ids that clash with a built-in theme", async () => {
    await expect(
      useThemeStore.getState().importTheme(JSON.stringify(newSchemaTheme("frost")))
    ).rejects.toThrow(/conflicts with a built-in theme/);
    expect(customThemeSave).not.toHaveBeenCalled();
  });
});

describe("loadCustomThemes", () => {
  it("loads valid rows (upgrading legacy ones) and skips broken ones", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(customThemeList).mockResolvedValue([
      { id: "my-legacy", themeJson: JSON.stringify(LEGACY_CUSTOM) },
      { id: "broken", themeJson: "{" },
      { id: "graphite", themeJson: JSON.stringify(newSchemaTheme("graphite")) },
    ]);
    await useThemeStore.getState().loadCustomThemes();
    const state = useThemeStore.getState();
    expect(state.themes["my-legacy"].chrome.canvas).toBe("#101014");
    expect([...state.customThemeIds]).toEqual(["my-legacy"]);
    expect(state.themes.graphite.name).toBe("Graphite");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"broken"'));
  });
});

describe("removeCustomTheme", () => {
  it("falls back to Graphite when the active custom theme is removed", async () => {
    await useThemeStore.getState().importTheme(JSON.stringify(newSchemaTheme()));
    useThemeStore.getState().setTheme("my-theme");
    await useThemeStore.getState().removeCustomTheme("my-theme");
    expect(customThemeDelete).toHaveBeenCalledWith("my-theme");
    expect(useThemeStore.getState().activeThemeId).toBe("graphite");
    expect(useThemeStore.getState().themes["my-theme"]).toBeUndefined();
  });

  it("never removes a built-in theme", async () => {
    await useThemeStore.getState().removeCustomTheme("paper");
    expect(customThemeDelete).not.toHaveBeenCalled();
    expect(useThemeStore.getState().themes.paper).toBeDefined();
  });
});

describe("applyThemeToDom", () => {
  it("writes every chrome token and the legacy variables", () => {
    const paper = useThemeStore.getState().themes.paper;
    applyThemeToDom(paper);
    const style = document.documentElement.style;
    expect(style.getPropertyValue("--nx-canvas")).toBe(paper.chrome.canvas);
    expect(style.getPropertyValue("--nx-border-strong")).toBe(paper.chrome.borderStrong);
    expect(style.getPropertyValue("--nx-text-on-accent")).toBe(paper.chrome.textOnAccent);
    expect(style.getPropertyValue("--bg-primary")).toBe(paper.chrome.canvas);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
