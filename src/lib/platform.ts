export const isMac = navigator.platform.toLowerCase().includes("mac");


export function vibrancyAlpha(opacity: number): number {
  return isMac ? opacity * 0.5 : opacity;
}
