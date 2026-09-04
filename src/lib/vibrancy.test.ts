import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNativeVibrancySync, vibrancyPayload, type VibrancyPayload } from "./vibrancy";
import { useSettingsStore } from "../stores/settings";
import { useThemeStore } from "../stores/theme";
import { BUILTIN_THEME_MAP } from "../themes";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => undefined) }));

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useThemeStore.setState(useThemeStore.getInitialState(), true);
});

describe("vibrancyPayload", () => {
  it("carries the enabled flag, tint alpha and the 0..1 blur intensity unchanged", () => {
    expect(vibrancyPayload({ vibrancyEnabled: true, windowOpacity: 0.8, blurIntensity: 0.4 })).toMatchObject({
      enabled: true,
      a: 204,
      blur: 0.4,
    });
  });

  it("keeps the slider's 0..1 scale end to end (no percent or tier conversion)", () => {
    for (const v of [0, 0.05, 0.25, 0.5, 0.75, 1]) {
      expect(vibrancyPayload({ vibrancyEnabled: true, windowOpacity: 1, blurIntensity: v }).blur).toBe(v);
    }
  });

  it("clamps blur to 0..1", () => {
    expect(vibrancyPayload({ vibrancyEnabled: true, windowOpacity: 1, blurIntensity: 7 }).blur).toBe(1);
    expect(vibrancyPayload({ vibrancyEnabled: true, windowOpacity: 1, blurIntensity: -1 }).blur).toBe(0);
  });

  it("tells the native window whether the active theme is dark or light", () => {
    useThemeStore.setState({ active: BUILTIN_THEME_MAP.paper });
    expect(vibrancyPayload({ vibrancyEnabled: true, windowOpacity: 0.1, blurIntensity: 1 }).dark).toBe(false);
    useThemeStore.setState({ active: BUILTIN_THEME_MAP.graphite });
    expect(vibrancyPayload({ vibrancyEnabled: true, windowOpacity: 0.1, blurIntensity: 1 }).dark).toBe(true);
  });
});

describe("createNativeVibrancySync", () => {
  const base: VibrancyPayload = { enabled: true, r: 0, g: 0, b: 0, a: 26, blur: 1, dark: true };

  function setup(nativeBlur = true) {
    const frames: (() => void)[] = [];
    const send = vi.fn(async (_p: VibrancyPayload) => {});
    const sync = createNativeVibrancySync({ send, schedule: (cb) => frames.push(cb), nativeBlur });
    const flush = () => frames.splice(0).forEach((cb) => cb());
    return { sync, send, flush, frames };
  }

  it("sends at most one native update per animation frame, with the latest value", () => {
    const { sync, send, flush, frames } = setup();
    for (let i = 0; i <= 20; i++) sync({ ...base, blur: i / 20 });
    expect(send).not.toHaveBeenCalled();
    expect(frames).toHaveLength(1);
    flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenLastCalledWith({ ...base, blur: 1 });
  });

  it("a drag across several frames sends one update per frame", () => {
    const { sync, send, flush } = setup();
    for (let frame = 0; frame < 5; frame++) {
      sync({ ...base, blur: frame / 10 });
      sync({ ...base, blur: frame / 10 + 0.05 });
      flush();
    }
    expect(send).toHaveBeenCalledTimes(5);
  });

  it("skips updates identical to the last one sent", () => {
    const { sync, send, flush } = setup();
    sync(base);
    flush();
    sync({ ...base });
    flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("where native blur is on/off only, blur-only changes never reach the native window", () => {
    const { sync, send, flush } = setup(false);
    sync(base);
    flush();
    for (const blur of [0, 0.3, 0.7]) {
      sync({ ...base, blur });
      flush();
    }
    expect(send).toHaveBeenCalledTimes(1);
    sync({ ...base, enabled: false });
    flush();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("retries after a failed send instead of deduping against it", async () => {
    const frames: (() => void)[] = [];
    const send = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValue(undefined);
    const sync = createNativeVibrancySync({ send, schedule: (cb) => frames.push(cb), nativeBlur: true });
    sync(base);
    frames.splice(0).forEach((cb) => cb());
    await Promise.resolve();
    await Promise.resolve();
    sync(base);
    frames.splice(0).forEach((cb) => cb());
    expect(send).toHaveBeenCalledTimes(2);
  });
});
