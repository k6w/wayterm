import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useClipboardStore } from '../../stores/clipboard';
import { useTerminalStore } from '../../stores/terminal';
import { pasteToTerminal } from '../../lib/terminal-registry';
import { Copy, Star, Trash2, Search, Clock } from 'lucide-react';

export function ClipboardPanel() {
  const entries = useClipboardStore((s) => s.entries);
  const removeEntry = useClipboardStore((s) => s.removeEntry);
  const toggleFavorite = useClipboardStore((s) => s.toggleFavorite);
  const clearHistory = useClipboardStore((s) => s.clearHistory);
  const activePaneId = useTerminalStore((s) => s.activePaneId);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEntries = entries
    .filter((e) => e.content.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));

  const handlePaste = (content: string) => {
    if (activePaneId) {
      navigator.clipboard.writeText(content);
      pasteToTerminal(activePaneId);
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  return (
    <div className="flex flex-col h-full text-text-primary">
      <div className="flex items-center justify-between p-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted"
          />
        </div>
        <AnimatePresence>
        {entries.length > 0 && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.9 }}
            onClick={clearHistory}
            className="p-1 hover:bg-error/20 rounded text-text-muted hover:text-error transition-colors"
            title="Clear all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </motion.button>
        )}
        </AnimatePresence>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence mode="wait">
        {filteredEntries.length === 0 ? (
          <motion.div 
            key="empty"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-center text-text-muted py-12 text-xs"
          >
            {searchQuery ? `No results for "${searchQuery}"` : 'Clipboard history is empty'}
            {!searchQuery && (
              <div className="text-[10px] mt-2 text-text-tertiary">
                Copy text in the terminal to see it here
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="entries" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {filteredEntries.map((entry, i) => {
            const preview = entry.content.length > 100
              ? entry.content.substring(0, 100) + '...'
              : entry.content;

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: i * 0.03 }}
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.98 }}
                className="group p-2.5 bg-white/[0.03] rounded border border-white/[0.08] hover:bg-white/[0.06] transition-colors cursor-pointer mb-2"
                onClick={() => handlePaste(entry.content)}
              >
                <pre className="text-[10px] text-text-primary font-mono whitespace-pre-wrap break-words mb-2">
                  {preview}
                </pre>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-text-muted" />
                    <span className="text-[9px] text-text-muted">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <motion.button
                      whileHover={{ scale: 1.2, rotate: 10 }}
                      whileTap={{ scale: 0.8 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(entry.id);
                      }}
                      className={`p-1 rounded transition-colors ${
                        entry.favorite
                          ? 'text-yellow-500 hover:text-yellow-600'
                          : 'text-text-muted hover:bg-white/[0.08]'
                      }`}
                      title="Favorite"
                    >
                      <Star className="w-3 h-3" fill={entry.favorite ? 'currentColor' : 'none'} />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.8 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(entry.content);
                      }}
                      className="p-1 rounded text-text-muted hover:bg-white/[0.08] transition-colors"
                      title="Copy"
                    >
                      <Copy className="w-3 h-3" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.2, rotate: 5 }}
                      whileTap={{ scale: 0.8 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeEntry(entry.id);
                      }}
                      className="p-1 rounded text-text-muted hover:text-error hover:bg-error/20 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            );
          })}
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
      {filteredEntries.length > 0 && (
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          className="px-3 py-2 border-t border-white/[0.08] text-[10px] text-text-muted"
        >
          {filteredEntries.length} {filteredEntries.length === 1 ? 'item' : 'items'}
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
