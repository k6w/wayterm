/** What the xterm search addon reports through onDidChangeResults. */
export interface SearchResults {
  /** Index of the selected match, or -1 when none is selected. */
  resultIndex: number;
  resultCount: number;
}

/** The addon stops counting at this many matches (its default highlightLimit). */
export const MATCH_LIMIT = 1000;

/** "3 of 12", "12 matches", "1000+ matches" or "No results". Empty until the addon reports. */
export function formatMatchCount(results: SearchResults | null): string {
  if (!results) return "";
  const { resultIndex, resultCount } = results;
  if (resultCount === 0) return "No results";
  const total = resultCount >= MATCH_LIMIT ? `${MATCH_LIMIT}+` : String(resultCount);
  if (resultIndex >= 0) return `${resultIndex + 1} of ${total}`;
  return resultCount === 1 ? "1 match" : `${total} matches`;
}
