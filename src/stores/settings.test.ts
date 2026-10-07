import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { SETTLE_PERSIST_MS, useSettingsStore } from "./settings";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => undefined) }));

const writes = () => vi.mocked(invoke).mock.calls.filter(([cmd]) => cmd === "settings_set").map(([, args]) => args);

beforeEach(async () => {
  vi.useFakeTimers();
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  await useSettingsStore.getState().flushPending();
  vi.mocked(invoke).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("updateLive", () => {
  it("applies every change to the store immediately", () => {
    for (const v of [0.9, 0.6, 0.3]) {
      useSettingsStore.getState().updateLive("appearance", { blurIntensity: v });
      expect(useSettingsStore.getState().settings.appearance.blurIntensity).toBe(v);
    }
  });

  it("persists only the settled value, SETTLE_PERSIST_MS after the last change", async () => {
    const { updateLive } = useSettingsStore.getState();
    for (let i = 20; i >= 0; i--) {
      updateLive("appearance", { blurIntensity: i / 20 });
      await vi.advanceTimersByTimeAsync(16);
    }
    expect(writes()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(SETTLE_PERSIST_MS - 17);
    expect(writes()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(writes()).toEqual([{ key: "appearance.blurIntensity", value: 0 }]);
  });

  it("persists each field touched while the drag was in progress", async () => {
    const { updateLive } = useSettingsStore.getState();
    updateLive("appearance", { windowOpacity: 0.4 });
    updateLive("appearance", { blurIntensity: 0.5 });
    await vi.advanceTimersByTimeAsync(SETTLE_PERSIST_MS);
    expect(writes()).toEqual([
      { key: "appearance.windowOpacity", value: 0.4 },
      { key: "appearance.blurIntensity", value: 0.5 },
    ]);
  });

  it("flushPending writes a pending change at once (e.g. on unload)", async () => {
    useSettingsStore.getState().updateLive("appearance", { blurIntensity: 0.25 });
    await useSettingsStore.getState().flushPending();
    expect(writes()).toEqual([{ key: "appearance.blurIntensity", value: 0.25 }]);
    await vi.advanceTimersByTimeAsync(SETTLE_PERSIST_MS);
    expect(writes()).toHaveLength(1);
  });

  it("a later explicit update of the same field is not overwritten by the pending live write", async () => {
    useSettingsStore.getState().updateLive("appearance", { blurIntensity: 0.25 });
    await useSettingsStore.getState().update("appearance", { blurIntensity: 0.75 });
    await vi.advanceTimersByTimeAsync(SETTLE_PERSIST_MS);
    expect(writes()).toEqual([{ key: "appearance.blurIntensity", value: 0.75 }]);
    expect(useSettingsStore.getState().settings.appearance.blurIntensity).toBe(0.75);
  });
});

describe("pane dimming settings", () => {
  it("defaults to a subtle dim, on", () => {
    const a = useSettingsStore.getInitialState().settings.appearance;
    expect(a.dimInactivePanes).toBe(true);
    expect(a.inactivePaneDim).toBe(0.15);
  });

  it("falls back to the defaults when saved settings predate the keys", async () => {
    vi.mocked(invoke).mockImplementationOnce(async () => ({ "appearance.density": "comfortable" }));
    await useSettingsStore.getState().load();
    const a = useSettingsStore.getState().settings.appearance;
    expect(a.density).toBe("comfortable");
    expect(a.dimInactivePanes).toBe(true);
    expect(a.inactivePaneDim).toBe(0.15);
  });
});
