import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAppFonts } from "./fonts";

afterEach(() => {
  vi.useRealTimers();
});

describe("loadAppFonts", () => {
  it("requests the bundled Inter and JetBrains Mono faces", async () => {
    const load = vi.fn(async () => [] as FontFace[]);
    await loadAppFonts(1500, { load });
    const requested = load.mock.calls.map((args) => String((args as unknown[])[0]));
    expect(requested.some((spec) => spec.includes('"Inter"'))).toBe(true);
    expect(requested.some((spec) => spec.includes('"JetBrains Mono"'))).toBe(true);
  });

  it("gives up after the timeout when fonts never load", async () => {
    vi.useFakeTimers();
    const load = vi.fn(() => new Promise<FontFace[]>(() => {}));
    let done = false;
    void loadAppFonts(1500, { load }).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(1499);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });

  it("resolves when a font fails to load", async () => {
    const load = vi.fn(async () => {
      throw new Error("missing");
    });
    await expect(loadAppFonts(1500, { load })).resolves.toBeUndefined();
  });

  it("resolves when the Font Loading API is unavailable", async () => {
    await expect(loadAppFonts(1500, undefined)).resolves.toBeUndefined();
  });
});
