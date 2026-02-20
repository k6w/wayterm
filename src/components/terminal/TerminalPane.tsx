import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Terminal } from "@xterm/xterm";
import { WebglAddon } from "@xterm/addon-webgl";
import { FitAddon } from "@xterm/addon-fit";
import { useThemeStore } from "../../stores/theme";
import { useSettingsStore } from "../../stores/settings";
import { useTerminalStore } from "../../stores/terminal";
import DropZoneOverlay from "./DropZoneOverlay";
import PaneContextMenu from "./PaneContextMenu";
import {
  terminalSpawn,
  terminalWrite,
  terminalResize,
  terminalKill,
  onTerminalOutput,
  onTerminalExit,
  sshGetKeyTempPath,
} from "../../lib/ipc";
import { getDefaultShell } from "../../lib/shell-detect";
import { useSshStore } from "../../stores/ssh";
import {
  getCachedTerminal,
  setCachedTerminal,
  removeCachedTerminal,
} from "../../lib/terminal-registry";
import { hexToRgba } from "../../lib/color";
import "@xterm/xterm/css/xterm.css";

interface TerminalPaneProps {
  paneId: string;
  isActive: boolean;
  paneCount?: number;
}

/** Returns shell args & env vars that silently set up CWD-in-title reporting */
function getShellIntegration(shellPath: string): {
  args: string[];
  env: [string, string][];
} {
  const lower = shellPath.toLowerCase();

  if (lower.includes("pwsh") || lower.includes("powershell")) {
    return {
      args: [
        "-NoLogo",
        "-NoExit",
        "-Command",
        "function global:prompt { $Host.UI.RawUI.WindowTitle = $PWD.Path; 'PS ' + $PWD.Path + '> ' }",
      ],
      env: [],
    };
  }

  if (lower.includes("bash")) {
    return {
      args: [],
      env: [
        [
          "PROMPT_COMMAND",
          'printf "\\033]0;%s\\007" "$PWD"',
        ],
      ],
    };
  }

  if (lower.includes("zsh")) {
    return {
      args: [],
      env: [
        ["NEXTERM_ZSH_INTEGRATION", "1"],
        [
          "PROMPT_COMMAND",
          'printf "\\033]0;%s\\007" "$PWD"',
        ],
      ],
    };
  }

  if (lower.includes("fish")) {
    return {
      args: [
        "-C",
        "function fish_title; echo $PWD; end",
      ],
      env: [],
    };
  }

  // cmd.exe — override prompt to emit OSC title sequence with current directory
  // $e = ESC, $p = current path, $e\ = ST (string terminator), $g = >
  if (lower.includes("cmd")) {
    return {
      args: ["/K", "prompt $e]0;$p$e\\$p$g"],
      env: [],
    };
  }

  return { args: [], env: [] };
}

/** Decide what binary + args to spawn based on pane config */
async function resolveSpawnConfig(
  pane: import("../../types/terminal").TerminalPane | undefined,
  settings: ReturnType<typeof useSettingsStore.getState>["settings"]
): Promise<{ shell: string; args: string[]; env: [string, string][] }> {
  // ── SSH connection ──
  if (pane?.sshConnectionId) {
    const conn = useSshStore
      .getState()
      .connections.find((c) => c.id === pane.sshConnectionId);

    if (conn) {
      const args: string[] = [];

      // Key auth — write stored key to temp file and use -i
      if (conn.authMethod === "key" && conn.privateKeyId) {
        try {
          const keyPath = await sshGetKeyTempPath(conn.privateKeyId);
          args.push("-i", keyPath);
        } catch {
          // Fall through without -i; ssh will try agent/default keys
        }
      }

      // Disable strict host key checking for convenience
      args.push("-o", "StrictHostKeyChecking=accept-new");

      // Force pseudo-terminal so the remote shell is interactive
      args.push("-t");

      // Port
      if (conn.port && conn.port !== 22) {
        args.push("-p", String(conn.port));
      }

      // user@host (must come before the remote command)
      args.push(`${conn.username}@${conn.host}`);

      // Remote command: silently inject CWD tracking, run user startup
      // commands if any, then exec into a login shell.
      // PROMPT_COMMAND makes bash/zsh emit PWD as an OSC title sequence.
      const cwdTracking =
        `export PROMPT_COMMAND='printf "\\033]0;%s\\007" "$PWD"'`;
      const startup = conn.startupCommands
        ? `${conn.startupCommands}; `
        : "";
      args.push(`${cwdTracking}; ${startup}exec $SHELL -l`);

      return { shell: "ssh", args, env: [] };
    }
  }

  // ── Local shell ──
  const detectedShell = getDefaultShell();
  const shellPath =
    pane?.shellPath || settings.general.defaultShell || detectedShell.path;
  const integration = getShellIntegration(shellPath);
  return { shell: shellPath, args: integration.args, env: integration.env };
}

export default function TerminalPane({
  paneId,
  isActive,
  paneCount = 1,
}: TerminalPaneProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionRef = useRef<string | null>(null);

  const theme = useThemeStore((s) => s.active);
  const settings = useSettingsStore((s) => s.settings);
  const updatePaneSession = useTerminalStore((s) => s.updatePaneSession);

  // ── Mount: reuse cached terminal or create fresh ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let resizeObs: ResizeObserver | null = null;
    let cancelled = false;

    const cached = getCachedTerminal(paneId);

    if (cached) {
      // ── REATTACH existing terminal DOM ──
      container.appendChild(cached.element);
      termRef.current = cached.terminal;
      fitRef.current = cached.fitAddon;
      sessionRef.current = cached.sessionId;

      // Refit after reattach so dimensions match the new container
      requestAnimationFrame(() => {
        if (cancelled) return;
        try {
          cached.fitAddon.fit();
          if (cached.sessionId) {
            terminalResize(
              cached.sessionId,
              cached.terminal.rows,
              cached.terminal.cols
            );
          }
        } catch {
          // ignore
        }
      });

      // Observe future resizes
      resizeObs = new ResizeObserver(() => {
        try {
          cached.fitAddon.fit();
          const c = getCachedTerminal(paneId);
          if (c?.sessionId) {
            terminalResize(c.sessionId, cached.terminal.rows, cached.terminal.cols);
          }
        } catch {
          // ignore
        }
      });
      resizeObs.observe(container);
    } else {
      // ── CREATE new terminal ──
      (async () => {
        // Create a portable wrapper div that xterm opens into
        const termEl = document.createElement("div");
        termEl.style.width = "100%";
        termEl.style.height = "100%";
        container.appendChild(termEl);

        const vibrancy = settings.appearance.vibrancyEnabled;
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
          // Always true so the canvas renderer uses clearRect (transparent).
          // When vibrancy is off, solid theme background covers it anyway.
          allowTransparency: true,
          theme: makeXtermTheme(theme, vibrancy, settings.appearance.windowOpacity),
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(termEl);

        // WebGL is faster but always opaque — skip it when vibrancy is on
        let webgl: import("@xterm/addon-webgl").WebglAddon | null = null;
        if (!vibrancy) {
          try {
            const addon = new WebglAddon();
            term.loadAddon(addon);
            webgl = addon;
          } catch {
            // canvas fallback
          }
        }

        fitAddon.fit();
        termRef.current = term;
        fitRef.current = fitAddon;

        if (cancelled) {
          term.dispose();
          termEl.remove();
          return;
        }

        // Spawn PTY — either SSH or local shell
        const existingPane = useTerminalStore.getState().panes[paneId];
        const { shell: spawnShell, args: spawnArgs, env: spawnEnv } =
          await resolveSpawnConfig(existingPane, settings);

        const sessionId = await terminalSpawn({
          shell: spawnShell,
          args: spawnArgs,
          cwd: "",
          env: spawnEnv,
          rows: term.rows,
          cols: term.cols,
        });

        if (cancelled) {
          terminalKill(sessionId).catch(() => {});
          term.dispose();
          termEl.remove();
          return;
        }

        sessionRef.current = sessionId;
        updatePaneSession(paneId, sessionId);

        const unlistenOutput = await onTerminalOutput(
          sessionId,
          (data: number[]) => {
            term.write(new Uint8Array(data));
          }
        );

        const unlistenExit = await onTerminalExit(sessionId, () => {
          term.write("\r\n\x1b[90m--- Process exited ---\x1b[0m\r\n");
        });

        term.onData((data: string) => {
          // Read sessionId from cache — NOT from React refs, which get
          // invalidated when the component unmounts/remounts during splits.
          const c = getCachedTerminal(paneId);
          if (c?.sessionId) {
            const bytes = Array.from(new TextEncoder().encode(data));
            terminalWrite(c.sessionId, bytes);
          }
        });

        term.onTitleChange((title: string) => {
          if (!title) return;
          const isPath =
            /^[A-Za-z]:[\\/]/.test(title) ||
            title.startsWith("/") ||
            title.startsWith("\\\\");
          if (isPath) {
            useTerminalStore.getState().updatePaneCwd(paneId, title);
          }
        });

        // Store in cache
        setCachedTerminal(paneId, {
          terminal: term,
          fitAddon,
          element: termEl,
          sessionId,
          unlistenOutput,
          unlistenExit,
          webglAddon: webgl,
        });

        // Observe resizes
        resizeObs = new ResizeObserver(() => {
          try {
            fitAddon.fit();
            const c = getCachedTerminal(paneId);
            if (c?.sessionId) {
              terminalResize(c.sessionId, term.rows, term.cols);
            }
          } catch {
            // ignore
          }
        });
        resizeObs.observe(container);
      })();
    }

    // ── CLEANUP on unmount ──
    return () => {
      cancelled = true;
      if (resizeObs) resizeObs.disconnect();

      const paneStillExists =
        !!useTerminalStore.getState().panes[paneId];

      if (paneStillExists) {
        // Pane was detached/moved — keep cache, just detach DOM
        const c = getCachedTerminal(paneId);
        if (c && container.contains(c.element)) {
          container.removeChild(c.element);
        }
      } else {
        // Pane was closed — dispose everything
        const c = getCachedTerminal(paneId);
        if (c) {
          if (c.unlistenOutput) c.unlistenOutput();
          if (c.unlistenExit) c.unlistenExit();
          if (c.sessionId) terminalKill(c.sessionId).catch(() => {});
          c.terminal.dispose();
          removeCachedTerminal(paneId);
        }
      }

      termRef.current = null;
      fitRef.current = null;
      sessionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneId]);

  // ── Sync theme + vibrancy (manages WebGL addon lifecycle) ──
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    const vibrancy = settings.appearance.vibrancyEnabled;
    const opacity = settings.appearance.windowOpacity;

    // Manage WebGL addon — WebGL always renders an opaque canvas,
    // so it must be removed for any transparency to show.
    const cached = getCachedTerminal(paneId);
    if (cached) {
      if (vibrancy && cached.webglAddon) {
        try { cached.webglAddon.dispose(); } catch { /* already disposed */ }
        cached.webglAddon = null;
      } else if (!vibrancy && !cached.webglAddon) {
        try {
          const addon = new WebglAddon();
          term.loadAddon(addon);
          cached.webglAddon = addon;
        } catch {
          // canvas fallback
        }
      }
    }

    // Update theme (background = transparent when vibrancy on, solid when off)
    term.options.theme = makeXtermTheme(theme, vibrancy, opacity);
    term.refresh(0, term.rows - 1);
  }, [theme, settings.appearance.vibrancyEnabled, settings.appearance.windowOpacity, paneId]);

  // ── Sync appearance settings ──
  useEffect(() => {
    if (!termRef.current) return;
    termRef.current.options.fontFamily =
      settings.appearance.terminalFontFamily;
    termRef.current.options.fontSize =
      settings.appearance.terminalFontSize;
    termRef.current.options.lineHeight =
      settings.appearance.terminalLineHeight;
    termRef.current.options.cursorStyle =
      settings.appearance.cursorStyle;
    termRef.current.options.cursorBlink =
      settings.appearance.cursorBlink;
    if (fitRef.current) fitRef.current.fit();
  }, [settings.appearance]);

  // ── Focus when active ──
  useEffect(() => {
    if (isActive && termRef.current) {
      // Use rAF to ensure focus happens after React finishes rendering
      requestAnimationFrame(() => {
        termRef.current?.focus();
      });
    }
  }, [isActive]);

  // ── UI state ──
  const draggingTabId = useTerminalStore((s) => s.draggingTabId);
  const dragOverPaneId = useTerminalStore((s) => s.dragOverPaneId);
  const dragOverZone = useTerminalStore((s) => s.dragOverZone);
  const setActivePane = useTerminalStore((s) => s.setActivePane);
  const closePaneInTab = useTerminalStore((s) => s.closePaneInTab);
  const detachPaneToTab = useTerminalStore((s) => s.detachPaneToTab);

  const [hovered, setHovered] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(
    null
  );

  const showDropZone = draggingTabId !== null && dragOverPaneId === paneId;
  const showFocus = isActive && paneCount > 1;
  const showCloseBtn = paneCount > 1 && (isActive || hovered);

  const isSplit = paneCount > 1;

  return (
    <div
      ref={wrapperRef}
      data-pane-id={paneId}
      className={`relative h-full w-full overflow-hidden ${isSplit ? "rounded-lg" : ""} ${settings.appearance.vibrancyEnabled ? "vibrancy-active" : ""}`}
      style={{
        border: showFocus
          ? `1.5px solid ${theme.ui.accent}`
          : isSplit
            ? `1.5px solid ${theme.ui.border || "transparent"}`
            : "1.5px solid transparent",
        boxShadow: showFocus
          ? `0 0 12px ${theme.ui.accent}33`
          : "none",
      }}
      onMouseDown={() => {
        setActivePane(paneId);
        // Re-focus terminal after React re-render settles
        requestAnimationFrame(() => {
          termRef.current?.focus();
        });
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={(e) => {
        e.preventDefault();
        setCtxMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{
          padding: "6px 4px 0 6px",
          backgroundColor: settings.appearance.vibrancyEnabled
            ? hexToRgba(theme.terminal.background, settings.appearance.windowOpacity)
            : theme.terminal.background,
        }}
      />

      {showCloseBtn && (
        <div
          className="absolute top-2 right-5 z-10 flex items-center gap-0.5"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              detachPaneToTab(paneId);
            }}
            className="flex h-5 w-5 items-center justify-center rounded opacity-50 transition-opacity hover:opacity-100"
            style={{
              background: theme.ui.bgSecondary,
              color: theme.ui.textMuted,
            }}
            title="Detach to tab"
          >
            <ExternalLink size={10} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              closePaneInTab(paneId);
            }}
            className="flex h-5 w-5 items-center justify-center rounded opacity-50 transition-opacity hover:opacity-100"
            style={{
              background: theme.ui.bgSecondary,
              color: theme.ui.textMuted,
            }}
            title="Close pane"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M1 1l8 8M9 1l-8 8" />
            </svg>
          </button>
        </div>
      )}

      {showDropZone && <DropZoneOverlay activeZone={dragOverZone} />}

      {ctxMenu && (
        <PaneContextMenu
          paneId={paneId}
          paneCount={paneCount}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

function makeXtermTheme(
  theme: ReturnType<typeof useThemeStore.getState>["active"],
  vibrancyEnabled = false,
  _windowOpacity = 1.0,
) {
  return {
    foreground: theme.terminal.foreground,
    // When vibrancy is on, xterm itself is fully transparent — the container
    // div behind it provides the rgba-tinted background.
    background: vibrancyEnabled
      ? "rgba(0, 0, 0, 0)"
      : theme.terminal.background,
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
}
