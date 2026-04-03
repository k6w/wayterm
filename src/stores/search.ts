import { create } from "zustand";
import type { SearchState, SearchOptions, SearchMatch } from "../types/search";

interface SearchStore extends SearchState {
  setQuery: (query: string) => void;
  setOptions: (options: Partial<SearchOptions>) => void;
  setMatches: (matches: SearchMatch[]) => void;
  nextMatch: () => void;
  previousMatch: () => void;
  clearSearch: () => void;
  setPaneId: (paneId: string | null) => void;
  setIsSearching: (isSearching: boolean) => void;
}

export const useSearchStore = create<SearchStore>((set, get) => ({
  query: "",
  options: {
    caseSensitive: false,
    wholeWord: false,
    regex: false,
    wrapAround: true
  },
  matches: [],
  currentMatchIndex: -1,
  isSearching: false,
  paneId: null,

  setQuery: (query: string) => {
    set({ query, currentMatchIndex: -1 });
  },

  setOptions: (options: Partial<SearchOptions>) => {
    set((state) => ({
      options: { ...state.options, ...options },
      currentMatchIndex: -1
    }));
  },

  setMatches: (matches: SearchMatch[]) => {
    set({
      matches,
      currentMatchIndex: matches.length > 0 ? 0 : -1
    });
  },

  nextMatch: () => {
    const { matches, currentMatchIndex, options } = get();
    if (matches.length === 0) return;

    let nextIndex = currentMatchIndex + 1;
    if (nextIndex >= matches.length) {
      nextIndex = options.wrapAround ? 0 : matches.length - 1;
    }
    set({ currentMatchIndex: nextIndex });
  },

  previousMatch: () => {
    const { matches, currentMatchIndex, options } = get();
    if (matches.length === 0) return;

    let prevIndex = currentMatchIndex - 1;
    if (prevIndex < 0) {
      prevIndex = options.wrapAround ? matches.length - 1 : 0;
    }
    set({ currentMatchIndex: prevIndex });
  },

  clearSearch: () => {
    set({
      query: "",
      matches: [],
      currentMatchIndex: -1,
      isSearching: false
    });
  },

  setPaneId: (paneId: string | null) => {
    set({ paneId });
  },

  setIsSearching: (isSearching: boolean) => {
    set({ isSearching });
  }
}));
