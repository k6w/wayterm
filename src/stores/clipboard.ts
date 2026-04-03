import { create } from "zustand";
import type { ClipboardEntry, ClipboardState } from "../types/clipboard";

interface ClipboardStore extends ClipboardState {
  addEntry: (content: string, source: ClipboardEntry['source']) => void;
  removeEntry: (id: string) => void;
  toggleFavorite: (id: string) => void;
  addTag: (id: string, tag: string) => void;
  removeTag: (id: string, tag: string) => void;
  clearHistory: () => void;
  setFilterTags: (tags: string[]) => void;
  getFilteredEntries: () => ClipboardEntry[];
}

const MAX_ENTRIES = 100;

export const useClipboardStore = create<ClipboardStore>((set, get) => ({
  entries: [],
  maxEntries: MAX_ENTRIES,
  syncEnabled: true,
  filterTags: [],

  addEntry: (content: string, source: ClipboardEntry['source']) => {
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > 10000) return;

    set((state) => {
      const existing = state.entries.find(e => e.content === trimmed);
      if (existing) {
        return {
          entries: [
            { ...existing, timestamp: Date.now() },
            ...state.entries.filter(e => e.id !== existing.id)
          ]
        };
      }

      const newEntry: ClipboardEntry = {
        id: crypto.randomUUID(),
        content: trimmed,
        timestamp: Date.now(),
        source,
        favorite: false,
        tags: []
      };

      const newEntries = [newEntry, ...state.entries];
      if (newEntries.length > state.maxEntries) {
        newEntries.splice(state.maxEntries);
      }

      return { entries: newEntries };
    });
  },

  removeEntry: (id: string) => {
    set((state) => ({
      entries: state.entries.filter(e => e.id !== id)
    }));
  },

  toggleFavorite: (id: string) => {
    set((state) => ({
      entries: state.entries.map(e =>
        e.id === id ? { ...e, favorite: !e.favorite } : e
      )
    }));
  },

  addTag: (id: string, tag: string) => {
    set((state) => ({
      entries: state.entries.map(e =>
        e.id === id && !e.tags.includes(tag)
          ? { ...e, tags: [...e.tags, tag] }
          : e
      )
    }));
  },

  removeTag: (id: string, tag: string) => {
    set((state) => ({
      entries: state.entries.map(e =>
        e.id === id
          ? { ...e, tags: e.tags.filter(t => t !== tag) }
          : e
      )
    }));
  },

  clearHistory: () => {
    set({ entries: [] });
  },

  setFilterTags: (tags: string[]) => {
    set({ filterTags: tags });
  },

  getFilteredEntries: () => {
    const state = get();
    if (state.filterTags.length === 0) {
      return state.entries;
    }
    return state.entries.filter(e =>
      state.filterTags.some(tag => e.tags.includes(tag))
    );
  }
}));
