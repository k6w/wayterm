import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { clampSidebarWidth, useSidebarStore } from "./sidebar";
import { useSettingsStore } from "./settings";

const saved = (key: string) =>
  vi.mocked(invoke).mock.calls.filter(([cmd, args]) => cmd === "settings_set" && (args as { key: string }).key === key);

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(invoke).mockClear();
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useSidebarStore.setState(useSidebarStore.getInitialState(), true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("clampSidebarWidth", () => {
  it("clamps to 200..420 and rounds", () => {
    expect(clampSidebarWidth(100)).toBe(200);
    expect(clampSidebarWidth(999)).toBe(420);
    expect(clampSidebarWidth(300.6)).toBe(301);
  });

  it("falls back to 260 for values that are not finite numbers", () => {
    expect(clampSidebarWidth(Number.NaN)).toBe(260);
    expect(clampSidebarWidth("wide")).toBe(260);
    expect(clampSidebarWidth(null)).toBe(260);
    expect(clampSidebarWidth(Number.POSITIVE_INFINITY)).toBe(260);
  });
});

describe("sidebar store", () => {
  it("starts collapsed on connections at 260px", () => {
    const s = useSidebarStore.getState();
    expect(s).toMatchObject({ collapsed: true, section: "connections", width: 260 });
  });

  it("hydrates from settings and repairs bad persisted values", () => {
    useSidebarStore.getState().hydrate({ sidebarCollapsed: false, sidebarWidth: 333 });
    expect(useSidebarStore.getState()).toMatchObject({ collapsed: false, width: 333 });
    useSidebarStore.getState().hydrate({ sidebarCollapsed: "yes", sidebarWidth: "wide" });
    expect(useSidebarStore.getState()).toMatchObject({ collapsed: true, width: 260 });
    useSidebarStore.getState().hydrate({ sidebarWidth: 5000 });
    expect(useSidebarStore.getState().width).toBe(420);
  });

  it("toggles and persists the collapsed state", () => {
    useSidebarStore.getState().toggle();
    expect(useSidebarStore.getState().collapsed).toBe(false);
    expect(useSettingsStore.getState().settings.appearance.sidebarCollapsed).toBe(false);
    expect(invoke).toHaveBeenCalledWith("settings_set", { key: "appearance.sidebarCollapsed", value: false });
  });

  it("activate opens a section, switches sections, and collapses on the active one", () => {
    const { activate } = useSidebarStore.getState();
    activate("git");
    expect(useSidebarStore.getState()).toMatchObject({ collapsed: false, section: "git" });
    activate("database");
    expect(useSidebarStore.getState()).toMatchObject({ collapsed: false, section: "database" });
    activate("database");
    expect(useSidebarStore.getState()).toMatchObject({ collapsed: true, section: "database" });
  });

  it("show only persists when it actually expands", () => {
    useSidebarStore.getState().show("git");
    useSidebarStore.getState().show("tunnels");
    expect(saved("appearance.sidebarCollapsed")).toHaveLength(1);
  });

  it("applies width at once but saves it once after the drag settles", () => {
    const { setWidth } = useSidebarStore.getState();
    setWidth(280);
    setWidth(300);
    setWidth(5000);
    expect(useSidebarStore.getState().width).toBe(420);
    expect(saved("appearance.sidebarWidth")).toHaveLength(0);
    vi.advanceTimersByTime(300);
    expect(saved("appearance.sidebarWidth")).toEqual([
      ["settings_set", { key: "appearance.sidebarWidth", value: 420 }],
    ]);
  });
});
