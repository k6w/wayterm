import { describe, expect, it } from "vitest";
import { contrastRatio, WCAG_AA_NON_TEXT, WCAG_AA_TEXT } from "../contrast";
import { parseCssColor } from "../color";
import { BUILTIN_THEMES, BUILTIN_THEME_MAP } from "../../themes";

/** `color` at `factor` of its own opacity, as Tailwind's `/60` modifier draws it. */
function fade(color: string, factor: number): string {
  const c = parseCssColor(color)!;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a * factor})`;
}

// The overlay draws on the terminal background with chrome tokens only: the selection
// (accent-subtle at 60% under the text, accent left border), the gutter marks (success,
// danger) and durations (fg-muted, 10px).
describe.each(BUILTIN_THEMES.map((t) => [t.name, t] as const))("command blocks on %s", (_name, theme) => {
  const bg = theme.terminal.background;
  const c = theme.chrome;

  it("keeps terminal text readable on a selected block", () => {
    expect(contrastRatio(theme.terminal.foreground, fade(c.accentSubtle, 0.6), bg)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });

  it("draws the selection border and status marks visibly", () => {
    for (const mark of [c.accent, c.success, c.danger]) {
      expect(contrastRatio(mark, bg, bg)).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
    }
  });

  it("draws durations as readable text", () => {
    expect(contrastRatio(c.textMuted, bg, bg)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });
});

describe("Paper (light)", () => {
  it("still tints a selected block noticeably", () => {
    const paper = BUILTIN_THEME_MAP.paper;
    const tinted = contrastRatio(fade(paper.chrome.accentSubtle, 0.6), paper.terminal.background, paper.terminal.background);
    expect(tinted).toBeGreaterThan(1.02);
  });
});
