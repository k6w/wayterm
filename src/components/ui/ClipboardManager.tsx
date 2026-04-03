import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Star, Tag, Trash2, X, Search, Clock } from "lucide-react";
import { useClipboardStore } from "../../stores/clipboard";
import { useThemeStore } from "../../stores/theme";
import { useSettingsStore } from "../../stores/settings";
import { hexToRgba } from "../../lib/color";
import { vibrancyAlpha } from "../../lib/platform";
import { pasteToTerminal } from "../../lib/terminal-registry";
import { useTerminalStore } from "../../stores/terminal";

interface ClipboardManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ClipboardManager({ isOpen, onClose }: ClipboardManagerProps) {
  const entries = useClipboardStore((s) => s.getFilteredEntries());
  const removeEntry = useClipboardStore((s) => s.removeEntry);
  const toggleFavorite = useClipboardStore((s) => s.toggleFavorite);
  const clearHistory = useClipboardStore((s) => s.clearHistory);
  const theme = useThemeStore((s) => s.active);
  const vibrancy = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const windowOpacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);
  const activePaneId = useTerminalStore((s) => s.activePaneId);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredEntries = entries.filter((e) =>
    e.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  const handlePaste = (content: string) => {
    if (activePaneId) {
      navigator.clipboard.writeText(content);
      pasteToTerminal(activePaneId);
      onClose();
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => (i < filteredEntries.length - 1 ? i + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => (i > 0 ? i - 1 : filteredEntries.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredEntries[selectedIndex]) {
          handlePaste(filteredEntries[selectedIndex].content);
        }
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
    }
  };

  const paletteBg = vibrancy
    ? hexToRgba(theme.ui.bgPrimary, vibrancyAlpha(windowOpacity) * 0.88)
    : theme.ui.bgPrimary;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50"
          style={{ paddingTop: "12vh" }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="w-full max-w-[640px] overflow-hidden rounded-xl border border-white/[0.12] shadow-2xl"
            style={{
              backgroundColor: paletteBg,
              backdropFilter: "blur(24px) saturate(1.4)",
              WebkitBackdropFilter: "blur(24px) saturate(1.4)",
            }}
            onKeyDown={handleKeyDown}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-3 flex-1">
                <Search className="h-4 w-4 shrink-0 text-text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search clipboard history..."
                  className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearHistory}
                  className="p-1.5 rounded text-text-muted hover:text-error hover:bg-error/10 transition-colors"
                  title="Clear history"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-white/[0.08] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[500px] overflow-y-auto p-2">
              {filteredEntries.length === 0 ? (
                <div className="py-12 text-center text-sm text-text-muted">
                  {searchQuery ? `No results for "${searchQuery}"` : "Clipboard history is empty"}
                </div>
              ) : (
                filteredEntries.map((entry, index) => {
                  const isSelected = index === selectedIndex;
                  const preview = entry.content.length > 200
                    ? entry.content.substring(0, 200) + "..."
                    : entry.content;

                  return (
                    <div
                      key={entry.id}
                      className={`group relative rounded-lg p-3 mb-2 transition-colors cursor-pointer ${
                        isSelected ? "bg-accent/20" : "hover:bg-white/[0.08]"
                      }`}
                      onClick={() => handlePaste(entry.content)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <pre className="text-xs text-text-primary font-mono whitespace-pre-wrap break-words">
                            {preview}
                          </pre>
                          <div className="flex items-center gap-2 mt-2">
                            <Clock className="h-3 w-3 text-text-muted" />
                            <span className="text-xs text-text-muted">
                              {new Date(entry.timestamp).toLocaleString()}
                            </span>
                            {entry.source !== "manual" && (
                              <span className="text-xs text-text-muted">
                                • {entry.source}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(entry.id);
                            }}
                            className={`p-1.5 rounded transition-colors ${
                              entry.favorite
                                ? "text-yellow-500 hover:text-yellow-600"
                                : "text-text-muted hover:text-text-primary hover:bg-white/[0.08]"
                            }`}
                            title="Toggle favorite"
                          >
                            <Star className="h-3.5 w-3.5" fill={entry.favorite ? "currentColor" : "none"} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(entry.content);
                            }}
                            className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-white/[0.08] transition-colors"
                            title="Copy to clipboard"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeEntry(entry.id);
                            }}
                            className="p-1.5 rounded text-text-muted hover:text-error hover:bg-error/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-4 py-2 border-t border-white/[0.08] text-xs text-text-muted">
              <div className="flex items-center justify-between">
                <span>{filteredEntries.length} items</span>
                <span>Press Enter to paste • Esc to close</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
