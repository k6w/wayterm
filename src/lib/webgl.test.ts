import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Terminal } from "@xterm/xterm";

const addons: FakeWebgl[] = [];
let failConstruct = false;

class FakeWebgl {
  disposed = false;
  lost: (() => void) | null = null;
  constructor() {
    if (failConstruct) throw new Error("WebGL2 not supported");
    addons.push(this);
  }
  onContextLoss(cb: () => void) {
    this.lost = cb;
    return { dispose: () => {} };
  }
  dispose() {
    this.disposed = true;
  }
}

vi.mock("@xterm/addon-webgl", () => ({ WebglAddon: FakeWebgl }));

const { loadWebgl } = await import("./webgl");

function fakeTerm() {
  return { loadAddon: vi.fn() } as unknown as Terminal & { loadAddon: ReturnType<typeof vi.fn> };
}

beforeEach(() => {
  addons.length = 0;
  failConstruct = false;
});

describe("loadWebgl", () => {
  it("loads the WebGL addon into the terminal", () => {
    const term = fakeTerm();
    const addon = loadWebgl(term);
    expect(addon).toBe(addons[0]);
    expect(term.loadAddon).toHaveBeenCalledWith(addon);
  });

  it("returns null when WebGL is unavailable, leaving the DOM renderer", () => {
    failConstruct = true;
    expect(loadWebgl(fakeTerm())).toBeNull();
  });

  it("returns null when the terminal rejects the addon", () => {
    const term = fakeTerm();
    term.loadAddon.mockImplementation(() => {
      throw new Error("no context");
    });
    expect(loadWebgl(term)).toBeNull();
  });

  it("disposes the addon and notifies the caller on context loss", () => {
    const onLost = vi.fn();
    loadWebgl(fakeTerm(), onLost);
    addons[0].lost?.();
    expect(addons[0].disposed).toBe(true);
    expect(onLost).toHaveBeenCalledOnce();
  });
});
