import { compositeOver, parseCssColor, type Rgba } from "./color";

/** WCAG 2.x AA minimum for body text. */
export const WCAG_AA_TEXT = 4.5;
/** WCAG 2.x AA minimum for UI components and focus indicators. */
export const WCAG_AA_NON_TEXT = 3;

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of an opaque color. */
export function relativeLuminance(color: Rgba): number {
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

/**
 * WCAG contrast ratio of `foreground` drawn on `background`. Translucent
 * colors are composited first: `background` over the opaque `backdrop`, then
 * `foreground` over that result.
 */
export function contrastRatio(foreground: string, background: string, backdrop: string): number {
  const fg = parseCssColor(foreground);
  const bg = parseCssColor(background);
  const base = parseCssColor(backdrop);
  if (!fg || !bg || !base) {
    throw new Error(`contrastRatio: invalid color in (${foreground}, ${background}, ${backdrop})`);
  }
  const solidBackground = compositeOver(bg, { ...base, a: 1 });
  const solidForeground = compositeOver(fg, solidBackground);
  const l1 = relativeLuminance(solidForeground);
  const l2 = relativeLuminance(solidBackground);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
