import { TERMINAL_FONT_FAMILY, UI_FONT_FAMILY } from "./fonts";

/** Bundled via @fontsource: always available, though not necessarily loaded when measured. */
const BUNDLED_FAMILIES = new Set([TERMINAL_FONT_FAMILY.toLowerCase(), UI_FONT_FAMILY.toLowerCase()]);

const GENERIC_FAMILIES = new Set([
  "monospace",
  "ui-monospace",
  "sans-serif",
  "serif",
  "system-ui",
  "ui-sans-serif",
  "ui-serif",
  "cursive",
  "fantasy",
]);

/**
 * The first family of a CSS font-family list, unquoted ("JetBrains Mono,
 * monospace" -> "JetBrains Mono"). Null when the list is empty or starts with
 * a generic family, which always exists.
 */
export function primaryFontFamily(fontFamily: string): string | null {
  const first = (fontFamily.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "").trim();
  return first && !GENERIC_FAMILIES.has(first.toLowerCase()) ? first : null;
}

/** Width of a sample string in the given CSS font, or null when text cannot be measured. */
export type TextMeasurer = (font: string) => number | null;

function canvasMeasurer(): TextMeasurer {
  let context: CanvasRenderingContext2D | null = null;
  try {
    context = document.createElement("canvas").getContext("2d");
  } catch {
    context = null;
  }
  return (font) => {
    if (!context) return null;
    context.font = font;
    return context.measureText("mmmmmmmmli").width;
  };
}

/**
 * A warning when the first family of `fontFamily` is not installed (it renders
 * exactly as the monospace fallback), otherwise null. Never throws.
 */
export function missingFontWarning(fontFamily: string, measure: TextMeasurer = canvasMeasurer()): string | null {
  const family = primaryFontFamily(fontFamily);
  if (!family || BUNDLED_FAMILIES.has(family.toLowerCase())) return null;
  const fallback = measure("16px monospace");
  const candidate = measure(`16px "${family}", monospace`);
  if (fallback === null || candidate === null) return null;
  return Math.abs(candidate - fallback) < 0.5 ? `Font "${family}" not found, falling back to monospace` : null;
}
