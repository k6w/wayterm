export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
  wrapAround: boolean;
}

export interface SearchMatch {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  text: string;
}

export interface SearchState {
  query: string;
  options: SearchOptions;
  matches: SearchMatch[];
  currentMatchIndex: number;
  isSearching: boolean;
  paneId: string | null;
}
