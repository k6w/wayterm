import { describe, expect, it, vi } from "vitest";
import type { Terminal } from "@xterm/xterm";

vi.mock("@xterm/addon-ligatures", () => ({ LigaturesAddon: class { dispose() {} } }));

const { loadLigatures } = await import("./ligatures");

function fakeTerm() {
  return { loadAddon: vi.fn() } as unknown as Terminal & { loadAddon: ReturnType<typeof vi.fn> };
}

describe("loadLigatures", () => {
  it("loads the ligatures addon into the terminal", () => {
    const term = fakeTerm();
    const addon = loadLigatures(term);
    expect(addon).not.toBeNull();
    expect(term.loadAddon).toHaveBeenCalledWith(addon);
  });

  it("returns null when the terminal rejects the addon", () => {
    const term = fakeTerm();
    term.loadAddon.mockImplementation(() => {
      throw new Error("proposed API disabled");
    });
    expect(loadLigatures(term)).toBeNull();
  });
});
