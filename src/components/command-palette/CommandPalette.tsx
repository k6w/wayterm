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
  Clock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTerminalStore } from "../../stores/terminal";
import { getDefaultKeybindings } from "../../lib/keybindings";

const ACTION_ICONS: Record<string, LucideIcon> = {
  "new-tab": Plus,
  "close-tab": X,
  "toggle-sidebar": PanelLeft,
  "command-palette": ArrowRightLeft,
  settings: Settings,
  "split-horizontal": Columns2,
  "split-vertical": Rows2,
  "next-tab": ChevronRight,
  "prev-tab": ChevronLeft,
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

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const actions = useMemo(() => {
    const bindings = getDefaultKeybindings();
    return bindings.filter((b) => b.id !== "command-palette");
  }, []);

  const filteredActions = useMemo(() => {
    if (!query.trim()) return actions;
    const lower = query.toLowerCase();
    return actions.filter((a) => a.label.toLowerCase().includes(lower));
  }, [query, actions]);

  const totalResults = filteredActions.length;

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

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
      if (action) {
        toggleCommandPalette();
        requestAnimationFrame(() => {
          action.handler();
        });
      }
    },
    [filteredActions, toggleCommandPalette]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
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
          toggleCommandPalette();
          break;
        }
      }
    },
    [selectedIndex, totalResults, scrollSelectedIntoView, executeAction, toggleCommandPalette]
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
            className="w-full max-w-[560px] overflow-hidden rounded-xl border border-white/[0.12] bg-white/[0.08] shadow-2xl backdrop-blur-xl"
            onKeyDown={handleKeyDown}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-text-muted" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command..."
                className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
              />
            </div>

            <div className="h-px bg-white/[0.08]" />

            <div
              ref={listRef}
              className="max-h-[400px] overflow-y-auto p-1.5"
            >
              {filteredActions.length > 0 && (
                <div>
                  <div className="px-2.5 py-1.5 text-xs font-medium text-text-muted">
                    Actions
                  </div>
                  {filteredActions.map((action, index) => {
                    const Icon = ACTION_ICONS[action.id] || Terminal;
                    const parts = formatShortcut(action.keys);
                    const isSelected = index === selectedIndex;

                    return (
                      <button
                        key={action.id}
                        data-result-item
                        onClick={() => executeAction(index)}
                        onMouseEnter={() => setSelectedIndex(index)}
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
                        <div className="flex shrink-0 items-center gap-1">
                          {parts.map((part, i) => (
                            <kbd
                              key={i}
                              className="rounded-md bg-bg-tertiary px-1.5 py-0.5 text-xs text-text-muted"
                            >
                              {part}
                            </kbd>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {filteredActions.length === 0 && query.trim() && (
                <div className="px-2.5 py-8 text-center text-sm text-text-muted">
                  No results for "{query}"
                </div>
              )}

              <div className="mt-1">
                <div className="px-2.5 py-1.5 text-xs font-medium text-text-muted">
                  Recent
                </div>
                <div className="flex flex-col items-center gap-1 py-4">
                  <Clock className="h-4 w-4 text-text-muted/50" />
                  <span className="text-xs text-text-muted">
                    No recent commands
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
