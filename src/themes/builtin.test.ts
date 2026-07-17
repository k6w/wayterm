import { describe, expect, it } from "vitest";
import type { ChromeKey } from "../types/theme";
import { contrastRatio, WCAG_AA_NON_TEXT, WCAG_AA_TEXT } from "../lib/contrast";
import {
  BUILTIN_THEMES,
  BUILTIN_THEME_MAP,
  DEFAULT_THEME_ID,
  REMOVED_BUILTIN_THEMES,
  isBuiltinThemeId,
} from "./index";

// Every text token, and every surface it is drawn on, must reach 4.5:1
// (spec section 2). textDisabled is exempt (WCAG 1.4.3 excludes inactive UI).
const TEXT_PAIRS: ReadonlyArray<readonly [ChromeKey, readonly ChromeKey[]]> = [
  ["text", ["canvas", "panel", "raised", "hover", "active", "tabBar", "tabActive", "statusBar", "inputBg"]],
  ["textSecondary", ["canvas", "panel", "raised", "hover", "tabBar", "tabActive", "statusBar"]],
  ["textMuted", ["canvas", "panel", "raised", "tabBar", "statusBar"]],
  ["textOnAccent", ["accent", "accentHover", "accentActive"]],
  ["accentText", ["canvas", "panel", "raised"]],
  ["tooltipText", ["tooltipBg"]],
  ["kbdText", ["kbdBg"]],
  ["success", ["canvas", "panel"]],
  ["warning", ["canvas", "panel"]],
  ["danger", ["canvas", "panel"]],
  ["info", ["canvas", "panel"]],
];

describe.each(BUILTIN_THEMES.map((theme) => [theme.name, theme] as const))("%s", (_name, theme) => {
  const c = theme.chrome;

  for (const [fg, backgrounds] of TEXT_PAIRS) {
    for (const bg of backgrounds) {
      it(`${fg} on ${bg} meets WCAG AA (4.5:1)`, () => {
        expect(contrastRatio(c[fg], c[bg], c.canvas)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      });
    }
  }

  it("text on a selected row (accentSubtle over panel) meets WCAG AA", () => {
    expect(contrastRatio(c.text, c.accentSubtle, c.panel)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });

  it("focus ring reaches 3:1 against canvas and panel", () => {
    expect(contrastRatio(c.focusRing, c.canvas, c.canvas)).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
    expect(contrastRatio(c.focusRing, c.panel, c.canvas)).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
  });

  it("terminal foreground meets WCAG AA on the terminal background", () => {
    const { foreground, background } = theme.terminal;
    expect(contrastRatio(foreground, background, background)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });
});

describe("built-in theme registry", () => {
  it("ships Graphite, Frost, Ember and Paper, with Graphite as default", () => {
    expect(BUILTIN_THEMES.map((t) => t.id)).toEqual(["graphite", "frost", "ember", "paper"]);
    expect(DEFAULT_THEME_ID).toBe("graphite");
    expect(BUILTIN_THEME_MAP.graphite.name).toBe("Graphite");
  });

  it("has exactly one light theme, Paper", () => {
    expect(BUILTIN_THEMES.filter((t) => t.variant === "light").map((t) => t.id)).toEqual(["paper"]);
  });

  it("lists the 18 removed themes and none of the current ones", () => {
    expect(Object.keys(REMOVED_BUILTIN_THEMES)).toHaveLength(18);
    for (const id of Object.keys(REMOVED_BUILTIN_THEMES)) expect(isBuiltinThemeId(id)).toBe(false);
    expect(isBuiltinThemeId("graphite")).toBe(true);
    expect(isBuiltinThemeId("toString")).toBe(false);
  });
});
