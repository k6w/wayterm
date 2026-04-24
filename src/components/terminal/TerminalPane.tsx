import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Terminal } from "@xterm/xterm";
import { WebglAddon } from "@xterm/addon-webgl";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import { useThemeStore } from "../../stores/theme";
import { useSettingsStore } from "../../stores/settings";
import { useTerminalStore } from "../../stores/terminal";
import DropZoneOverlay from "./DropZoneOverlay";
import PaneContextMenu from "./PaneContextMenu";
import { SearchBar } from "../search/SearchBar";
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
import {
  attachSerializeAddon,
  detachSerializeAddon,
} from "../../lib/buffer-persistence";
import { useWorkspaceStore } from "../../stores/workspace";
import { hexToRgba } from "../../lib/color";
import { vibrancyAlpha } from "../../lib/platform";
import "@xterm/xterm/css/xterm.css";

interface TerminalPaneProps {
  paneId: string;
  isActive: boolean;
  paneCount?: number;
}


function hasVisibleContent(data: number[]): boolean {
  let run = 0;
  let i = 0;
  while (i < data.length) {
    const b = data[i];
    if (b === 0x1b) {
      run = 0;
      i++;
      if (i >= data.length) break;
      if (data[i] === 0x5b) {
        
        i++;
        while (i < data.length && !(data[i] >= 0x40 && data[i] <= 0x7e)) i++;
        if (i < data.length) i++;
      } else if (data[i] === 0x5d) {
        
        i++;
        while (i < data.length && data[i] !== 0x07 && data[i] !== 0x1b) i++;
        if (i < data.length) i++;
      } else {
        i++; 
      }
      continue;
    }
    if (b >= 0x20 && b <= 0x7e) {
      if (++run >= 3) return true;
    } else {
      run = 0;
    }
    i++;
  }
  return false;
}


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

  
  
  if (lower.includes("cmd")) {
    return {
      args: ["/K", "prompt $e]0;$p$e\\$p$g"],
      env: [],
    };
  }

  return { args: [], env: [] };
}


export class SshConnectionNotFoundError extends Error {
  constructor(connectionId: string) {
    super(`SSH connection with ID "${connectionId}" not found`);
    this.name = "SshConnectionNotFoundError";
  }
}

async function resolveSpawnConfig(
  pane: import("../../types/terminal").TerminalPane | undefined,
  settings: ReturnType<typeof useSettingsStore.getState>["settings"]
): Promise<{ shell: string; args: string[]; env: [string, string][] }> {
  
  if (pane?.sshConnectionId) {
    const conn = useSshStore
      .getState()
      .connections.find((c) => c.id === pane.sshConnectionId);

    if (!conn) {
      throw new SshConnectionNotFoundError(pane.sshConnectionId);
    }

    const sshArgs: string[] = [];

    sshArgs.push("-o", "StrictHostKeyChecking=accept-new");

    
    if (conn.authMethod === "key" && conn.privateKeyId) {
      try {
        const keyPath = await sshGetKeyTempPath(conn.privateKeyId);
        sshArgs.push("-i", keyPath);
      } catch {
        
      }
    }

    if (conn.port && conn.port !== 22) {
      sshArgs.push("-p", String(conn.port));
    }

    sshArgs.push(`${conn.username}@${conn.host}`);

    return { shell: "ssh", args: sshArgs, env: [] };
  }

  
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
  const searchAddonRef = useRef<SearchAddon | null>(null);

  const theme = useThemeStore((s) => s.active);
  const settings = useSettingsStore((s) => s.settings);
  const updatePaneSession = useTerminalStore((s) => s.updatePaneSession);
  const [showSearch, setShowSearch] = useState(false);
  const [sessionExited, setSessionExited] = useState(false);

  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let resizeObs: ResizeObserver | null = null;
    let cancelled = false;
    const sshTimers: ReturnType<typeof setTimeout>[] = [];

    const cached = getCachedTerminal(paneId);

    if (cached) {
      
      container.appendChild(cached.element);
      termRef.current = cached.terminal;
      fitRef.current = cached.fitAddon;
      sessionRef.current = cached.sessionId;

      
      
      
      
      requestAnimationFrame(() => {
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
            
          }
        });
      });

      
      
      
      
      
      resizeObs = new ResizeObserver((entries) => {
        const rect = entries[0]?.contentRect;
        if (!rect || rect.width === 0 || rect.height === 0) return;
        try {
          cached.fitAddon.fit();
          
          
          
          requestAnimationFrame(() => {
            const c = getCachedTerminal(paneId);
            if (c?.sessionId) {
              terminalResize(c.sessionId, cached.terminal.rows, cached.terminal.cols);
            }
          });
        } catch {
          
        }
      });
      resizeObs.observe(container);
    } else {
      
      (async () => {
        
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
          
          
          allowTransparency: true,
          theme: makeXtermTheme(theme, vibrancy, settings.appearance.windowOpacity),
        });
        
        
        const ligaturesEnabled = settings.terminal.ligatures;
        if (ligaturesEnabled) {
          term.element?.classList.add('terminal-ligatures');
        }

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(termEl);

        
        const webLinksAddon = new WebLinksAddon();
        term.loadAddon(webLinksAddon);

        const searchAddon = new SearchAddon();
        term.loadAddon(searchAddon);
        searchAddonRef.current = searchAddon;

        
        let webgl: import("@xterm/addon-webgl").WebglAddon | null = null;
        if (!vibrancy) {
          try {
            const addon = new WebglAddon();
            term.loadAddon(addon);
            webgl = addon;
          } catch {
            
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

        
        const bufferEnabled = useSettingsStore.getState().settings.terminal.bufferPersistence;
        if (bufferEnabled) {
          const wsState = useWorkspaceStore.getState();
          if (wsState._buffersReadyPromise) {
            
            await Promise.race([
              wsState._buffersReadyPromise,
              new Promise((r) => setTimeout(r, 150)),
            ]);
          }
          const savedBuffer = useWorkspaceStore.getState().consumeBuffer(paneId);
          if (savedBuffer) {
            term.write(savedBuffer);
            
            
            term.write("\x1b[2J\x1b[H");
          }
        }

        
        const existingPane = useTerminalStore.getState().panes[paneId];
        const isSsh = !!existingPane?.sshConnectionId;

        let spawnShell: string, spawnArgs: string[], spawnEnv: [string, string][];
        try {
          const config = await resolveSpawnConfig(existingPane, settings);
          spawnShell = config.shell;
          spawnArgs = config.args;
          spawnEnv = config.env;
        } catch (err) {
          if (err instanceof SshConnectionNotFoundError) {
            term.write(`\x1b[31mError: ${err.message}\x1b[0m\r\n`);
            term.write("\x1b[90mConnection not found. Please check your SSH settings.\x1b[0m\r\n");
          } else {
            term.write(`\x1b[31mError: Failed to resolve spawn config\x1b[0m\r\n`);
          }
          return;
        }

        const sessionId = await terminalSpawn({
          shell: spawnShell,
          args: spawnArgs,
          cwd: existingPane?.cwd || "",
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

        
        
        
        
        
        
        
        let sshPhase: "overlay" | "settling" | "done" = isSsh ? "overlay" : "done";
        const sshBuffer: Uint8Array[] = [];

        
        if (isSsh) {
          sshTimers.push(
            setTimeout(() => setSshStep("Authenticating..."), 600)
          );
        }

        const unlistenOutput = await onTerminalOutput(
          sessionId,
          (data: number[]) => {
            if (sshPhase === "done") {
              term.write(new Uint8Array(data));
              return;
            }

            
            if (sshPhase === "settling") {
              sshBuffer.push(new Uint8Array(data));
              return;
            }

            
            if (!hasVisibleContent(data)) return;

            
            sshBuffer.push(new Uint8Array(data));

            
            const text = new TextDecoder().decode(new Uint8Array(data));
            if (/password|passphrase|yes\/no|verification/i.test(text)) {
              
              for (const chunk of sshBuffer) term.write(chunk);
              sshBuffer.length = 0;
              sshPhase = "done";
              setSshOverlay(false);
              return;
            }

            
            sshPhase = "settling";
            setSshStep("Preparing session...");
            const encoder = new TextEncoder();

            sshTimers.push(
              setTimeout(() => {
                
                
                const cmd =
                  ' PROMPT_COMMAND=\'printf "\\033]0;%s\\007" "$PWD"\'\n';
                terminalWrite(
                  sessionId,
                  Array.from(encoder.encode(cmd))
                );

                sshTimers.push(
                  setTimeout(() => {
                    
                    
                    
                    for (const chunk of sshBuffer) term.write(chunk);
                    sshBuffer.length = 0;
                    term.write("\x1b[A\x1b[M");
                    sshPhase = "done";
                    setSshOverlay(false);
                  }, 350)
                );
              }, 400)
            );
          }
        );

        const unlistenExit = await onTerminalExit(sessionId, () => {
          sshTimers.forEach((t) => clearTimeout(t));
          sshTimers.length = 0;
          if (sshPhase !== "done") {
            sshPhase = "done";
            setSshOverlay(false);
          }
          term.write("\r\n\x1b[90m--- Process exited ---\x1b[0m\r\n");
          setSessionExited(true);
        });

        term.onData((data: string) => {
          
          
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

        term.onBell(() => {
          const state = useTerminalStore.getState();
          const tab = state.tabs.find((t) => {
            const findPane = (n: import("../../types/terminal").SplitNode): boolean => {
              if (n.type === "pane") return n.paneId === paneId;
              return n.children?.some(findPane) ?? false;
            };
            return findPane(t.panes);
          });
          if (tab && tab.id !== state.activeTabId) {
            state.setBellAlert(tab.id, true);
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

        // Attach serialize addon for buffer persistence (only when enabled)
        if (useSettingsStore.getState().settings.terminal.bufferPersistence) {
          attachSerializeAddon(paneId, term);
        }

        // Observe resizes — skip zero-size callbacks (hidden tab)
        resizeObs = new ResizeObserver((entries) => {
          const rect = entries[0]?.contentRect;
          if (!rect || rect.width === 0 || rect.height === 0) return;
          try {
            fitAddon.fit();
            // Use requestAnimationFrame to ensure DOM layout is settled
            // before reading terminal dimensions, otherwise we get stale
            // row/col values which causes desync with the PTY
            requestAnimationFrame(() => {
              const c = getCachedTerminal(paneId);
              if (c?.sessionId) {
                terminalResize(c.sessionId, term.rows, term.cols);
              }
            });
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
      sshTimers.forEach((t) => clearTimeout(t));
      sshTimers.length = 0;
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
        detachSerializeAddon(paneId);
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

  useEffect(() => {
    if (!isActive) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        setShowSearch(true);
      }
      if (e.key === 'Escape' && showSearch) {
        e.preventDefault();
        e.stopPropagation();
        setShowSearch(false);
      }
    };

    const handleOpenSearch = () => {
      setShowSearch(true);
    };
    
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('nexterm:open-search', handleOpenSearch);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('nexterm:open-search', handleOpenSearch);
    };
  }, [isActive, showSearch]);

  // ── UI state ──
  const draggingTabId = useTerminalStore((s) => s.draggingTabId);
  const dragOverPaneId = useTerminalStore((s) => s.dragOverPaneId);
  const dragOverZone = useTerminalStore((s) => s.dragOverZone);
  const setActivePane = useTerminalStore((s) => s.setActivePane);
  const closePaneInTab = useTerminalStore((s) => s.closePaneInTab);
  const detachPaneToTab = useTerminalStore((s) => s.detachPaneToTab);

  // SSH overlay state — computed once at mount from stores
  const [sshInfo] = useState(() => {
    const p = useTerminalStore.getState().panes[paneId];
    if (!p?.sshConnectionId) return null;
    const conn = useSshStore
      .getState()
      .connections.find((c) => c.id === p.sshConnectionId);
    if (!conn) return null;
    return {
      hostLabel: conn.name,
      authMethod: conn.authMethod,
    };
  });
  const [sshOverlay, setSshOverlay] = useState(() => !!sshInfo && !getCachedTerminal(paneId));
  const [sshStep, setSshStep] = useState<string>(() => sshInfo && !getCachedTerminal(paneId) ? "Resolving host..." : "");

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
      {showSearch && searchAddonRef.current && (
        <SearchBar
          terminalId={paneId}
          searchAddon={searchAddonRef.current}
          onClose={() => setShowSearch(false)}
        />
      )}

      <div
        ref={containerRef}
        className="h-full w-full"
        style={{
          padding: "6px 4px 0 6px",
          backgroundColor: settings.appearance.vibrancyEnabled
            ? hexToRgba(theme.terminal.background, vibrancyAlpha(settings.appearance.windowOpacity) * 0.7)
            : hexToRgba(theme.terminal.background, 0.85),
          borderRadius: showSearch ? '0 0 8px 8px' : '8px',
        }}
      />

      {sshOverlay && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4"
          style={{
            backgroundColor: settings.appearance.vibrancyEnabled
              ? hexToRgba(theme.terminal.background, vibrancyAlpha(settings.appearance.windowOpacity) * 0.7)
              : hexToRgba(theme.terminal.background, 0.85),
            borderRadius: showSearch ? '0 0 8px 8px' : '8px',
          }}
        >
          <div
            className="h-8 w-8 animate-spin rounded-full border-[2.5px]"
            style={{
              borderColor: theme.ui.accent + "25",
              borderTopColor: theme.ui.accent,
            }}
          />
          <div className="flex flex-col items-center gap-1.5">
            <span
              className="text-xs tracking-wide"
              style={{ color: theme.terminal.foreground + "b0" }}
            >
              Connecting to {sshInfo?.hostLabel ?? "remote host"}
            </span>
            {sshStep && (
              <span
                className="text-[11px] tracking-wide"
                style={{ color: theme.terminal.foreground + "50" }}
              >
                {sshStep}
              </span>
            )}
          </div>
        </div>
      )}

      {sessionExited && (
        <div
          className="absolute bottom-4 left-0 right-0 z-20 flex justify-center"
        >
          <button
            onClick={() => {
              setSessionExited(false);
              const pane = useTerminalStore.getState().panes[paneId];
              if (pane) {
                const shell = pane.shellType || "bash";
                const { addTab, removeTab } = useTerminalStore.getState();
                const tab = useTerminalStore.getState().tabs.find(t => {
                  const find = (n: import("../../types/terminal").SplitNode): boolean => {
                    if (n.type === "pane") return n.paneId === paneId;
                    return n.children?.some(find) ?? false;
                  };
                  return find(t.panes);
                });
                if (tab && pane.sshConnectionId) {
                  addTab("ssh", undefined, pane.sshConnectionId);
                  const newTabs = useTerminalStore.getState().tabs;
                  const newTab = newTabs[newTabs.length - 1];
                  if (newTab) useTerminalStore.getState().renameTab(newTab.id, tab.title);
                  removeTab(tab.id);
                } else if (tab) {
                  addTab(shell as import("../../types/terminal").ShellType, pane.shellPath);
                  removeTab(tab.id);
                }
              }
            }}
            className="px-4 py-1.5 text-xs rounded-md transition-colors"
            style={{
              backgroundColor: theme.ui.accent,
              color: "#fff",
            }}
          >
            Reconnect
          </button>
        </div>
      )}

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
