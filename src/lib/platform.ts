export const isMac = navigator.platform.toLowerCase().includes("mac");

/** Horizontal width reserved beside the native macOS traffic lights, so the
 *  horizontal title bar's tab strip starts to their right. */
export const MAC_TRAFFIC_LIGHT_INSET = 80;

/** Vertical height reserved above the window content when the title bar is not
 *  along the top (tab position left/right/bottom), so no chrome renders under
 *  the native macOS traffic lights. */
export const MAC_TRAFFIC_LIGHT_TOP = 36;

export function vibrancyAlpha(opacity: number): number {
  return isMac ? opacity * 0.5 : opacity;
}
