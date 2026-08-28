import { useThemeStore } from "../stores/theme";
import type { AppearanceSettings } from "../types/settings";
import { hexToRgb } from "./color";
import { setVibrancy } from "./ipc";

export const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1);

/** Pushes the vibrancy toggle, tint opacity and blur strength to the native window. */
export function syncVibrancy({
  vibrancyEnabled,
  windowOpacity,
  blurIntensity,
}: Pick<AppearanceSettings, "vibrancyEnabled" | "windowOpacity" | "blurIntensity">) {
  const [r, g, b] = hexToRgb(useThemeStore.getState().active.ui.bgPrimary);
  const a = Math.round(windowOpacity * 255);
  setVibrancy(vibrancyEnabled, r, g, b, a, clamp01(blurIntensity)).catch(() => {});
}
