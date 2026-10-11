import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { useThemeStore } from "../../stores/theme";
import { useSettingsStore } from "../../stores/settings";
import { useTerminalStore } from "../../stores/terminal";
import { serialOpen, serialWrite, serialClose, onSerialOutput, onSerialExit } from "../../lib/ipc";
import { hexToRgba } from "../../lib/color";
import { loadWebgl } from "../../lib/webgl";
import { loadLigatures } from "../../lib/ligatures";
import type { SerialConfig } from "../../types/terminal";
import "@xterm/xterm/css/xterm.css";

interface SerialPaneProps {
  paneId: string;
  isActive: boolean;
  paneCount?: number;
}

function makeXtermTheme(theme: ReturnType<typeof useThemeStore.getState>["active"], vibrancy: boolean) {
  const [black, red, green, yellow, blue, magenta, cyan, white,
         brightBlack, brightRed, brightGreen, brightYellow,
         brightBlue, brightMagenta, brightCyan, brightWhite] = theme.terminal.ansi;
  return {
    background: vibrancy ? hexToRgba(theme.terminal.background, 0) : theme.terminal.background,
    foreground: theme.terminal.foreground,
    cursor: theme.terminal.cursor,
    cursorAccent: theme.terminal.cursorAccent ?? theme.terminal.background,
    selectionBackground: theme.terminal.selection,
    black, red, green, yellow, blue, magenta, cyan, white,
    brightBlack, brightRed, brightGreen, brightYellow,
    brightBlue, brightMagenta, brightCyan, brightWhite,
  };
}

export default function SerialPane({ paneId }: SerialPaneProps) {
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

  const bgColor = vibrancy
    ? "transparent"
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
    // Mount-time snapshot: this effect creates the xterm instance and opens the
    // serial port once per pane, so it must not re-run on store changes.
    const pane = useTerminalStore.getState().panes[paneId];
    if (!container || !pane?.serialConfig) return;
    const settings = useSettingsStore.getState().settings;
    const theme = useThemeStore.getState().active;
    const vibrancy = settings.appearance.vibrancyEnabled;
  
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
      theme: makeXtermTheme(theme, vibrancy),
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    const termEl = document.createElement("div");
    termEl.style.width = "100%";
    termEl.style.height = "100%";
    container.appendChild(termEl);
    term.open(termEl);

    if (settings.terminal.ligatures) loadLigatures(term);
    loadWebgl(term);

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
  }, [paneId]);

  const config = pane?.serialConfig;

  // Focus is shown by the PaneFrame around this pane, so no border here.
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden bg-(--wt-dyn-bg)"
      style={{ "--wt-dyn-bg": bgColor } as CSSProperties}
      onMouseDown={() => setActivePane(paneId)}
    >
      {/* Header bar */}
      <div
        className="flex h-7 shrink-0 items-center gap-2 border-b border-border bg-panel/60 px-3"
      >
        <span className="text-xs font-mono text-fg-muted">
          {config?.portName ?? "Serial"} — {config?.baudRate ?? ""} baud
        </span>
      </div>

      <div ref={containerRef} className="flex-1 min-h-0 p-1" />

      {exited && config && (
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-panel/90 text-fg-secondary text-xs"
        >
          <span>Port closed</span>
          <button
            className="px-2 py-0.5 rounded text-xs bg-accent text-fg-on-accent"
            onClick={() => reconnect(config)}
          >
            Reconnect
          </button>
        </div>
      )}
    </div>
  );
}
