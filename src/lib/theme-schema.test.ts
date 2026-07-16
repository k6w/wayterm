import { describe, expect, it } from "vitest";
import { CHROME_KEYS } from "../types/theme";
import {
  ThemeValidationError,
  chromeCssVar,
  parseThemeFile,
  toThemeDefinition,
  toThemeFile,
} from "./theme-schema";

function validFile(): Record<string, unknown> {
  return {
    id: "my-theme",
    name: "My Theme",
    variant: "dark",
    chrome: Object.fromEntries(CHROME_KEYS.map((key) => [key, "#334455"])),
    terminal: {
      foreground: "#DDDDDD",
      background: "#111111",
      cursor: "#5b95ff",
      cursorAccent: "#111111",
      selection: "#5b95ff40",
      ansi: Array.from({ length: 16 }, () => "#808080"),
    },
  };
}

function fieldOf(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    if (err instanceof ThemeValidationError) return err.field;
    throw err;
  }
  throw new Error("expected a ThemeValidationError");
}

describe("parseThemeFile", () => {
  it("accepts a valid file and fills in default blur and opacity", () => {
    const file = parseThemeFile(validFile());
    expect(file.id).toBe("my-theme");
    expect(file.chrome.canvas).toBe("#334455");
    expect(file.terminal.foreground).toBe("#dddddd");
    expect(file.blur).toEqual({ sidebar: 20, blocks: 4, inputBar: 12, overlay: 30 });
    expect(file.opacity).toEqual({ sidebar: 0.4, blocks: 0.05, inputBar: 0.08 });
  });

  it("names a missing chrome token", () => {
    const input = validFile();
    delete (input.chrome as Record<string, unknown>).panel;
    expect(fieldOf(() => parseThemeFile(input))).toBe("chrome.panel");
  });

  it("rejects rgba() and named colors in chrome", () => {
    const input = validFile();
    (input.chrome as Record<string, unknown>).canvas = "rgba(0, 0, 0, 1)";
    expect(fieldOf(() => parseThemeFile(input))).toBe("chrome.canvas");
    (input.chrome as Record<string, unknown>).canvas = "black";
    expect(fieldOf(() => parseThemeFile(input))).toBe("chrome.canvas");
  });

  it("allows #rrggbbaa for translucent tokens but not for opaque ones", () => {
    const input = validFile();
    (input.chrome as Record<string, unknown>).accentSubtle = "#2f6be033";
    expect(parseThemeFile(input).chrome.accentSubtle).toBe("#2f6be033");
    (input.chrome as Record<string, unknown>).accent = "#2f6be033";
    expect(fieldOf(() => parseThemeFile(input))).toBe("chrome.accent");
  });

  it("validates the terminal palette", () => {
    const input = validFile();
    (input.terminal as Record<string, unknown>).ansi = Array.from({ length: 15 }, () => "#808080");
    expect(fieldOf(() => parseThemeFile(input))).toBe("terminal.ansi");
    (input.terminal as Record<string, unknown>).ansi = [
      ...Array.from({ length: 15 }, () => "#808080"),
      "#80808080",
    ];
    expect(fieldOf(() => parseThemeFile(input))).toBe("terminal.ansi[15]");
  });

  it("validates id, name, variant, blur and the top-level shape", () => {
    expect(fieldOf(() => parseThemeFile({ ...validFile(), id: "has spaces" }))).toBe("id");
    expect(fieldOf(() => parseThemeFile({ ...validFile(), name: "  " }))).toBe("name");
    expect(fieldOf(() => parseThemeFile({ ...validFile(), variant: "dim" }))).toBe("variant");
    expect(fieldOf(() => parseThemeFile({ ...validFile(), blur: { sidebar: -1 } }))).toBe("blur.sidebar");
    expect(fieldOf(() => parseThemeFile({ ...validFile(), chrome: undefined }))).toBe("chrome");
    expect(fieldOf(() => parseThemeFile([]))).toBe("theme");
  });

  it("puts the field name first in the error message", () => {
    const input = validFile();
    (input.chrome as Record<string, unknown>).canvas = "nope";
    expect(() => parseThemeFile(input)).toThrow(/^chrome\.canvas must be an opaque hex color/);
  });
});

describe("chromeCssVar", () => {
  it("maps camelCase tokens to --nx-kebab-case properties", () => {
    expect(chromeCssVar("canvas")).toBe("--nx-canvas");
    expect(chromeCssVar("borderStrong")).toBe("--nx-border-strong");
    expect(chromeCssVar("textOnAccent")).toBe("--nx-text-on-accent");
    expect(chromeCssVar("scrollbarThumbHover")).toBe("--nx-scrollbar-thumb-hover");
  });

  it("gives every token a distinct property", () => {
    expect(new Set(CHROME_KEYS.map(chromeCssVar)).size).toBe(CHROME_KEYS.length);
  });
});

describe("toThemeDefinition / toThemeFile", () => {
  it("derives the legacy ui block from chrome", () => {
    const input = validFile();
    const chrome = input.chrome as Record<string, string>;
    chrome.canvas = "#000001";
    chrome.danger = "#000002";
    chrome.focusRing = "#000003";
    const theme = toThemeDefinition(parseThemeFile(input));
    expect(theme.ui.bgPrimary).toBe("#000001");
    expect(theme.ui.error).toBe("#000002");
    expect(theme.ui.borderFocus).toBe("#000003");
  });

  it("round-trips through the on-disk schema without the legacy ui block", () => {
    const theme = toThemeDefinition(parseThemeFile(validFile()));
    const file = toThemeFile(theme);
    expect(file).not.toHaveProperty("ui");
    expect(toThemeDefinition(parseThemeFile(JSON.parse(JSON.stringify(file))))).toEqual(theme);
  });
});
