import { useThemeStore } from "../stores/theme";
import type { AppearanceSettings } from "../types/settings";
import { hexToRgb } from "./color";
import { setVibrancy } from "./ipc";
import { isMac } from "./platform";

export const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1);

export interface VibrancyPayload {
  enabled: boolean;
  r: number;
  g: number;
  b: number;
  a: number;
  /** 0..1 frosting strength; only macOS varies it, elsewhere vibrancy is on/off. */
  blur: number;
  dark: boolean;
}

interface NativeSyncOptions {
  send: (p: VibrancyPayload) => Promise<void>;
  /** Frame scheduler; requestAnimationFrame in the app. */
  schedule: (cb: () => void) => unknown;
  /** Whether the native side honours `blur`. If not, blur-only changes are not sent. */
  nativeBlur: boolean;
}

/**
 * Coalesces native vibrancy updates to at most one per animation frame (a
 * slider drag fires far more often than that) and skips updates that would not
 * change the native window.
 */
export function createNativeVibrancySync({ send, schedule, nativeBlur }: NativeSyncOptions) {
  let latest: VibrancyPayload | null = null;
  let framePending = false;
  let lastSent = "";
  const keyOf = (p: VibrancyPayload) => JSON.stringify(nativeBlur ? p : { ...p, blur: 0 });

  return (payload: VibrancyPayload) => {
    latest = payload;
    if (framePending) return;
    framePending = true;
    schedule(() => {
      framePending = false;
      const next = latest;
      latest = null;
      if (!next) return;
      const key = keyOf(next);
      if (key === lastSent) return;
      lastSent = key;
      send(next).catch(() => {
        // Let the next call retry rather than being deduped against a failed send.
        if (lastSent === key) lastSent = "";
      });
    });
  };
}

const pushNative = createNativeVibrancySync({
  send: ({ enabled, r, g, b, a, blur, dark }) => setVibrancy(enabled, r, g, b, a, blur, dark),
  schedule: (cb) => requestAnimationFrame(cb),
  nativeBlur: isMac,
});

/** Builds the native payload: toggle, tint opacity, blur strength and the theme's light/dark variant. */
export function vibrancyPayload({
  vibrancyEnabled,
  windowOpacity,
  blurIntensity,
}: Pick<AppearanceSettings, "vibrancyEnabled" | "windowOpacity" | "blurIntensity">): VibrancyPayload {
  const active = useThemeStore.getState().active;
  const [r, g, b] = hexToRgb(active.ui.bgPrimary);
  return {
    enabled: vibrancyEnabled,
    r,
    g,
    b,
    a: Math.round(windowOpacity * 255),
    blur: clamp01(blurIntensity),
    dark: active.variant === "dark",
  };
}

/** Pushes the vibrancy settings to the native window on the next animation frame. */
export function syncVibrancy(a: Pick<AppearanceSettings, "vibrancyEnabled" | "windowOpacity" | "blurIntensity">) {
  pushNative(vibrancyPayload(a));
}
