import type { ThemeDefinition } from "../types/theme";
import { hexToRgba } from "./color";
import { contrastRatio, WCAG_AA_NON_TEXT, WCAG_AA_TEXT } from "./contrast";

/** Minimum backing alpha of chrome surfaces that carry text (sidebar, titlebar, status bar). */
export const CHROME_ALPHA_FLOOR = 0.6;
/** Minimum backing alpha of floating surfaces (dialogs, palette, menus, popovers). */
export const OVERLAY_ALPHA_FLOOR = 0.78;

const TEXT_TOKENS = ["text", "textSecondary", "textMuted"] as const;
const SURFACE_TOKENS = ["panel", "raised", "tabBar", "statusBar"] as const;
/**
 * Native vibrancy follows the theme appearance, so the worst-case backdrop is
 * the matching material: dark themes span black to a mid-dark material tone,
 * light themes white to a mid-light one.
 */
const gray = (...channels: string[]) => "#".concat(...channels);
const BACKDROPS = {
  dark: [gray("00", "00", "00"), gray("3a", "3a", "3c")],
  light: [gray("ff", "ff", "ff"), gray("c8", "c8", "cc")],
};
/** text/textSecondary need body-text contrast; textMuted is secondary UI, held to the 3:1 non-text guidance. */
const REQUIRED = { text: WCAG_AA_TEXT, textSecondary: WCAG_AA_TEXT, textMuted: WCAG_AA_NON_TEXT } as const;

function passes(theme: ThemeDefinition, alpha: number): boolean {
  const c = theme.chrome;
  return SURFACE_TOKENS.every((surface) =>
    TEXT_TOKENS.every((fg) =>
      BACKDROPS[theme.variant].every(
        (backdrop) =>
          contrastRatio(c[fg], hexToRgba(c[surface], alpha), backdrop) >= REQUIRED[fg]
      )
    )
  );
}

const cache = new Map<string, number>();

/**
 * Lowest alpha at or above `floor` where every text token meets its contrast
 * target on every glass surface across the theme-matched backdrop range. Derived from
 * the theme's own surface and text tokens, so a theme with muted text needs a
 * firmer backing than one with strong text.
 */
function readableFloor(theme: ThemeDefinition, floor: number): number {
  const key = `${theme.id}:${JSON.stringify(theme.chrome)}:${floor}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let alpha = floor;
  while (alpha < 1 && !passes(theme, alpha)) alpha = Math.min(1, Math.round((alpha + 0.01) * 100) / 100);
  cache.set(key, alpha);
  return alpha;
}

/** Backing alpha for chrome surfaces given the user's (platform-adjusted) glass alpha. */
export function chromeAlpha(theme: ThemeDefinition, userAlpha: number): number {
  return Math.max(userAlpha, readableFloor(theme, CHROME_ALPHA_FLOOR));
}

/** Backing alpha for dialogs, the palette, menus and popovers. */
export function overlayAlpha(theme: ThemeDefinition, userAlpha: number): number {
  return Math.max(userAlpha, readableFloor(theme, OVERLAY_ALPHA_FLOOR));
}
