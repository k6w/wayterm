import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";

describe("contrastRatio", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio("#ffffff", "#000000", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#123456", "#123456", "#000000")).toBeCloseTo(1, 5);
    expect(contrastRatio("#767676", "#ffffff", "#ffffff")).toBeCloseTo(4.54, 2);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#000000", "#ffffff", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#000000", "#000000"),
      5
    );
  });

  it("composites a translucent foreground over the background", () => {
    // #ffffff80 over black is #808080: 5.32:1
    expect(contrastRatio("#ffffff80", "#000000", "#000000")).toBeCloseTo(5.32, 1);
  });

  it("composites a translucent background over the backdrop", () => {
    // white text on a 0%-alpha background sits directly on the black backdrop
    expect(contrastRatio("#ffffff", "#ff000000", "#000000")).toBeCloseTo(21, 5);
  });

  it("throws on unparseable colors", () => {
    expect(() => contrastRatio("white", "#000000", "#000000")).toThrow(/invalid color/);
  });
});
