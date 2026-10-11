import { useEffect, useRef, useState, useCallback, type CSSProperties } from "react";
import { Icon } from "../../ui/icons";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { useTerminalStore } from "../../stores/terminal";
import { useThemeStore } from "../../stores/theme";
import { useSettingsStore } from "../../stores/settings";
import {
  terminalSpawn,
  terminalWrite,
  terminalResize,
  terminalKill,
  onTerminalOutput,
  onTerminalExit,
} from "../../lib/ipc";
import { getPreferredShell } from "../../lib/shell-detect";
import { hexToRgba } from "../../lib/color";
import { loadWebgl } from "../../lib/webgl";
import "@xterm/xterm/css/xterm.css";

export default function Scratchpad() {
  const scratchpadOpen = useTerminalStore((s) => s.scratchpadOpen);
  const toggleScratchpad = useTerminalStore((s) => s.toggleScratchpad);
  const theme = useThemeStore((s) => s.active);

  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionRef = useRef<string | null>(null);
  const unlistenOutputRef = useRef<(() => void) | null>(null);
  const unlistenExitRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(false);

  // Drag state
  const [pos, setPos] = useState({ x: 80, y: 80 });
  const [size, setSize] = useState({ w: 640, h: 400 });
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });

  const handleDragMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    dragStartRef.current = { mx: e.clientX, my: e.clientY, ox: pos.x, oy: pos.y };

    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      setPos({
        x: dragStartRef.current.ox + (ev.clientX - dragStartRef.current.mx),
        y: dragStartRef.current.oy + (ev.clientY - dragStartRef.current.my),
      });
    };
    const onUp = () => {
      draggingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [pos]);

  // Resize via bottom-right handle
  const resizingRef = useRef(false);
  const resizeStartRef = useRef({ mx: 0, my: 0, ow: 0, oh: 0 });

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = true;
    resizeStartRef.current = { mx: e.clientX, my: e.clientY, ow: size.w, oh: size.h };

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const newW = Math.max(320, resizeStartRef.current.ow + (ev.clientX - resizeStartRef.current.mx));
      const newH = Math.max(200, resizeStartRef.current.oh + (ev.clientY - resizeStartRef.current.my));
      setSize({ w: newW, h: newH });
    };
    const onUp = () => {
      resizingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [size]);

  // Fit terminal when size changes
  useEffect(() => {
    if (!fitRef.current || !sessionRef.current) return;
    try {
      fitRef.current.fit();
      const t = termRef.current;
      if (t && sessionRef.current) {
        terminalResize(sessionRef.current, t.rows, t.cols).catch(() => {});
      }
    } catch {}
  }, [size]);

  // Init/destroy terminal based on open state
  useEffect(() => {
    if (!scratchpadOpen) return;
    // Read at open time: the terminal is created once per open, not on every theme change.
    const theme = useThemeStore.getState().active;
    const settings = useSettingsStore.getState().settings;
    const el = containerRef.current;
    if (!el) return;

    mountedRef.current = true;
    let cancelled = false;

    (async () => {
      const termEl = document.createElement("div");
      termEl.style.width = "100%";
      termEl.style.height = "100%";
      el.appendChild(termEl);

      const vibrancy = settings.appearance.vibrancyEnabled;
      const term = new Terminal({
        fontFamily: settings.appearance.terminalFontFamily,
        fontSize: settings.appearance.terminalFontSize,
        fontWeight: String(settings.appearance.terminalFontWeight) as
          | "normal" | "bold" | "100" | "200" | "300" | "400"
          | "500" | "600" | "700" | "800" | "900",
        lineHeight: settings.appearance.terminalLineHeight,
        cursorStyle: settings.appearance.cursorStyle,
        cursorBlink: settings.appearance.cursorBlink,
        scrollback: settings.terminal.scrollbackLines,
        allowProposedApi: true,
        allowTransparency: true,
        theme: {
          foreground: theme.terminal.foreground,
          background: vibrancy ? hexToRgba(theme.terminal.background, 0) : theme.terminal.background,
          cursor: theme.terminal.cursor,
          selectionBackground: theme.terminal.selection,
          black: theme.terminal.ansi[0],
          red: theme.terminal.ansi[1],
          green: theme.terminal.ansi[2],
          yellow: theme.terminal.ansi[3],
          blue: theme.terminal.ansi[4],
          magenta: theme.terminal.ansi[5],
          cyan: theme.terminal.ansi[6],
          white: theme.terminal.ansi[7],
          brightBlack: theme.terminal.ansi[8],
          brightRed: theme.terminal.ansi[9],
          brightGreen: theme.terminal.ansi[10],
          brightYellow: theme.terminal.ansi[11],
          brightBlue: theme.terminal.ansi[12],
          brightMagenta: theme.terminal.ansi[13],
          brightCyan: theme.terminal.ansi[14],
          brightWhite: theme.terminal.ansi[15],
        },
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(termEl);
      term.loadAddon(new WebLinksAddon());

      loadWebgl(term);

      fitAddon.fit();
      termRef.current = term;
      fitRef.current = fitAddon;

      if (cancelled) {
        term.dispose();
        termEl.remove();
        return;
      }

      const shell = getPreferredShell(useSettingsStore.getState().settings.general.defaultShell);
      let sessionId: string;
      try {
        ({ sessionId } = await terminalSpawn({
          shell: shell.path,
          args: [],
          cwd: "",
          env: [],
          rows: term.rows,
          cols: term.cols,
        }));
      } catch (err) {
        term.write(`\x1b[31mFailed to start shell\x1b[0m\r\n`);
        return;
      }

      if (cancelled) {
        terminalKill(sessionId).catch(() => {});
        term.dispose();
        termEl.remove();
        return;
      }

      sessionRef.current = sessionId;

      const unlistenOutput = await onTerminalOutput(sessionId, (data: number[]) => {
        term.write(new Uint8Array(data));
      });
      unlistenOutputRef.current = unlistenOutput;

      const unlistenExit = await onTerminalExit(sessionId, () => {
        term.write("\r\n\x1b[90m--- Process exited ---\x1b[0m\r\n");
      });
      unlistenExitRef.current = unlistenExit;

      term.onData((data: string) => {
        const sid = sessionRef.current;
        if (sid) {
          const bytes = Array.from(new TextEncoder().encode(data));
          terminalWrite(sid, bytes);
        }
      });

      const obs = new ResizeObserver(() => {
        try {
          fitAddon.fit();
          const sid = sessionRef.current;
          if (sid) {
            terminalResize(sid, term.rows, term.cols).catch(() => {});
          }
        } catch {}
      });
      obs.observe(el);

      // store obs ref for cleanup
      (term as Terminal & { _scratchObs?: ResizeObserver })._scratchObs = obs;
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;

      if (unlistenOutputRef.current) {
        unlistenOutputRef.current();
        unlistenOutputRef.current = null;
      }
      if (unlistenExitRef.current) {
        unlistenExitRef.current();
        unlistenExitRef.current = null;
      }
      if (sessionRef.current) {
        terminalKill(sessionRef.current).catch(() => {});
        sessionRef.current = null;
      }
      if (termRef.current) {
        const t = termRef.current as Terminal & { _scratchObs?: ResizeObserver };
        if (t._scratchObs) {
          t._scratchObs.disconnect();
          t._scratchObs = undefined;
        }
        termRef.current = null;
      }
      fitRef.current = null;

      // Clear DOM
      if (el) {
        while (el.firstChild) el.removeChild(el.firstChild);
      }
    };
  }, [scratchpadOpen]);

  if (!scratchpadOpen) return null;

  return (
    <div
      className="fixed z-[300] flex flex-col rounded-xl border border-border shadow-2xl overflow-hidden bg-(--wt-dyn-bg)"
      style={
        {
          top: pos.y,
          left: pos.x,
          width: size.w,
          height: size.h,
          "--wt-dyn-bg": hexToRgba(theme.ui.bgPrimary, 0.97),
        } as CSSProperties
      }
    >
      {/* Title bar / drag handle */}
      <div
        className="flex items-center gap-2 px-3 py-2 bg-bg-secondary border-b border-border select-none cursor-grab active:cursor-grabbing shrink-0"
        onMouseDown={handleDragMouseDown}
      >
        <Icon name="dragHandle" size={14} className="text-text-muted shrink-0" />
        <span className="flex-1 text-xs text-text-secondary font-medium">Scratchpad</span>
        <button
          className="flex items-center justify-center size-5 rounded hover:bg-overlay/10 transition-colors text-text-muted hover:text-text-primary"
          onClick={toggleScratchpad}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Icon name="close" size={12} />
        </button>
      </div>

      {/* Terminal area */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 bg-(--wt-dyn-bg) pt-1 pr-1 pl-1.5"
        style={{ "--wt-dyn-bg": hexToRgba(theme.terminal.background, 0.85) } as CSSProperties}
      />

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-[linear-gradient(135deg,transparent_50%,color-mix(in_srgb,var(--color-overlay)_15%,transparent)_50%)]"
        onMouseDown={handleResizeMouseDown}
      />
    </div>
  );
}
