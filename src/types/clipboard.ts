export interface ClipboardEntry {
  id: string;
  content: string;
  timestamp: number;
  source: 'terminal' | 'system' | 'manual';
  favorite: boolean;
  tags: string[];
}

export interface ClipboardState {
  entries: ClipboardEntry[];
  maxEntries: number;
  syncEnabled: boolean;
  filterTags: string[];
}
