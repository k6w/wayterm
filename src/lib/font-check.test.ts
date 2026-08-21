import { describe, expect, it } from "vitest";
import { missingFontWarning, primaryFontFamily } from "./font-check";

describe("primaryFontFamily", () => {
  it("takes the first family of a list and unquotes it", () => {
    expect(primaryFontFamily("JetBrains Mono, monospace")).toBe("JetBrains Mono");
    expect(primaryFontFamily('"Fira Code", monospace')).toBe("Fira Code");
    expect(primaryFontFamily("  'SF Mono'  ")).toBe("SF Mono");
  });

  it("returns null for an empty list or a generic family", () => {
    expect(primaryFontFamily("")).toBeNull();
    expect(primaryFontFamily("   ")).toBeNull();
    expect(primaryFontFamily("monospace, Menlo")).toBeNull();
  });
});

describe("missingFontWarning", () => {
  const widths = (installed: Record<string, number>) => (font: string) => {
    const match = /"(.+)"/.exec(font);
    return match ? (installed[match[1]] ?? 100) : 100;
  };

  it("warns when the font renders as the monospace fallback", () => {
    expect(missingFontWarning("Nope Mono, monospace", widths({}))).toBe(
      'Font "Nope Mono" not found, falling back to monospace'
    );
  });

  it("stays quiet for an installed font", () => {
    expect(missingFontWarning("JetBrains Mono, monospace", widths({ "JetBrains Mono": 96 }))).toBeNull();
  });

  it("stays quiet for generic families, empty input and when text cannot be measured", () => {
    expect(missingFontWarning("monospace", widths({}))).toBeNull();
    expect(missingFontWarning("", widths({}))).toBeNull();
    expect(missingFontWarning("Nope Mono", () => null)).toBeNull();
  });
});
