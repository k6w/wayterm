import { describe, expect, it } from "vitest";
import { localSpawnConfig } from "./spawn-config";
import { defaultSettings } from "../../stores/settings";
import type { AppSettings } from "../../types/settings";

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

describe("terminal settings defaults", () => {
  it("turns shell integration and command blocks on", () => {
    expect(defaultSettings.terminal.shellIntegration).toBe(true);
    expect(defaultSettings.terminal.commandBlocks).toBe(true);
    expect(defaultSettings.terminal.blockGutter).toBe(true);
    expect(defaultSettings.terminal.blockDurations).toBe(true);
  });
});
