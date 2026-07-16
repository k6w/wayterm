import { describe, expect, it } from "vitest";
import { compositeOver, hexToRgb, hexToRgba, mixHex, parseCssColor, toHex } from "./color";

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

describe("parseCssColor", () => {
  it("parses 3, 4, 6 and 8 digit hex", () => {
    expect(parseCssColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseCssColor("#0008")?.a).toBeCloseTo(0x88 / 255);
    expect(parseCssColor("#1A2B3C")).toEqual({ r: 26, g: 43, b: 60, a: 1 });
    expect(parseCssColor("#1a2b3c80")?.a).toBeCloseTo(128 / 255);
  });

  it("parses rgb() and rgba()", () => {
    expect(parseCssColor("rgb(1, 2, 3)")).toEqual({ r: 1, g: 2, b: 3, a: 1 });
    expect(parseCssColor("rgba(255, 255, 255, 0.08)")).toEqual({ r: 255, g: 255, b: 255, a: 0.08 });
  });

  it("rejects named colors, out-of-range channels and garbage", () => {
    expect(parseCssColor("red")).toBeNull();
    expect(parseCssColor("rgb(300, 0, 0)")).toBeNull();
    expect(parseCssColor("#12")).toBeNull();
    expect(parseCssColor("")).toBeNull();
  });
});

describe("compositeOver / toHex / mixHex", () => {
  it("composites a translucent color over an opaque one", () => {
    const top = parseCssColor("rgba(255, 255, 255, 0.08)")!;
    const bottom = parseCssColor("#12121a")!;
    expect(toHex(compositeOver(top, bottom))).toBe("#25252c");
  });

  it("serializes alpha only when asked", () => {
    expect(toHex({ r: 82, g: 139, b: 255, a: 0.25 })).toBe("#528bff");
    expect(toHex({ r: 82, g: 139, b: 255, a: 0.25 }, true)).toBe("#528bff40");
    expect(toHex({ r: 82, g: 139, b: 255, a: 1 }, true)).toBe("#528bff");
  });

  it("mixes two colors", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHex("#102030", "#102030", 0.3)).toBe("#102030");
    expect(() => mixHex("nope", "#ffffff", 0.5)).toThrow(/invalid color "nope"/);
  });
});
