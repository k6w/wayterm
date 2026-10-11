import { beforeEach, describe, expect, it } from "vitest";
import { expandHome, findProfile, openProfileTab, terminalLook } from "./profiles";
import { defaultSettings } from "../stores/settings";
import { useTerminalStore } from "../stores/terminal";
import { createProfile } from "../components/settings/profile-utils";
import type { AppSettings, ShellProfile } from "../types/settings";

function withProfiles(...profiles: ShellProfile[]): AppSettings {
  return { ...structuredClone(defaultSettings), profiles };
}

beforeEach(() => {
  useTerminalStore.setState(useTerminalStore.getInitialState(), true);
});

describe("findProfile", () => {
  it("finds a profile by id, and nothing for a missing or deleted one", () => {
    const p = createProfile("a");
    expect(findProfile(withProfiles(p), "a")).toBe(p);
    expect(findProfile(withProfiles(p), "b")).toBeUndefined();
    expect(findProfile(withProfiles(p), undefined)).toBeUndefined();
  });
});

describe("terminalLook", () => {
  it("uses the global settings without a profile", () => {
    const s = defaultSettings;
    expect(terminalLook(s, undefined)).toEqual({
      fontFamily: s.appearance.terminalFontFamily,
      fontSize: s.appearance.terminalFontSize,
      fontWeight: s.appearance.terminalFontWeight,
      cursorStyle: s.appearance.cursorStyle,
      scrollback: s.terminal.scrollbackLines,
      ligatures: s.terminal.ligatures,
    });
  });

  it("applies every override the profile sets", () => {
    const p: ShellProfile = {
      ...createProfile("a"),
      fontFamilyOverride: "Fira Code",
      fontSizeOverride: 18,
      fontWeightOverride: 300,
      cursorStyleOverride: "block",
      scrollbackOverride: 500,
      ligaturesOverride: false,
    };
    expect(terminalLook(defaultSettings, p)).toEqual({
      fontFamily: "Fira Code",
      fontSize: 18,
      fontWeight: 300,
      cursorStyle: "block",
      scrollback: 500,
      ligatures: false,
    });
  });

  it("keeps the global value for overrides left at Default", () => {
    expect(terminalLook(defaultSettings, createProfile("a")).fontSize).toBe(defaultSettings.appearance.terminalFontSize);
  });
});

describe("expandHome", () => {
  it("expands ~ and ~/ only at the start", () => {
    expect(expandHome("~", "/Users/me")).toBe("/Users/me");
    expect(expandHome("~/code", "/Users/me")).toBe("/Users/me/code");
    expect(expandHome("/tmp/~x", "/Users/me")).toBe("/tmp/~x");
    expect(expandHome("~other", "/Users/me")).toBe("~other");
    expect(expandHome("~/code", null)).toBe("~/code");
  });
});

describe("openProfileTab", () => {
  it("opens an active tab named after the profile, in its folder, tagged with it", () => {
    const p = { ...createProfile("p1"), name: "Dev", shellPath: "/bin/bash", workingDirectory: "~/code" };
    const paneId = openProfileTab(p, withProfiles(p));
    const state = useTerminalStore.getState();

    expect(state.activePaneId).toBe(paneId);
    expect(state.tabs.find((t) => t.isActive)?.title).toBe("Dev");
    expect(state.panes[paneId]).toMatchObject({ profileId: "p1", shellPath: "/bin/bash", cwd: "~/code", checkCwd: true });
  });

  it("leaves the folder to the shell when the profile has none", () => {
    const p = createProfile("p1");
    const paneId = openProfileTab(p, withProfiles(p));
    expect(useTerminalStore.getState().panes[paneId].checkCwd).toBeUndefined();
  });
});
