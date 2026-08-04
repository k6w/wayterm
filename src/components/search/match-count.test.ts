import { describe, expect, it } from "vitest";
import { formatMatchCount } from "./match-count";

describe("formatMatchCount", () => {
  it("is empty before the addon reports", () => {
    expect(formatMatchCount(null)).toBe("");
  });

  it("says when nothing matches", () => {
    expect(formatMatchCount({ resultIndex: -1, resultCount: 0 })).toBe("No results");
  });

  it("shows the position of the selected match", () => {
    expect(formatMatchCount({ resultIndex: 2, resultCount: 12 })).toBe("3 of 12");
  });

  it("shows the total when no match is selected", () => {
    expect(formatMatchCount({ resultIndex: -1, resultCount: 12 })).toBe("12 matches");
    expect(formatMatchCount({ resultIndex: -1, resultCount: 1 })).toBe("1 match");
  });

  it("marks a count that hit the addon's limit", () => {
    expect(formatMatchCount({ resultIndex: 4, resultCount: 1000 })).toBe("5 of 1000+");
    expect(formatMatchCount({ resultIndex: -1, resultCount: 1000 })).toBe("1000+ matches");
  });
});
