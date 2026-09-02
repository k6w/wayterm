import type { ThemeDefinition } from "../types/theme";
import { hexToRgba } from "./color";
import { contrastRatio, WCAG_AA_TEXT } from "./contrast";

/** Minimum backing alpha of chrome surfaces that carry text (sidebar, titlebar, status bar). */
export const CHROME_ALPHA_FLOOR = 0.72;
/** Minimum backing alpha of floating surfaces (dialogs, palette, menus, popovers). */
export const OVERLAY_ALPHA_FLOOR = 0.85;

const TEXT_TOKENS = ["text", "textSecondary", "textMuted"] as const;
const SURFACE_TOKENS = ["panel", "raised", "tabBar", "statusBar"] as const;
const BACKDROPS = ["#000000", "#ffffff"] as const;

function passes(theme: ThemeDefinition, alpha: number): boolean {
  const c = theme.chrome;
  return SURFACE_TOKENS.every((surface) =>
    TEXT_TOKENS.every((fg) =>
      BACKDROPS.every(
        (backdrop) =>
          contrastRatio(c[fg], hexToRgba(c[surface], alpha), backdrop) >= WCAG_AA_TEXT
      )
    )
  );
}

const cache = new Map<string, number>();

/**
 * Lowest alpha at or above `floor` where every body-text token stays at 4.5:1
 * on every glass surface over both a black and a white backdrop. Derived from
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
