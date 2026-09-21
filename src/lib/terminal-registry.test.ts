import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Terminal } from "@xterm/xterm";
import {
  copySelection,
  isShellIntegrationActive,
  recordNativeCopies,
  removeCachedTerminal,
  resetTerminal,
  setCachedTerminal,
  type CachedTerminal,
} from "./terminal-registry";
import { useClipboardStore } from "../stores/clipboard";

function fakeTerminal(selection: string) {
  return { getSelection: () => selection } as unknown as Terminal;
}

beforeEach(() => {
  useClipboardStore.setState({ entries: [] });
  Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}), readText: vi.fn(async () => "") } });
});

describe("terminal copy history", () => {
  it("records the selection when the webview copies natively (Cmd+C on macOS)", () => {
    const el = document.createElement("div");
    recordNativeCopies(fakeTerminal("ls -la"), el);
    el.dispatchEvent(new Event("copy", { bubbles: true }));
    expect(useClipboardStore.getState().entries.map((e) => e.content)).toEqual(["ls -la"]);
    expect(useClipboardStore.getState().entries[0].source).toBe("terminal");
  });

  it("ignores a native copy with nothing selected", () => {
    const el = document.createElement("div");
    recordNativeCopies(fakeTerminal(""), el);
    el.dispatchEvent(new Event("copy", { bubbles: true }));
    expect(useClipboardStore.getState().entries).toHaveLength(0);
  });

  it("stops recording after the returned cleanup runs", () => {
    const el = document.createElement("div");
    const stop = recordNativeCopies(fakeTerminal("x"), el);
    stop();
    el.dispatchEvent(new Event("copy", { bubbles: true }));
    expect(useClipboardStore.getState().entries).toHaveLength(0);
  });

  it("records the explicit copy path (Ctrl+Shift+C, context menu) exactly once", () => {
    setCachedTerminal("p1", { terminal: fakeTerminal("pwd") } as unknown as CachedTerminal);
    expect(copySelection("p1")).toBe(true);
    expect(useClipboardStore.getState().entries.map((e) => e.content)).toEqual(["pwd"]);
  });
});

describe("command blocks in the cache", () => {
  it("resets the blocks with the terminal, whose reset keeps stale markers", () => {
    const blocks = { active: true, reset: vi.fn() };
    const terminal = { reset: vi.fn() };
    setCachedTerminal("p9", { terminal, blocks } as unknown as CachedTerminal);
    resetTerminal("p9");
    expect(terminal.reset).toHaveBeenCalled();
    expect(blocks.reset).toHaveBeenCalled();
    expect(isShellIntegrationActive("p9")).toBe(true);
    removeCachedTerminal("p9");
    expect(isShellIntegrationActive("p9")).toBe(false);
  });
});
