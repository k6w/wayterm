import { describe, expect, it } from "vitest";
import { BUILTIN_THEMES } from "../themes";
import { contrastRatio, WCAG_AA_NON_TEXT, WCAG_AA_TEXT } from "./contrast";
import { hexToRgba } from "./color";
import { CHROME_ALPHA_FLOOR, OVERLAY_ALPHA_FLOOR, chromeAlpha, overlayAlpha } from "./glass";

describe("glass alpha floors", () => {
  it("never lets chrome or overlays fall below their floor", () => {
    for (const theme of BUILTIN_THEMES) {
      expect(chromeAlpha(theme, 0.05)).toBeGreaterThanOrEqual(CHROME_ALPHA_FLOOR);
      expect(overlayAlpha(theme, 0.05)).toBeGreaterThanOrEqual(OVERLAY_ALPHA_FLOOR);
    }
  });

  it("uses the documented minimum floors", () => {
    expect(CHROME_ALPHA_FLOOR).toBe(0.6);
    expect(OVERLAY_ALPHA_FLOOR).toBe(0.78);
  });

  it("keeps a more opaque user setting", () => {
    expect(chromeAlpha(BUILTIN_THEMES[0], 0.97)).toBe(0.97);
    expect(overlayAlpha(BUILTIN_THEMES[0], 0.97)).toBe(0.97);
  });
});

/**
 * Native vibrancy follows the theme appearance, so the realistic worst-case
 * backdrop is the matching material, not the opposite extreme: dark themes sit
 * over #000000..#3a3a3c, light themes over #ffffff..#c8c8cc.
 *
 * text and textSecondary need 4.5:1 (WCAG AA body text). textMuted is
 * secondary/large UI (hints, placeholders, disabled-ish labels), so it follows
 * the WCAG 3:1 guidance for non-text and large-text contrast.
 */
const BACKDROPS = {
  dark: ["#000000", "#3a3a3c"],
  light: ["#ffffff", "#c8c8cc"],
} as const;
const REQUIRED = { text: WCAG_AA_TEXT, textSecondary: WCAG_AA_TEXT, textMuted: WCAG_AA_NON_TEXT } as const;
const FG_TOKENS = ["text", "textSecondary", "textMuted"] as const;
const SURFACE_TOKENS = ["panel", "raised", "tabBar", "statusBar"] as const;

function allPass(theme: (typeof BUILTIN_THEMES)[number], alpha: number): boolean {
  const c = theme.chrome;
  return SURFACE_TOKENS.every((s) =>
    FG_TOKENS.every((fg) =>
      BACKDROPS[theme.variant].every(
        (b) => contrastRatio(c[fg], hexToRgba(c[s], alpha), b) >= REQUIRED[fg]
      )
    )
  );
}

describe.each(BUILTIN_THEMES.map((t) => [t.name, t] as const))("%s glass contrast", (_n, theme) => {
  const c = theme.chrome;
  const surfaces = [
    ["panel", c.panel, chromeAlpha(theme, 0)],
    ["tabBar", c.tabBar, chromeAlpha(theme, 0)],
    ["statusBar", c.statusBar, chromeAlpha(theme, 0)],
    ["raised", c.raised, overlayAlpha(theme, 0)],
    ["dialog panel", c.panel, overlayAlpha(theme, 0)],
  ] as const;
  for (const [name, color, alpha] of surfaces) {
    for (const fg of FG_TOKENS) {
      for (const backdrop of BACKDROPS[theme.variant]) {
        it(`${fg} on ${name} glass over ${backdrop} meets ${REQUIRED[fg]}:1`, () => {
          expect(contrastRatio(c[fg], hexToRgba(color, alpha), backdrop)).toBeGreaterThanOrEqual(
            REQUIRED[fg]
          );
        });
      }
    }
  }

  it("floors are the lowest alpha that passes (vibrancy is not over-suppressed)", () => {
    for (const [floor, fn] of [
      [CHROME_ALPHA_FLOOR, chromeAlpha],
      [OVERLAY_ALPHA_FLOOR, overlayAlpha],
    ] as const) {
      const alpha = fn(theme, 0);
      expect(allPass(theme, alpha)).toBe(true);
      if (alpha > floor) expect(allPass(theme, Math.round((alpha - 0.01) * 100) / 100)).toBe(false);
    }
  });
});
