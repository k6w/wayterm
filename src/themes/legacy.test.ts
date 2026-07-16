import { describe, expect, it } from "vitest";
import { CHROME_KEYS } from "../types/theme";
import { ThemeValidationError, parseThemeFile, toThemeDefinition } from "../lib/theme-schema";
import { legacyUiToChrome, normalizeTheme } from "./legacy";

// The pre-redesign "Nexterm Dark" built-in, as users may still have it saved
// as a custom theme or a JSON file.
const LEGACY_NEXTERM_DARK = {
  id: "nexterm-dark-copy",
  name: "Nexterm Dark Copy",
  variant: "dark",
  terminal: {
    foreground: "#d4d4d4",
    background: "#0a0a0f",
    cursor: "#528bff",
    cursorAccent: "#0a0a0f",
    selection: "rgba(82, 139, 255, 0.25)",
    ansi: [
      "#1e1e2e", "#f38ba8", "#a6e3a1", "#f9e2af",
      "#89b4fa", "#cba6f7", "#94e2d5", "#bac2de",
      "#585b70", "#f38ba8", "#a6e3a1", "#f9e2af",
      "#89b4fa", "#cba6f7", "#94e2d5", "#a6adc8",
    ],
  },
  ui: {
    bgPrimary: "#0a0a0f",
    bgSecondary: "#12121a",
    bgTertiary: "#1a1a26",
    textPrimary: "#eaeaf0",
    textSecondary: "#c4c4d4",
    textMuted: "#707088",
    accent: "#528bff",
    accentHover: "#6b9fff",
    border: "rgba(255, 255, 255, 0.08)",
    borderFocus: "#528bff",
    success: "#a6e3a1",
    warning: "#f9e2af",
    error: "#f38ba8",
  },
  blur: { sidebar: 20, blocks: 4, inputBar: 12, overlay: 30 },
  opacity: { sidebar: 0.4, blocks: 0.05, inputBar: 0.08 },
};

describe("normalizeTheme with a pre-redesign theme", () => {
  it("upgrades the ui block to a complete, valid chrome set", () => {
    const theme = normalizeTheme(LEGACY_NEXTERM_DARK);
    for (const key of CHROME_KEYS) expect(theme.chrome[key]).toMatch(/^#[0-9a-f]{6}([0-9a-f]{2})?$/);
    expect(theme.chrome.canvas).toBe("#0a0a0f");
    expect(theme.chrome.panel).toBe("#12121a");
    expect(theme.chrome.danger).toBe("#f38ba8");
  });

  it("composites translucent legacy colors into opaque tokens", () => {
    const theme = normalizeTheme(LEGACY_NEXTERM_DARK);
    // rgba(255,255,255,0.08) over the #12121a panel
    expect(theme.chrome.border).toBe("#25252c");
    expect(theme.terminal.selection).toBe("#528bff40");
  });

  it("keeps the legacy ui view equal to the original opaque values", () => {
    const theme = normalizeTheme(LEGACY_NEXTERM_DARK);
    expect(theme.ui.bgPrimary).toBe("#0a0a0f");
    expect(theme.ui.accent).toBe("#528bff");
    expect(theme.ui.error).toBe("#f38ba8");
  });

  it("fills optional terminal fields", () => {
    const { cursor: _c, cursorAccent: _a, selection: _s, ...terminal } = LEGACY_NEXTERM_DARK.terminal;
    const theme = normalizeTheme({ ...LEGACY_NEXTERM_DARK, terminal });
    expect(theme.terminal.cursor).toBe("#d4d4d4");
    expect(theme.terminal.cursorAccent).toBe("#0a0a0f");
    expect(theme.terminal.selection).toBe("#528bff40");
  });

  it("names the missing or unparseable legacy field", () => {
    const { accent: _accent, ...noAccent } = LEGACY_NEXTERM_DARK.ui;
    expect(() => normalizeTheme({ ...LEGACY_NEXTERM_DARK, ui: noAccent })).toThrow(ThemeValidationError);
    expect(() => normalizeTheme({ ...LEGACY_NEXTERM_DARK, ui: noAccent })).toThrow(/^ui\.accent is missing/);
    expect(() =>
      normalizeTheme({ ...LEGACY_NEXTERM_DARK, ui: { ...LEGACY_NEXTERM_DARK.ui, textPrimary: "white" } })
    ).toThrow(/^ui\.textPrimary/);
  });
});

describe("normalizeTheme with the current schema", () => {
  it("is the same as parseThemeFile + toThemeDefinition", () => {
    const upgraded = normalizeTheme(LEGACY_NEXTERM_DARK);
    const file = { ...upgraded, ui: undefined };
    expect(normalizeTheme(file)).toEqual(toThemeDefinition(parseThemeFile(file)));
  });
});

describe("legacyUiToChrome", () => {
  it("picks readable text for the accent", () => {
    expect(legacyUiToChrome({ ...LEGACY_NEXTERM_DARK.ui, accent: "#1d4ed8" }, "dark").textOnAccent).toBe("#ffffff");
    expect(legacyUiToChrome({ ...LEGACY_NEXTERM_DARK.ui, accent: "#f9e2af" }, "dark").textOnAccent).toBe("#111111");
  });
});
