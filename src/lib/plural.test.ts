import { describe, expect, it } from "vitest";
import { plural } from "./plural";

describe("plural", () => {
  it("uses the singular only for exactly one", () => {
    expect(plural(0, "row")).toBe("0 rows");
    expect(plural(1, "row")).toBe("1 row");
    expect(plural(2, "row")).toBe("2 rows");
    expect(plural(1, "entry", "entries")).toBe("1 entry");
    expect(plural(3, "entry", "entries")).toBe("3 entries");
  });
});
