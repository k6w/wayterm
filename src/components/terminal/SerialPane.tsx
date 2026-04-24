import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { useThemeStore } from "../../stores/theme";
import { useSettingsStore } from "../../stores/settings";
import { useTerminalStore } from "../../stores/terminal";
import { serialOpen, serialWrite, serialClose, onSerialOutput, onSerialExit } from "../../lib/ipc";
import { hexToRgba } from "../../lib/color";
import { vibrancyAlpha } from "../../lib/platform";
import type { SerialConfig } from "../../types/terminal";
import "@xterm/xterm/css/xterm.css";

interface SerialPaneProps {
  paneId: string;
  isActive: boolean;
  paneCount?: number;
}

function makeXtermTheme(theme: ReturnType<typeof useThemeStore.getState>["active"], vibrancy: boolean, opacity: number) {
  const [black, red, green, yellow, blue, magenta, cyan, white,
         brightBlack, brightRed, brightGreen, brightYellow,
         brightBlue, brightMagenta, brightCyan, brightWhite] = theme.terminal.ansi;
  return {
    background: vibrancy ? hexToRgba(theme.terminal.background, vibrancyAlpha(opacity)) : theme.terminal.background,
    foreground: theme.terminal.foreground,
    cursor: theme.terminal.cursor,
    cursorAccent: theme.terminal.cursorAccent ?? theme.terminal.background,
    selectionBackground: theme.terminal.selection,
    black, red, green, yellow, blue, magenta, cyan, white,
    brightBlack, brightRed, brightGreen, brightYellow,
    brightBlue, brightMagenta, brightCyan, brightWhite,
  };
}

export default function SerialPane({ paneId, isActive, paneCount = 1 }: SerialPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionRef = useRef<string | null>(null);

  const theme = useThemeStore((s) => s.active);
  const settings = useSettingsStore((s) => s.settings);
  const setActivePane = useTerminalStore((s) => s.setActivePane);
  const pane = useTerminalStore((s) => s.panes[paneId]);

  const [exited, setExited] = useState(false);

  const vibrancy = settings.appearance.vibrancyEnabled;
  const opacity = settings.appearance.windowOpacity;
  const isSplit = (paneCount ?? 1) > 1;

  const bgColor = vibrancy
    ? hexToRgba(theme.terminal.background, vibrancyAlpha(opacity))
    : theme.terminal.background;

  const reconnect = async (config: SerialConfig) => {
    setExited(false);
    if (sessionRef.current) {
      await serialClose(sessionRef.current).catch(() => {});
      sessionRef.current = null;
    }
    try {
      const sid = await serialOpen({
        portName: config.portName,
        baudRate: config.baudRate,
        dataBits: config.dataBits,
        stopBits: config.stopBits,
        parity: config.parity,
        flowControl: config.flowControl,
      });
      sessionRef.current = sid;

      const unlistenOutput = await onSerialOutput(sid, (data) => {
        termRef.current?.write(new Uint8Array(data));
      });
      const unlistenExit = await onSerialExit(sid, () => {
        termRef.current?.write("\r\n\x1b[90m--- Port closed ---\x1b[0m\r\n");
        setExited(true);
        unlistenOutput();
        unlistenExit();
      });
    } catch (err) {
      termRef.current?.write(`\x1b[31mReconnect failed: ${err instanceof Error ? err.message : String(err)}\x1b[0m\r\n`);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !pane?.serialConfig) return;

    const config = pane.serialConfig;
    let cancelled = false;

    const term = new Terminal({
      fontFamily: settings.appearance.terminalFontFamily,
      fontSize: settings.appearance.terminalFontSize,
      cursorStyle: settings.appearance.cursorStyle,
      cursorBlink: settings.appearance.cursorBlink,
      scrollback: settings.terminal.scrollbackLines,
      allowProposedApi: true,
      allowTransparency: true,
      theme: makeXtermTheme(theme, vibrancy, opacity),
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    const termEl = document.createElement("div");
    termEl.style.width = "100%";
    termEl.style.height = "100%";
    container.appendChild(termEl);
    term.open(termEl);

    if (!vibrancy) {
      try {
        term.loadAddon(new WebglAddon());
      } catch {
        // WebGL not available, fallback to canvas
      }
    }

    fitAddon.fit();
    termRef.current = term;
    fitRef.current = fitAddon;

    term.onData((data) => {
      const sid = sessionRef.current;
      if (sid) {
        serialWrite(sid, Array.from(new TextEncoder().encode(data))).catch(() => {});
      }
    });

    term.write(`\x1b[90mConnecting to ${config.portName} @ ${config.baudRate} baud...\x1b[0m\r\n`);

    (async () => {
      if (cancelled) return;
      try {
        const sid = await serialOpen({
          portName: config.portName,
          baudRate: config.baudRate,
          dataBits: config.dataBits,
          stopBits: config.stopBits,
          parity: config.parity,
          flowControl: config.flowControl,
        });
        if (cancelled) {
          await serialClose(sid).catch(() => {});
          return;
        }
        sessionRef.current = sid;
        term.write(`\x1b[90mConnected.\x1b[0m\r\n`);

        const unlistenOutput = await onSerialOutput(sid, (data) => {
          term.write(new Uint8Array(data));
        });
        const unlistenExit = await onSerialExit(sid, () => {
          term.write("\r\n\x1b[90m--- Port closed ---\x1b[0m\r\n");
          setExited(true);
          unlistenOutput();
          unlistenExit();
        });
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          term.write(`\x1b[31mFailed to open port: ${msg}\x1b[0m\r\n`);
        }
      }
    })();

    const resizeObs = new ResizeObserver(() => {
      try { fitAddon.fit(); } catch { /* ignore */ }
    });
    resizeObs.observe(container);

    return () => {
      cancelled = true;
      resizeObs.disconnect();
      term.dispose();
      termEl.remove();
      const sid = sessionRef.current;
      sessionRef.current = null;
      if (sid) serialClose(sid).catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneId]);

  const showFocus = isActive && isSplit;
  const config = pane?.serialConfig;

  return (
    <div
      className={`relative flex h-full w-full flex-col overflow-hidden ${isSplit ? "rounded-lg" : ""}`}
      style={{
        backgroundColor: bgColor,
        border: showFocus
          ? `1.5px solid ${theme.ui.accent}`
          : isSplit
            ? `1.5px solid ${theme.ui.border || "transparent"}`
            : "1.5px solid transparent",
      }}
      onMouseDown={() => setActivePane(paneId)}
    >
      {/* Header bar */}
      <div
        className="flex h-7 shrink-0 items-center gap-2 border-b px-3"
        style={{ borderColor: theme.ui.border, backgroundColor: hexToRgba(theme.ui.bgSecondary, 0.6) }}
      >
        <span className="text-xs font-mono" style={{ color: theme.ui.textMuted }}>
          {config?.portName ?? "Serial"} — {config?.baudRate ?? ""} baud
        </span>
      </div>

      <div ref={containerRef} className="flex-1 min-h-0 p-1" />

      {exited && config && (
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-lg border text-xs"
          style={{ backgroundColor: hexToRgba(theme.ui.bgSecondary, 0.9), borderColor: theme.ui.border, color: theme.ui.textSecondary }}
        >
          <span>Port closed</span>
          <button
            className="px-2 py-0.5 rounded text-xs"
            style={{ backgroundColor: theme.ui.accent, color: "#fff" }}
            onClick={() => reconnect(config)}
          >
            Reconnect
          </button>
        </div>
      )}
    </div>
  );
}
