export const isMac = navigator.platform.toLowerCase().includes("mac");

/**
 * On macOS the native NSVisualEffectView provides the blur behind the window.
 * CSS backgrounds sit on top as a tint, so we scale the alpha down so the
 * vibrancy effect shows through at comfortable slider values.
 */
export function vibrancyAlpha(opacity: number): number {
  return isMac ? opacity * 0.5 : opacity;
}
