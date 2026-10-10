import { describe, expect, it, vi } from "vitest";
import { importThemeFile } from "./theme-files";
import { toThemeFile } from "../../lib/theme-schema";
import { BUILTIN_THEME_MAP } from "../../themes";
import type { ThemeDefinition } from "../../types/theme";

function fakeFile(name: string, content: string) {
  return { name, text: async () => content };
}

function recorder() {
  const imported: unknown[] = [];
  const importTheme = vi.fn(async (json: string) => {
    imported.push(JSON.parse(json));
    return BUILTIN_THEME_MAP.graphite as ThemeDefinition;
  });
  return { imported, importTheme };
}

describe("importThemeFile", () => {
  it("passes a wayterm theme through unchanged", async () => {
    const { importTheme } = recorder();
    const native = JSON.stringify({ ...toThemeFile(BUILTIN_THEME_MAP.frost), id: "my-frost", name: "My Frost" });
    await importThemeFile(fakeFile("my-frost.json", native), importTheme);
    expect(importTheme).toHaveBeenCalledWith(native);
  });

  it("converts a Windows Terminal scheme", async () => {
    const { imported, importTheme } = recorder();
    const wt = JSON.stringify({ name: "Campbell", background: "#0C0C0C", foreground: "#CCCCCC" });
    await importThemeFile(fakeFile("campbell.json", wt), importTheme);
    expect(imported[0]).toMatchObject({ id: "wt-campbell", name: "Campbell", variant: "dark" });
    expect(imported[0]).toHaveProperty("chrome.canvas", "#0c0c0c");
    expect(imported[0]).not.toHaveProperty("ui");
  });

  it("converts an iTerm2 preset", async () => {
    const { imported, importTheme } = recorder();
    const color = (v: number) =>
      `<dict><key>Red Component</key><real>${v}</real><key>Green Component</key><real>${v}</real><key>Blue Component</key><real>${v}</real></dict>`;
    const xml = `<?xml version="1.0"?><plist version="1.0"><dict><key>Background Color</key>${color(1)}<key>Foreground Color</key>${color(0)}</dict></plist>`;
    await importThemeFile(fakeFile("Paperish.itermcolors", xml), importTheme);
    expect(imported[0]).toMatchObject({ variant: "light" });
  });

  it("rejects other file types", async () => {
    const { importTheme } = recorder();
    await expect(importThemeFile(fakeFile("theme.yaml", "x"), importTheme)).rejects.toThrow(
      "Unsupported file type: .yaml. Use .json or .itermcolors"
    );
    expect(importTheme).not.toHaveBeenCalled();
  });
});
