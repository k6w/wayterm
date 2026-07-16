import { describe, expect, it } from "vitest";
import { hexToRgb, hexToRgba } from "./color";

describe("hexToRgb", () => {
  it("parses a 6-digit hex color", () => {
    expect(hexToRgb("#1a2b3c")).toEqual([26, 43, 60]);
  });
});

describe("hexToRgba", () => {
  it("converts hex to rgba() with the given alpha", () => {
    expect(hexToRgba("#ff0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
  });

  it("replaces the alpha of an rgba() input", () => {
    expect(hexToRgba("rgba(1, 2, 3, 0.9)", 0.2)).toBe("rgba(1, 2, 3, 0.2)");
  });

  it("adds an alpha to an rgb() input", () => {
    expect(hexToRgba("rgb(1, 2, 3)", 0.4)).toBe("rgba(1, 2, 3, 0.4)");
  });
});
