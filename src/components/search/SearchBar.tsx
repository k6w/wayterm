import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "../../ui/icons";
import type { ISearchOptions, SearchAddon } from "@xterm/addon-search";
import { IconButton, Input, Toolbar, ToolbarButton, ToolbarSeparator } from "../../ui";
import { useThemeStore } from "../../stores/theme";
import { formatMatchCount, type SearchResults } from "./match-count";

interface SearchBarProps {
  terminalId: string;
  searchAddon: SearchAddon | null;
  onClose: () => void;
}

interface Flags {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

/**
 * Find-in-terminal bar. Enter / Shift+Enter step through matches, Escape
 * closes. Matches are highlighted with theme colors so the addon can report
 * the match count.
 */
export function SearchBar({ searchAddon, onClose }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [flags, setFlags] = useState<Flags>({ caseSensitive: false, wholeWord: false, regex: false });
  const [results, setResults] = useState<SearchResults | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chrome = useThemeStore((s) => s.active.chrome);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Match counts arrive through the addon's event; highlights are cleared when
  // the bar goes away, however it is closed.
  useEffect(() => {
    if (!searchAddon) return;
    const subscription = searchAddon.onDidChangeResults((event) => setResults(event));
    return () => {
      subscription.dispose();
      searchAddon.clearDecorations();
    };
  }, [searchAddon]);

  const options = (next: Flags = flags, incremental = false): ISearchOptions => ({
    ...next,
    incremental,
    decorations: {
      matchBorder: chrome.warning,
      matchOverviewRuler: chrome.warning,
      activeMatchBorder: chrome.accent,
      activeMatchColorOverviewRuler: chrome.accent,
    },
  });

  const findNext = () => {
    if (searchAddon && query) searchAddon.findNext(query, options());
  };

  const findPrevious = () => {
    if (searchAddon && query) searchAddon.findPrevious(query, options());
  };

  const changeQuery = (value: string) => {
    setQuery(value);
    if (!searchAddon) return;
    if (value) {
      searchAddon.findNext(value, options(flags, true));
    } else {
      searchAddon.clearDecorations();
      setResults(null);
    }
  };

  const toggle = (flag: keyof Flags) => {
    const next = { ...flags, [flag]: !flags[flag] };
    setFlags(next);
    if (searchAddon && query) searchAddon.findNext(query, options(next));
  };

  const close = () => {
    searchAddon?.clearDecorations();
    onClose();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey) findPrevious();
      else findNext();
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  const count = query ? formatMatchCount(results) : "";

  return (
    <div role="search" className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-panel px-2">
      <Icon name="search" size="sm" aria-hidden className="shrink-0 text-fg-muted" />
      <Input
        ref={inputRef}
        size="sm"
        aria-label="Find in terminal"
        placeholder="Find in terminal..."
        value={query}
        onChange={(event) => changeQuery(event.target.value)}
        onKeyDown={onKeyDown}
        code
        className="max-w-72 flex-1"
      />
      <span aria-live="polite" className="min-w-16 shrink-0 text-label tabular-nums text-fg-muted">
        {count}
      </span>
      <Toolbar aria-label="Search options" className="ml-auto gap-0.5">
        <ToolbarButton>
          <IconButton
            label="Match case"
            icon={<Icon name="matchCase" size="sm" />}
            pressed={flags.caseSensitive}
            onClick={() => toggle("caseSensitive")}
          />
        </ToolbarButton>
        <ToolbarButton>
          <IconButton
            label="Match whole word"
            icon={<Icon name="wholeWord" size="sm" />}
            pressed={flags.wholeWord}
            onClick={() => toggle("wholeWord")}
          />
        </ToolbarButton>
        <ToolbarButton>
          <IconButton
            label="Use regular expression"
            icon={<Icon name="regex" size="sm" />}
            pressed={flags.regex}
            onClick={() => toggle("regex")}
          />
        </ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton>
          <IconButton
            label="Previous match"
            shortcut="Shift+Enter"
            icon={<Icon name="chevronUp" size="sm" />}
            disabled={!query}
            onClick={findPrevious}
          />
        </ToolbarButton>
        <ToolbarButton>
          <IconButton
            label="Next match"
            shortcut="Enter"
            icon={<Icon name="chevronDown" size="sm" />}
            disabled={!query}
            onClick={findNext}
          />
        </ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton>
          <IconButton label="Close search" shortcut="Escape" icon={<Icon name="close" size="sm" />} onClick={close} />
        </ToolbarButton>
      </Toolbar>
    </div>
  );
}
