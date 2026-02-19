import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { WebglAddon } from "@xterm/addon-webgl";
import { FitAddon } from "@xterm/addon-fit";
import { useThemeStore } from "../../stores/theme";
import { useSettingsStore } from "../../stores/settings";
import { useTerminalStore } from "../../stores/terminal";
import {
  terminalSpawn,
  terminalWrite,
  terminalResize,
  terminalKill,
  onTerminalOutput,
  onTerminalExit,
} from "../../lib/ipc";
import { getDefaultShell } from "../../lib/shell-detect";
import type { UnlistenFn } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";

interface TerminalPaneProps {
  paneId: string;
  isActive: boolean;
}

export default function TerminalPane({ paneId, isActive }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const unlistenOutputRef = useRef<UnlistenFn | null>(null);
  const unlistenExitRef = useRef<UnlistenFn | null>(null);

  const theme = useThemeStore((s) => s.active);
  const settings = useSettingsStore((s) => s.settings);
  const updatePaneSession = useTerminalStore((s) => s.updatePaneSession);

  const initTerminal = useCallback(async () => {
    if (!containerRef.current) return;

    const term = new Terminal({
      fontFamily: settings.appearance.terminalFontFamily,
      fontSize: settings.appearance.terminalFontSize,
      fontWeight: String(settings.appearance.terminalFontWeight) as
        | "normal"
        | "bold"
        | "100"
        | "200"
        | "300"
        | "400"
        | "500"
        | "600"
        | "700"
        | "800"
        | "900",
      lineHeight: settings.appearance.terminalLineHeight,
      cursorStyle: settings.appearance.cursorStyle,
      cursorBlink: settings.appearance.cursorBlink,
      scrollback: settings.terminal.scrollbackLines,
      allowProposedApi: true,
      theme: {
        foreground: theme.terminal.foreground,
        background: theme.terminal.background,
        cursor: theme.terminal.cursor,
        cursorAccent: theme.terminal.cursorAccent,
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
    term.open(containerRef.current);

    try {
      const webglAddon = new WebglAddon();
      term.loadAddon(webglAddon);
    } catch {
      // WebGL not available, fall back to canvas renderer
    }

    fitAddon.fit();
    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    const detectedShell = getDefaultShell();
    const shellPath =
      settings.general.defaultShell || detectedShell.path;

    const sessionId = await terminalSpawn({
      shell: shellPath,
      args: [],
      cwd: "",
      env: [],
      rows: term.rows,
      cols: term.cols,
    });

    sessionIdRef.current = sessionId;
    updatePaneSession(paneId, sessionId);

    unlistenOutputRef.current = await onTerminalOutput(
      sessionId,
      (data: number[]) => {
        term.write(new Uint8Array(data));
      }
    );

    unlistenExitRef.current = await onTerminalExit(sessionId, () => {
      term.write("\r\n\x1b[90m--- Process exited ---\x1b[0m\r\n");
    });

    term.onData((data: string) => {
      if (sessionIdRef.current) {
        const bytes = Array.from(new TextEncoder().encode(data));
        terminalWrite(sessionIdRef.current, bytes);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && terminalRef.current) {
        try {
          fitAddonRef.current.fit();
          if (sessionIdRef.current) {
            terminalResize(
              sessionIdRef.current,
              terminalRef.current.rows,
              terminalRef.current.cols
            );
          }
        } catch {
          // ignore resize errors during teardown
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [paneId, theme, settings, updatePaneSession]);

  useEffect(() => {
    let resizeCleanup: (() => void) | undefined;

    initTerminal().then((cleanup) => {
      resizeCleanup = cleanup;
    });

    return () => {
      if (resizeCleanup) resizeCleanup();

      if (sessionIdRef.current) {
        terminalKill(sessionIdRef.current).catch(() => {});
      }

      if (unlistenOutputRef.current) {
        unlistenOutputRef.current();
      }

      if (unlistenExitRef.current) {
        unlistenExitRef.current();
      }

      if (terminalRef.current) {
        terminalRef.current.dispose();
        terminalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!terminalRef.current) return;
    terminalRef.current.options.theme = {
      foreground: theme.terminal.foreground,
      background: theme.terminal.background,
      cursor: theme.terminal.cursor,
      cursorAccent: theme.terminal.cursorAccent,
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
    };
  }, [theme]);

  useEffect(() => {
    if (!terminalRef.current) return;
    terminalRef.current.options.fontFamily =
      settings.appearance.terminalFontFamily;
    terminalRef.current.options.fontSize =
      settings.appearance.terminalFontSize;
    terminalRef.current.options.lineHeight =
      settings.appearance.terminalLineHeight;
    terminalRef.current.options.cursorStyle =
      settings.appearance.cursorStyle;
    terminalRef.current.options.cursorBlink =
      settings.appearance.cursorBlink;
    if (fitAddonRef.current) {
      fitAddonRef.current.fit();
    }
  }, [settings.appearance]);

  useEffect(() => {
    if (isActive && terminalRef.current) {
      terminalRef.current.focus();
    }
  }, [isActive]);

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        borderLeft: isActive
          ? `2px solid ${theme.ui.accent}`
          : "2px solid transparent",
      }}
    >
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
