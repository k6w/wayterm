/** Parse a hex color like "#0a0a0f" into [r, g, b]. */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/**
 * Convert a hex color string to an rgba() string with the given alpha.
 * If the input is already an rgb/rgba string, it replaces the alpha.
 */
export function hexToRgba(hex: string, alpha: number): string {
  if (hex.startsWith("rgba(")) {
    // Replace existing alpha: "rgba(r, g, b, oldAlpha)" -> "rgba(r, g, b, newAlpha)"
    return hex.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
  }
  if (hex.startsWith("rgb(")) {
    // "rgb(r, g, b)" -> "rgba(r, g, b, alpha)"
    return hex.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  }
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
