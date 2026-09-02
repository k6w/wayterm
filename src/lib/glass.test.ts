import { describe, expect, it } from "vitest";
import { BUILTIN_THEMES } from "../themes";
import { contrastRatio, WCAG_AA_TEXT } from "./contrast";
import { hexToRgba } from "./color";
import { CHROME_ALPHA_FLOOR, OVERLAY_ALPHA_FLOOR, chromeAlpha, overlayAlpha } from "./glass";

describe("glass alpha floors", () => {
  it("never lets chrome or overlays fall below their floor", () => {
    for (const theme of BUILTIN_THEMES) {
      expect(chromeAlpha(theme, 0.05)).toBeGreaterThanOrEqual(CHROME_ALPHA_FLOOR);
      expect(overlayAlpha(theme, 0.05)).toBeGreaterThanOrEqual(OVERLAY_ALPHA_FLOOR);
    }
  });

  it("keeps a more opaque user setting", () => {
    expect(chromeAlpha(BUILTIN_THEMES[0], 0.97)).toBe(0.97);
    expect(overlayAlpha(BUILTIN_THEMES[0], 0.97)).toBe(0.97);
  });
});

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
    for (const fg of ["text", "textSecondary", "textMuted"] as const) {
      for (const backdrop of ["#000000", "#ffffff"]) {
        it(`${fg} on ${name} glass over ${backdrop} meets 4.5:1`, () => {
          expect(contrastRatio(c[fg], hexToRgba(color, alpha), backdrop)).toBeGreaterThanOrEqual(
            WCAG_AA_TEXT
          );
        });
      }
    }
  }
});
