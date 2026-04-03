import { useState, useEffect, useRef } from 'react';
import { useSearchStore } from '../../stores/search';
import { Search, X, ChevronUp, ChevronDown, CaseSensitive, Regex, WholeWord } from 'lucide-react';

interface SearchBarProps {
  terminalId: string;
  onClose: () => void;
}

export function SearchBar({ terminalId, onClose }: SearchBarProps) {
  const { query, matches, currentMatchIndex, options, setQuery, setOptions, findNext, findPrevious, clearSearch } = useSearchStore();
  const [localQuery, setLocalQuery] = useState(query);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  const handleSearch = (value: string) => {
    setLocalQuery(value);
    setQuery(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        findPrevious();
      } else {
        findNext();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const toggleCaseSensitive = () => {
    setOptions({ caseSensitive: !options.caseSensitive });
  };

  const toggleRegex = () => {
    setOptions({ regex: !options.regex });
  };

  const toggleWholeWord = () => {
    setOptions({ wholeWord: !options.wholeWord });
  };

  const handleClose = () => {
    clearSearch();
    onClose();
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.05] border-b border-white/[0.08] rounded-t-lg">
      <Search className="w-3.5 h-3.5 text-text-muted shrink-0" />
      
      <input
        ref={inputRef}
        type="text"
        value={localQuery}
        onChange={(e) => handleSearch(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in terminal..."
        className="flex-1 px-2 py-1 bg-white/[0.05] border border-white/[0.08] rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
      />

      {matches.length > 0 && (
        <span className="text-[10px] text-text-muted whitespace-nowrap">
          {currentMatchIndex + 1} of {matches.length}
        </span>
      )}

      <div className="flex items-center gap-1">
        <button
          onClick={toggleCaseSensitive}
          className={`p-1 rounded transition-colors ${options.caseSensitive ? 'bg-accent text-white' : 'hover:bg-white/[0.08] text-text-muted'}`}
          title="Match Case"
        >
          <CaseSensitive className="w-3.5 h-3.5" />
        </button>
        
        <button
          onClick={toggleWholeWord}
          className={`p-1 rounded transition-colors ${options.wholeWord ? 'bg-accent text-white' : 'hover:bg-white/[0.08] text-text-muted'}`}
          title="Match Whole Word"
        >
          <WholeWord className="w-3.5 h-3.5" />
        </button>
        
        <button
          onClick={toggleRegex}
          className={`p-1 rounded transition-colors ${options.regex ? 'bg-accent text-white' : 'hover:bg-white/[0.08] text-text-muted'}`}
          title="Use Regular Expression"
        >
          <Regex className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-1 border-l border-white/[0.08] pl-2">
        <button
          onClick={findPrevious}
          disabled={matches.length === 0}
          className="p-1 hover:bg-white/[0.08] rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Previous Match (Shift+Enter)"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        
        <button
          onClick={findNext}
          disabled={matches.length === 0}
          className="p-1 hover:bg-white/[0.08] rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Next Match (Enter)"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      <button
        onClick={handleClose}
        className="p-1 hover:bg-white/[0.08] rounded transition-colors"
        title="Close (Esc)"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
