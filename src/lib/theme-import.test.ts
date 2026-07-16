import { describe, expect, it } from "vitest";
import { importItermColorsTheme, importWindowsTerminalTheme } from "./theme-import";

describe("importWindowsTerminalTheme", () => {
  it("produces a theme in the current chrome schema", () => {
    const theme = importWindowsTerminalTheme(
      JSON.stringify({ name: "Campbell", background: "#0C0C0C", foreground: "#CCCCCC", blue: "#0037DA" })
    );
    expect(theme.id).toBe("wt-campbell");
    expect(theme.variant).toBe("dark");
    expect(theme.chrome.canvas).toBe("#0c0c0c");
    expect(theme.chrome.accent).toBe("#0037da");
    expect(theme.ui.bgPrimary).toBe("#0c0c0c");
  });
});

describe("importItermColorsTheme", () => {
  it("produces a theme in the current chrome schema", () => {
    const color = (r: number, g: number, b: number) =>
      `<dict><key>Red Component</key><real>${r}</real><key>Green Component</key><real>${g}</real><key>Blue Component</key><real>${b}</real></dict>`;
    const xml = `<?xml version="1.0"?><plist version="1.0"><dict>
      <key>Background Color</key>${color(1, 1, 1)}
      <key>Foreground Color</key>${color(0, 0, 0)}
    </dict></plist>`;
    const theme = importItermColorsTheme(xml);
    expect(theme.variant).toBe("light");
    expect(theme.chrome.canvas).toBe("#ffffff");
    expect(theme.terminal.foreground).toBe("#000000");
  });
});
