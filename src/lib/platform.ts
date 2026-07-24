export const isMac = navigator.platform.toLowerCase().includes("mac");

/** Horizontal width reserved beside the native macOS traffic lights, so the
 *  horizontal title bar's tab strip starts to their right. */
export const MAC_TRAFFIC_LIGHT_INSET = 80;

export function vibrancyAlpha(opacity: number): number {
  return isMac ? opacity * 0.5 : opacity;
}
