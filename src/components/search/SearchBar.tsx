import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search, X, ChevronUp, ChevronDown, CaseSensitive, Regex, WholeWord } from 'lucide-react';
import type { SearchAddon } from '@xterm/addon-search';

interface SearchBarProps {
  terminalId: string;
  searchAddon: SearchAddon | null;
  onClose: () => void;
}

export function SearchBar({ terminalId, searchAddon, onClose }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regex, setRegex] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (searchAddon && value) {
      searchAddon.findNext(value, { caseSensitive, wholeWord, regex });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchAddon && query) {
      if (e.shiftKey) {
        searchAddon.findPrevious(query, { caseSensitive, wholeWord, regex });
      } else {
        searchAddon.findNext(query, { caseSensitive, wholeWord, regex });
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const toggleCaseSensitive = () => {
    setCaseSensitive(!caseSensitive);
    if (searchAddon && query) {
      searchAddon.findNext(query, { caseSensitive: !caseSensitive, wholeWord, regex });
    }
  };

  const toggleRegex = () => {
    setRegex(!regex);
    if (searchAddon && query) {
      searchAddon.findNext(query, { caseSensitive, wholeWord, regex: !regex });
    }
  };

  const toggleWholeWord = () => {
    setWholeWord(!wholeWord);
    if (searchAddon && query) {
      searchAddon.findNext(query, { caseSensitive, wholeWord: !wholeWord, regex });
    }
  };

  const handleClose = () => {
    if (searchAddon) {
      searchAddon.clearDecorations();
    }
    onClose();
  };

  const handleFindNext = () => {
    if (searchAddon && query) {
      searchAddon.findNext(query, { caseSensitive, wholeWord, regex });
    }
  };

  const handleFindPrevious = () => {
    if (searchAddon && query) {
      searchAddon.findPrevious(query, { caseSensitive, wholeWord, regex });
    }
  };

  return (
    <motion.div 
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -50, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex items-center gap-2 px-3 py-2 bg-white/[0.05] border-b border-white/[0.08] rounded-t-lg"
    >
      <Search className="w-3.5 h-3.5 text-text-muted shrink-0" />
      
      <motion.input
        initial={{ width: 0 }}
        animate={{ width: 'auto' }}
        transition={{ delay: 0.1 }}
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in terminal..."
        className="flex-1 px-2 py-1 bg-white/[0.05] border border-white/[0.08] rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
      />

      <motion.div 
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.15 }}
        className="flex items-center gap-1"
      >
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={toggleCaseSensitive}
          className={`p-1 rounded transition-colors ${caseSensitive ? 'bg-accent text-white' : 'hover:bg-white/[0.08] text-text-muted'}`}
          title="Match Case"
        >
          <CaseSensitive className="w-3.5 h-3.5" />
        </motion.button>
        
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={toggleWholeWord}
          className={`p-1 rounded transition-colors ${wholeWord ? 'bg-accent text-white' : 'hover:bg-white/[0.08] text-text-muted'}`}
          title="Match Whole Word"
        >
          <WholeWord className="w-3.5 h-3.5" />
        </motion.button>
        
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={toggleRegex}
          className={`p-1 rounded transition-colors ${regex ? 'bg-accent text-white' : 'hover:bg-white/[0.08] text-text-muted'}`}
          title="Use Regular Expression"
        >
          <Regex className="w-3.5 h-3.5" />
        </motion.button>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-1 border-l border-white/[0.08] pl-2"
      >
        <motion.button
          whileHover={{ scale: 1.1, y: -2 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleFindPrevious}
          disabled={!query}
          className="p-1 hover:bg-white/[0.08] rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Previous Match (Shift+Enter)"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </motion.button>
        
        <motion.button
          whileHover={{ scale: 1.1, y: 2 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleFindNext}
          disabled={!query}
          className="p-1 hover:bg-white/[0.08] rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Next Match (Enter)"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </motion.button>
      </motion.div>

      <motion.button
        initial={{ opacity: 0, rotate: -90 }}
        animate={{ opacity: 1, rotate: 0 }}
        transition={{ delay: 0.25 }}
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        onClick={handleClose}
        className="p-1 hover:bg-white/[0.08] rounded transition-colors"
        title="Close (Esc)"
      >
        <X className="w-3.5 h-3.5" />
      </motion.button>
    </motion.div>
  );
}
