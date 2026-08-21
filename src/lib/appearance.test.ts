import { beforeEach, describe, expect, it } from "vitest";
import { applyAppearanceToDom } from "./appearance";
import { useSettingsStore } from "../stores/settings";
import { applyThemeToDom } from "../stores/theme";
import { BUILTIN_THEME_MAP } from "../themes";
import type { AppearanceSettings } from "../types/settings";

const graphite = BUILTIN_THEME_MAP.graphite;
const paper = BUILTIN_THEME_MAP.paper;

function appearance(overrides: Partial<AppearanceSettings> = {}): AppearanceSettings {
  return { ...useSettingsStore.getInitialState().settings.appearance, ...overrides };
}

const css = (name: string) => document.documentElement.style.getPropertyValue(name);

beforeEach(() => {
  document.documentElement.removeAttribute("style");
  document.documentElement.removeAttribute("data-vibrancy");
  document.documentElement.removeAttribute("data-density");
});

describe("applyAppearanceToDom", () => {
  it("uses the theme accent family when there is no override", () => {
    applyAppearanceToDom(appearance(), graphite);
    expect(css("--nx-accent")).toBe(graphite.chrome.accent);
    expect(css("--nx-accent-subtle")).toBe(graphite.chrome.accentSubtle);
    expect(css("--nx-focus-ring")).toBe(graphite.chrome.focusRing);
    expect(css("--accent")).toBe(graphite.chrome.accent);
  });

  it("applies a valid accent override to every accent token", () => {
    applyAppearanceToDom(appearance({ accentColorOverride: "#ff0000" }), graphite);
    expect(css("--nx-accent")).toBe("#ff0000");
    expect(css("--nx-accent-hover")).toBe("#ff0000");
    expect(css("--nx-accent-text")).toBe("#ff0000");
    expect(css("--nx-focus-ring")).toBe("#ff0000");
    expect(css("--nx-accent-subtle")).toBe("rgba(255, 0, 0, 0.2)");
    expect(css("--accent")).toBe("#ff0000");
  });

  it("ignores an override that is not #rrggbb", () => {
    applyAppearanceToDom(appearance({ accentColorOverride: "red" }), graphite);
    expect(css("--nx-accent")).toBe(graphite.chrome.accent);
  });

  it("restores the theme accent when the override is cleared", () => {
    applyAppearanceToDom(appearance({ accentColorOverride: "#ff0000" }), graphite);
    applyAppearanceToDom(appearance({ accentColorOverride: null }), graphite);
    expect(css("--nx-accent")).toBe(graphite.chrome.accent);
  });

  it("keeps the override after a theme switch re-applies the theme", () => {
    applyThemeToDom(paper);
    applyAppearanceToDom(appearance({ accentColorOverride: "#ff0000" }), paper);
    expect(css("--nx-accent")).toBe("#ff0000");
    expect(css("--nx-canvas")).toBe(paper.chrome.canvas);
  });

  it("makes glass surfaces opaque while vibrancy is off", () => {
    applyAppearanceToDom(appearance({ vibrancyEnabled: false }), graphite);
    expect(css("--nx-glass-canvas")).toBe(graphite.chrome.canvas);
    expect(css("--nx-glass-panel")).toBe(graphite.chrome.panel);
    expect(css("--nx-glass-status-bar")).toBe(graphite.chrome.statusBar);
    expect(document.documentElement.hasAttribute("data-vibrancy")).toBe(false);
  });

  it("makes glass surfaces translucent while vibrancy is on", () => {
    // jsdom is not macOS, so vibrancyAlpha(0.8) is 0.8 and overlays get 0.8 * 0.85.
    applyAppearanceToDom(appearance({ vibrancyEnabled: true, windowOpacity: 0.8 }), graphite);
    expect(css("--nx-glass-canvas")).toBe("rgba(15, 16, 18, 0.8)");
    expect(css("--nx-glass-panel")).toBe("rgba(21, 22, 24, 0.8)");
    expect(css("--nx-glass-raised")).toBe("rgba(28, 29, 32, 0.68)");
    expect(document.documentElement.getAttribute("data-vibrancy")).toBe("on");
  });

  it("sets comfortable density on the root and clears it for compact", () => {
    applyAppearanceToDom(appearance({ density: "comfortable" }), graphite);
    expect(document.documentElement.getAttribute("data-density")).toBe("comfortable");
    applyAppearanceToDom(appearance({ density: "compact" }), graphite);
    expect(document.documentElement.hasAttribute("data-density")).toBe(false);
  });

  it("defaults to compact density and no longer applies the old compact mode", () => {
    applyAppearanceToDom(appearance({ compactMode: true }), graphite);
    expect(document.documentElement.hasAttribute("data-density")).toBe(false);
    expect(document.documentElement.hasAttribute("data-compact")).toBe(false);
  });
});
