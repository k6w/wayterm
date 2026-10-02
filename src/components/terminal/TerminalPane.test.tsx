import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import TerminalPane from "./TerminalPane";
import { useTerminalStore } from "../../stores/terminal";
import { defaultSettings, useSettingsStore } from "../../stores/settings";
import { terminalResize, terminalSpawn } from "../../lib/ipc";
import { getCachedTerminal, removeCachedTerminal } from "../../lib/terminal-registry";

const terms = vi.hoisted(() => [] as { cols: number; rows: number; options: { fontSize?: number } }[]);

// A terminal without a renderer: enough for the pane to open it, start a shell and fit it.
vi.mock("@xterm/xterm", () => {
  const disposable = () => ({ dispose: () => {} });
  class Terminal {
    cols = 80;
    rows = 24;
    options: Record<string, unknown>;
    element: HTMLElement | undefined;
    parser = { registerOscHandler: disposable, registerEscHandler: disposable };
    buffer = { active: { viewportY: 0, baseY: 0, cursorY: 0, type: "normal" }, onBufferChange: disposable };
    constructor(options: Record<string, unknown>) {
      this.options = { ...options };
      terms.push(this as never);
    }
    open(parent: HTMLElement) {
      this.element = document.createElement("div");
      parent.appendChild(this.element);
    }
    loadAddon(addon: { activate?: (t: Terminal) => void }) {
      addon.activate?.(this);
    }
    resize(cols: number, rows: number) {
      this.cols = cols;
      this.rows = rows;
    }
    onData = disposable;
    onTitleChange = disposable;
    onBell = disposable;
    onScroll = disposable;
    onRender = disposable;
    onResize = disposable;
    write() {}
    refresh() {}
    focus() {}
    hasSelection() {
      return false;
    }
    dispose() {}
  }
  return { Terminal };
});

// Columns as the real FitAddon measures them: the gutter padding (pl-5) costs two columns, a larger
// font fewer columns, and a display:none container reads as `100%` = 100px, about 10 columns.
vi.mock("@xterm/addon-fit", () => {
  class FitAddon {
    private term: { element?: HTMLElement; options: { fontSize?: number }; resize: (c: number, r: number) => void } | null =
      null;
    activate(term: never) {
      this.term = term;
    }
    fit() {
      const term = this.term;
      const container = term?.element?.parentElement?.parentElement;
      if (!term || !container) return;
      if (container.closest(".hidden")) {
        term.resize(10, 4);
        return;
      }
      const base = container.classList.contains("pl-5") ? 98 : 100;
      term.resize(base - ((term.options.fontSize ?? 14) - 14), 30);
    }
    dispose() {}
  }
  return { FitAddon };
});
vi.mock("@xterm/addon-webgl", () => ({ WebglAddon: class { dispose() {} } }));
vi.mock("@xterm/addon-web-links", () => ({ WebLinksAddon: class {} }));
vi.mock("@xterm/addon-search", () => ({ SearchAddon: class {} }));
vi.mock("@xterm/xterm/css/xterm.css", () => ({}));
vi.mock("../../lib/buffer-persistence", () => ({ attachSerializeAddon: () => {}, detachSerializeAddon: () => {} }));
vi.mock("./blocks/BlockOverlay", () => ({ BlockOverlay: () => null }));
vi.mock("../../lib/shell-detect", () => ({ getDefaultShell: () => ({ type: "zsh", path: "/bin/zsh", label: "Zsh" }) }));
vi.mock("../../lib/ipc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/ipc")>()),
  terminalSpawn: vi.fn(async () => ({ sessionId: "s1", nonce: "n0nce" })),
  terminalResize: vi.fn(async () => {}),
  terminalWrite: vi.fn(async () => {}),
  terminalKill: vi.fn(async () => {}),
  onTerminalOutput: vi.fn(async () => () => {}),
  onTerminalExit: vi.fn(async () => () => {}),
}));

// jsdom has no layout: panes have a size unless a wrapper hides them (like a background tab).
const clientSize = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
beforeAll(() => {
  for (const prop of ["clientWidth", "clientHeight"]) {
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get(this: HTMLElement) {
        return this.closest(".hidden") ? 0 : 800;
      },
    });
  }
});
afterAll(() => {
  if (clientSize) {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", clientSize);
    Object.defineProperty(HTMLElement.prototype, "clientHeight", clientSize);
  }
});

function Tab({ hidden }: { hidden: boolean }) {
  return (
    <div className={hidden ? "hidden" : ""}>
      <TerminalPane paneId="p1" isActive />
    </div>
  );
}

beforeEach(() => {
  terms.length = 0;
  removeCachedTerminal("p1");
  vi.mocked(terminalSpawn).mockClear();
  vi.mocked(terminalResize).mockClear();
  useSettingsStore.setState({ settings: structuredClone(defaultSettings) });
  useTerminalStore.setState({
    panes: { p1: { id: "p1", sessionId: "", isActive: true, cwd: "", shellType: "zsh" } },
  });
});

async function started() {
  await waitFor(() => expect(getCachedTerminal("p1")).toBeDefined());
  return terms[0];
}

describe("TerminalPane sizing", () => {
  it("leaves a hidden tab's terminal alone when the font changes", async () => {
    const { rerender } = render(<Tab hidden={false} />);
    const term = await started();
    rerender(<Tab hidden />);

    act(() => {
      const s = useSettingsStore.getState().settings;
      useSettingsStore.setState({ settings: { ...s, appearance: { ...s.appearance, terminalFontSize: 16 } } });
    });

    expect(term.cols).toBe(100);
    expect(terminalResize).not.toHaveBeenCalled();
  });

  it("refits a visible terminal and its shell when the font changes", async () => {
    render(<Tab hidden={false} />);
    const term = await started();

    act(() => {
      const s = useSettingsStore.getState().settings;
      useSettingsStore.setState({ settings: { ...s, appearance: { ...s.appearance, terminalFontSize: 16 } } });
    });

    expect(term.cols).toBe(96);
    expect(terminalResize).toHaveBeenCalledWith("s1", 30, 96);
  });
});
