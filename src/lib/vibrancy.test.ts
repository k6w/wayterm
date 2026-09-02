import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { syncVibrancy } from "./vibrancy";
import { useSettingsStore } from "../stores/settings";
import { useThemeStore } from "../stores/theme";
import { BUILTIN_THEME_MAP } from "../themes";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => undefined) }));

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useThemeStore.setState(useThemeStore.getInitialState(), true);
});

describe("syncVibrancy", () => {
  it("sends the enabled flag, tint and blur intensity to the native window", () => {
    syncVibrancy({ vibrancyEnabled: true, windowOpacity: 0.8, blurIntensity: 0.4 });
    expect(invoke).toHaveBeenCalledWith(
      "set_vibrancy",
      expect.objectContaining({ enabled: true, a: 204, blur: 0.4 })
    );
  });

  it("clamps blur to 0..1", () => {
    syncVibrancy({ vibrancyEnabled: true, windowOpacity: 1, blurIntensity: 7 });
    expect(invoke).toHaveBeenCalledWith("set_vibrancy", expect.objectContaining({ blur: 1 }));
  });

  it("tells the native window whether the active theme is dark or light", () => {
    useThemeStore.setState({ active: BUILTIN_THEME_MAP.paper });
    syncVibrancy({ vibrancyEnabled: true, windowOpacity: 0.1, blurIntensity: 1 });
    expect(invoke).toHaveBeenLastCalledWith("set_vibrancy", expect.objectContaining({ dark: false }));
    useThemeStore.setState({ active: BUILTIN_THEME_MAP.graphite });
    syncVibrancy({ vibrancyEnabled: true, windowOpacity: 0.1, blurIntensity: 1 });
    expect(invoke).toHaveBeenLastCalledWith("set_vibrancy", expect.objectContaining({ dark: true }));
  });
});
