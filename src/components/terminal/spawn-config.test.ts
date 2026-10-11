import { describe, expect, it } from "vitest";
import { localSpawnConfig } from "./spawn-config";
import { defaultSettings } from "../../stores/settings";
import type { AppSettings } from "../../types/settings";
import { createProfile } from "../settings/profile-utils";

function settingsWith(terminal: Partial<AppSettings["terminal"]>, defaultShell = ""): AppSettings {
  return {
    ...defaultSettings,
    general: { ...defaultSettings.general, defaultShell },
    terminal: { ...defaultSettings.terminal, ...terminal },
  };
}

describe("localSpawnConfig", () => {
  it("asks the backend for the shell integration by default", () => {
    expect(localSpawnConfig(undefined, settingsWith({}), "/bin/zsh")).toEqual({
      shell: "/bin/zsh",
      args: [],
      env: [],
      shellSetup: "integrated",
    });
  });

  it("keeps the title-only prompt when the setting is off", () => {
    expect(localSpawnConfig(undefined, settingsWith({ shellIntegration: false }), "/bin/zsh").shellSetup).toBe("titleOnly");
  });

  it("prefers the pane's shell, then the default shell setting", () => {
    expect(localSpawnConfig({ shellPath: "/bin/bash" }, settingsWith({}, "/usr/bin/fish"), "/bin/zsh").shell).toBe("/bin/bash");
    expect(localSpawnConfig(undefined, settingsWith({}, "/usr/bin/fish"), "/bin/zsh").shell).toBe("/usr/bin/fish");
  });
});

describe("localSpawnConfig with a profile", () => {
  const profile = {
    ...createProfile("prof"),
    shellPath: "/opt/homebrew/bin/fish",
    args: ["--login", " "],
    env: { NODE_ENV: "dev", "": "blank row" },
  };
  const settings = { ...settingsWith({}, "/bin/bash"), profiles: [profile] };

  it("starts the profile's shell with its arguments and variables, skipping blank rows", () => {
    expect(localSpawnConfig({ shellPath: "/bin/zsh", profileId: "prof" }, settings, "/bin/zsh")).toMatchObject({
      shell: "/opt/homebrew/bin/fish",
      args: ["--login"],
      env: [["NODE_ENV", "dev"]],
    });
  });

  it("falls back to the pane's shell when the profile names none", () => {
    const noShell = { ...settings, profiles: [{ ...profile, shellPath: "" }] };
    expect(localSpawnConfig({ shellPath: "/bin/zsh", profileId: "prof" }, noShell, "/bin/sh").shell).toBe("/bin/zsh");
  });

  it("starts a plain shell when the profile was deleted", () => {
    expect(localSpawnConfig({ shellPath: "/bin/zsh", profileId: "gone" }, settings, "/bin/sh")).toMatchObject({
      shell: "/bin/zsh",
      args: [],
      env: [],
    });
  });
});

describe("terminal settings defaults", () => {
  it("turns shell integration and command blocks on", () => {
    expect(defaultSettings.terminal.shellIntegration).toBe(true);
    expect(defaultSettings.terminal.commandBlocks).toBe(true);
    expect(defaultSettings.terminal.blockGutter).toBe(true);
    expect(defaultSettings.terminal.blockDurations).toBe(true);
  });
});
