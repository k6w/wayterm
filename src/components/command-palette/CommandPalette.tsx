import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Terminal,
  Columns2,
  Rows2,
  Settings,
  PanelLeft,
  Plus,
  X,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Focus,
  Palette,
  Eraser,
  RotateCcw,
  Copy,
  MonitorDot,
  Hash,
  SquareTerminal,
  ArrowLeft,
  Check,
  Sun,
  Moon,
  Clock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTerminalStore } from "../../stores/terminal";
import { useThemeStore } from "../../stores/theme";
import { useSettingsStore } from "../../stores/settings";
import { useSshStore } from "../../stores/ssh";
import { hexToRgba } from "../../lib/color";
import { vibrancyAlpha } from "../../lib/platform";
import { getEffectiveKeybindings } from "../../lib/keybindings";
import { getDefaultShells } from "../../lib/shell-detect";
import { clearBuffer, resetTerminal, writeToTerminal, getCachedTerminal } from "../../lib/terminal-registry";
import { historyRecent } from "../../lib/ipc";
import { resolveSnippetVars } from "../../lib/snippet-utils";

type SubView = null | "themes";

interface PaletteAction {
  id: string;
  label: string;
  keys?: string;
  icon: LucideIcon;
  category: string;
  
  subView?: SubView;
  handler: () => void;
}

const KEYBINDING_ICONS: Record<string, LucideIcon> = {
  "new-tab": Plus,
  "close-tab": X,
  "close-pane": X,
  "toggle-sidebar": PanelLeft,
  "command-palette": ArrowRightLeft,
  settings: Settings,
  "split-horizontal": Columns2,
  "split-vertical": Rows2,
  "next-tab": ChevronRight,
  "prev-tab": ChevronLeft,
  "detach-pane": ExternalLink,
  "focus-next-pane": Focus,
  "focus-prev-pane": Focus,
  "focus-next-pane-arrow": Focus,
  "focus-prev-pane-arrow": Focus,
  "zoom-pane": Focus,
  "toggle-scratchpad": SquareTerminal,
};

const SHELL_ICONS: Record<string, LucideIcon> = {
  powershell: SquareTerminal,
  cmd: MonitorDot,
  gitbash: Hash,
  wsl: Terminal,
  bash: Terminal,
  zsh: Terminal,
  fish: Terminal,
  sh: Terminal,
};

function formatShortcut(keys: string): string[] {
  return keys
    .replace("Control", "Ctrl")
    .replace("Meta", "Cmd")
    .split("+");
}

export default function CommandPalette() {
  const isOpen = useTerminalStore((s) => s.commandPaletteOpen);
  const toggleCommandPalette = useTerminalStore(
    (s) => s.toggleCommandPalette
  );
  const theme = useThemeStore((s) => s.active);
  const vibrancy = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const windowOpacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);

  const paletteBg = vibrancy
    ? hexToRgba(theme.ui.bgPrimary, vibrancyAlpha(windowOpacity) * 0.88)
    : theme.ui.bgPrimary;

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [subView, setSubView] = useState<SubView>(null);
  const [subQuery, setSubQuery] = useState("");
  const [subSelectedIndex, setSubSelectedIndex] = useState(0);
  const [historyActions, setHistoryActions] = useState<PaletteAction[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const subInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const allActions = useMemo(() => {
    const actions: PaletteAction[] = [];

    
    const bindings = getEffectiveKeybindings();
    for (const b of bindings) {
      if (b.id === "command-palette") continue;
      actions.push({
        id: b.id,
        label: b.label,
        keys: b.keys,
        icon: KEYBINDING_ICONS[b.id] || Terminal,
        category: "Actions",
        handler: b.handler,
      });
    }

    
    actions.push({
      id: "clear-buffer",
      label: "Clear Terminal Buffer",
      icon: Eraser,
      category: "Terminal",
      handler: () => {
        const paneId = useTerminalStore.getState().activePaneId;
        if (paneId) clearBuffer(paneId);
      },
    });
    actions.push({
      id: "reset-terminal",
      label: "Reset Terminal",
      icon: RotateCcw,
      category: "Terminal",
      handler: () => {
        const paneId = useTerminalStore.getState().activePaneId;
        if (paneId) resetTerminal(paneId);
      },
    });
    actions.push({
      id: "copy-cwd",
      label: "Copy Current Path",
      icon: Copy,
      category: "Terminal",
      handler: () => {
        const state = useTerminalStore.getState();
        const pane = state.activePaneId ? state.panes[state.activePaneId] : null;
        if (pane?.cwd) navigator.clipboard.writeText(pane.cwd);
      },
    });

    
    const shells = getDefaultShells();
    for (const shell of shells) {
      actions.push({
        id: `new-tab-${shell.type}-${shell.path}`,
        label: `New ${shell.label} Tab`,
        icon: SHELL_ICONS[shell.type] || Terminal,
        category: "New Tab",
        handler: () => {
          useTerminalStore.getState().addTab(shell.type, shell.path);
        },
      });
    }

    
    actions.push({
      id: "change-theme",
      label: "Change Theme",
      icon: Palette,
      category: "Appearance",
      subView: "themes",
      handler: () => {},
    });

    actions.push({
      id: "toggle-scratchpad",
      label: "Toggle Scratchpad Terminal",
      icon: SquareTerminal,
      category: "Terminal",
      handler: () => {
        useTerminalStore.getState().toggleScratchpad();
      },
    });

    actions.push({
      id: "new-serial-tab",
      label: "New Serial / COM Port Tab",
      icon: Terminal,
      category: "New Tab",
      handler: () => {
        window.dispatchEvent(new Event("nexterm:open-serial"));
      },
    });

    const snippets = useSettingsStore.getState().settings.snippets || [];
    for (const snippet of snippets) {
      actions.push({
        id: `snippet-${snippet.id}`,
        label: snippet.name,
        icon: SquareTerminal,
        category: "Snippets",
        handler: () => {
          const paneId = useTerminalStore.getState().activePaneId;
          if (!paneId) return;
          const pane = useTerminalStore.getState().panes[paneId];
          const conn = pane?.sshConnectionId
            ? useSshStore.getState().connections.find((c) => c.id === pane.sshConnectionId)
            : undefined;
          const ctx = {
            hostname: conn?.host ?? "localhost",
            username: conn?.username ?? "",
            cwd: pane?.cwd ?? "",
            paneId,
          };
          const resolved = resolveSnippetVars(snippet.command, ctx);
          const lines = resolved.split("\n");
          const entry = getCachedTerminal(paneId);
          if (!entry) return;
          lines.forEach((line, i) => {
            setTimeout(() => entry.terminal.paste(line + "\r"), i * 50);
          });
        },
      });
    }

    return actions;
  }, []);

  const combinedActions = useMemo(
    () => [...allActions, ...historyActions],
    [allActions, historyActions]
  );

  const filteredActions = useMemo(() => {
    if (!query.trim()) return combinedActions;
    const lower = query.toLowerCase();
    return combinedActions.filter(
      (a) =>
        a.label.toLowerCase().includes(lower) ||
        a.category.toLowerCase().includes(lower)
    );
  }, [query, combinedActions]);

  const totalResults = filteredActions.length;

  
  const grouped = useMemo(() => {
    const groups: { category: string; items: { action: PaletteAction; globalIndex: number }[] }[] = [];
    let currentCategory = "";
    filteredActions.forEach((action, i) => {
      if (action.category !== currentCategory) {
        currentCategory = action.category;
        groups.push({ category: currentCategory, items: [] });
      }
      groups[groups.length - 1].items.push({ action, globalIndex: i });
    });
    return groups;
  }, [filteredActions]);

  
  const activeThemeId = useThemeStore((s) => s.activeThemeId);
  const themes = useThemeStore((s) => s.themes);
  const setTheme = useThemeStore((s) => s.setTheme);
  const previewTheme = useThemeStore((s) => s.previewTheme);

  const themeList = useMemo(() => Object.values(themes), [themes]);

  const filteredThemes = useMemo(() => {
    if (!subQuery.trim()) return themeList;
    const lower = subQuery.toLowerCase();
    return themeList.filter((t) => t.name.toLowerCase().includes(lower));
  }, [subQuery, themeList]);

  
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setSubView(null);
      setSubQuery("");
      setSubSelectedIndex(0);
      // Load history asynchronously
      historyRecent(20)
        .then((entries) => {
          const actions: PaletteAction[] = entries
            .filter((e) => e.command && e.command.trim())
            .map((e) => ({
              id: `history-${e.id}`,
              label: e.command.trim(),
              icon: Clock,
              category: "History",
              handler: () => {
                const paneId = useTerminalStore.getState().activePaneId;
                if (paneId) writeToTerminal(paneId, e.command.trim() + "\r");
              },
            }));
          setHistoryActions(actions);
        })
        .catch(() => {
          setHistoryActions([]);
        });
    } else {
      setHistoryActions([]);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    setSubSelectedIndex(0);
  }, [subQuery]);

  useEffect(() => {
    if (isOpen && !subView) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen, subView]);

  useEffect(() => {
    if (subView) {
      requestAnimationFrame(() => {
        subInputRef.current?.focus();
      });
    }
  }, [subView]);

  const scrollSelectedIntoView = useCallback(
    (index: number) => {
      if (!listRef.current) return;
      const items = listRef.current.querySelectorAll("[data-result-item]");
      const item = items[index];
      if (item) {
        item.scrollIntoView({ block: "nearest" });
      }
    },
    []
  );

  const executeAction = useCallback(
    (index: number) => {
      const action = filteredActions[index];
      if (!action) return;

      if (action.subView) {
        setSubView(action.subView);
        setSubQuery("");
        setSubSelectedIndex(0);
        return;
      }

      toggleCommandPalette();
      requestAnimationFrame(() => {
        action.handler();
      });
    },
    [filteredActions, toggleCommandPalette]
  );

  const selectTheme = useCallback(
    (index: number) => {
      const t = filteredThemes[index];
      if (!t) return;
      setTheme(t.id);
      toggleCommandPalette();
    },
    [filteredThemes, setTheme, toggleCommandPalette]
  );

  const goBack = useCallback(() => {
    setSubView(null);
    setSubQuery("");
    setSubSelectedIndex(0);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (subView) {
        
        switch (e.key) {
          case "ArrowDown": {
            e.preventDefault();
            const next = subSelectedIndex < filteredThemes.length - 1 ? subSelectedIndex + 1 : 0;
            setSubSelectedIndex(next);
            scrollSelectedIntoView(next);
            
            const nextTheme = filteredThemes[next];
            if (nextTheme) previewTheme(nextTheme.id);
            break;
          }
          case "ArrowUp": {
            e.preventDefault();
            const prev = subSelectedIndex > 0 ? subSelectedIndex - 1 : filteredThemes.length - 1;
            setSubSelectedIndex(prev);
            scrollSelectedIntoView(prev);
            
            const prevTheme = filteredThemes[prev];
            if (prevTheme) previewTheme(prevTheme.id);
            break;
          }
          case "Enter": {
            e.preventDefault();
            if (filteredThemes.length > 0) {
              selectTheme(subSelectedIndex);
            }
            break;
          }
          case "Escape": {
            e.preventDefault();
            goBack();
            break;
          }
          case "Backspace": {
            if (!subQuery) {
              e.preventDefault();
              goBack();
            }
            break;
          }
        }
        return;
      }

      
      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const next = selectedIndex < totalResults - 1 ? selectedIndex + 1 : 0;
          setSelectedIndex(next);
          scrollSelectedIntoView(next);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prev = selectedIndex > 0 ? selectedIndex - 1 : totalResults - 1;
          setSelectedIndex(prev);
          scrollSelectedIntoView(prev);
          break;
        }
        case "Enter": {
          e.preventDefault();
          if (totalResults > 0) {
            executeAction(selectedIndex);
          }
          break;
        }
        case "Escape": {
          e.preventDefault();
          if (query) {
            setQuery("");
          } else {
            toggleCommandPalette();
          }
          break;
        }
      }
    },
    [subView, selectedIndex, totalResults, subSelectedIndex, filteredThemes, subQuery, query, scrollSelectedIntoView, executeAction, selectTheme, goBack, toggleCommandPalette, previewTheme]
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        toggleCommandPalette();
      }
    },
    [toggleCommandPalette]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50"
          style={{ paddingTop: "16vh" }}
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="w-full max-w-[560px] overflow-hidden rounded-xl border border-white/[0.12] shadow-2xl"
            style={{
              backgroundColor: paletteBg,
              backdropFilter: "blur(24px) saturate(1.4)",
              WebkitBackdropFilter: "blur(24px) saturate(1.4)",
            }}
            onKeyDown={handleKeyDown}
          >
            {}
            <div className="flex items-center gap-3 px-4 py-3">
              {subView ? (
                <button
                  onClick={goBack}
                  className="shrink-0 rounded p-0.5 text-text-muted transition-colors hover:bg-white/[0.08] hover:text-text-primary"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : (
                <Search className="h-4 w-4 shrink-0 text-text-muted" />
              )}

              {subView ? (
                <input
                  ref={subInputRef}
                  type="text"
                  value={subQuery}
                  onChange={(e) => setSubQuery(e.target.value)}
                  placeholder="Search themes..."
                  className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
                />
              ) : (
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type a command..."
                  className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
                />
              )}
            </div>

            <div className="h-px bg-white/[0.08]" />

            <div
              ref={listRef}
              className="max-h-[400px] overflow-y-auto p-1.5"
            >
              {subView === "themes" ? (
                
                <>
                  <div className="px-2.5 py-1.5 text-xs font-medium text-text-muted">
                    Themes
                  </div>
                  {filteredThemes.map((t, i) => {
                    const isSelected = i === subSelectedIndex;
                    const isActive = t.id === activeThemeId;
                    const VariantIcon = t.variant === "light" ? Sun : Moon;

                    return (
                      <button
                        key={t.id}
                        data-result-item
                        onClick={() => selectTheme(i)}
                        onMouseEnter={() => {
                          setSubSelectedIndex(i);
                        }}
                        onMouseLeave={() => previewTheme(null)}
                        className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                          isSelected
                            ? "bg-accent/20"
                            : "hover:bg-white/[0.08]"
                        }`}
                      >
                        <VariantIcon className="h-4 w-4 shrink-0 text-text-secondary" />
                        <span className={`flex-1 truncate text-sm ${isActive ? "text-accent" : "text-text-primary"}`}>
                          {t.name}
                        </span>
                        {isActive && (
                          <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
                        )}
                      </button>
                    );
                  })}
                  {filteredThemes.length === 0 && subQuery.trim() && (
                    <div className="px-2.5 py-8 text-center text-sm text-text-muted">
                      No themes matching &ldquo;{subQuery}&rdquo;
                    </div>
                  )}
                </>
              ) : (
                
                <>
                  {grouped.map((group) => (
                    <div key={group.category}>
                      <div className="px-2.5 py-1.5 text-xs font-medium text-text-muted">
                        {group.category}
                      </div>
                      {group.items.map(({ action, globalIndex }) => {
                        const Icon = action.icon;
                        const isSelected = globalIndex === selectedIndex;

                        return (
                          <button
                            key={action.id}
                            data-result-item
                            onClick={() => executeAction(globalIndex)}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                              isSelected
                                ? "bg-accent/20"
                                : "hover:bg-white/[0.08]"
                            }`}
                          >
                            <Icon className="h-4 w-4 shrink-0 text-text-secondary" />
                            <span className="flex-1 truncate text-sm text-text-primary">
                              {action.label}
                            </span>
                            {action.subView ? (
                              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                            ) : action.keys ? (
                              <div className="flex shrink-0 items-center gap-1">
                                {formatShortcut(action.keys).map((part, i) => (
                                  <kbd
                                    key={i}
                                    className="rounded-md bg-bg-tertiary px-1.5 py-0.5 text-xs text-text-muted"
                                  >
                                    {part}
                                  </kbd>
                                ))}
                              </div>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ))}

                  {filteredActions.length === 0 && query.trim() && (
                    <div className="px-2.5 py-8 text-center text-sm text-text-muted">
                      No results for &ldquo;{query}&rdquo;
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
