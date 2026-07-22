import { beforeEach, describe, expect, it } from "vitest";
import { shortcutFor } from "./shortcut-hints";
import { useSettingsStore } from "../stores/settings";

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
});

describe("shortcutFor", () => {
  it("returns the default binding (jsdom is not macOS, so Control)", () => {
    expect(shortcutFor("close-tab")).toBe("Control+w");
    expect(shortcutFor("split-horizontal")).toBe("Control+Shift+d");
  });

  it("returns the user's override", () => {
    useSettingsStore.setState((s) => ({
      settings: { ...s.settings, keybindings: { "close-tab": "Control+Shift+w" } },
    }));
    expect(shortcutFor("close-tab")).toBe("Control+Shift+w");
  });

  it("returns undefined for unknown actions", () => {
    expect(shortcutFor("does-not-exist")).toBeUndefined();
  });
});
